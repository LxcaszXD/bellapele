import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import type { RowDataPacket } from "mysql2";
import { db } from "../db";
import { Actor, ClinicError, requirePermission } from "./permissions";
import { audit } from "./auth";
import { limitedBody } from "./security";
import { transaction, exec } from "./db";
const root = () =>
  path.resolve(process.env.PRIVATE_UPLOAD_DIR || "private-uploads");
export function imageType(bytes: Buffer) {
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return "image/png";
  if (
    bytes.length >= 3 &&
    bytes[0] === 255 &&
    bytes[1] === 216 &&
    bytes[2] === 255
  )
    return "image/jpeg";
  if (
    bytes.length >= 12 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  )
    return "image/webp";
  throw new ClinicError("Envie uma imagem JPEG, PNG ou WebP válida.", 415);
}
async function access(id: number, actor: Actor) {
  const [rows] = await db().execute<RowDataPacket[]>(
    "SELECT a.id_profissional FROM Atendimento t JOIN Agendamento a ON a.id_agendamento=t.id_agendamento WHERE t.id_atendimento=?",
    [id],
  );
  if (!rows[0]) throw new ClinicError("Atendimento não encontrado.", 404);
  if (
    actor.perfil === "profissional" &&
    Number(rows[0].id_profissional) !== actor.id_profissional
  )
    throw new ClinicError("Acesso não autorizado.", 403);
}
export async function photos(
  request: Request,
  segments: string[],
  actor: Actor,
): Promise<unknown> {
  requirePermission(
    actor,
    request.method === "GET" ? "clinical:read" : "clinical:write",
  );
  if (request.method === "GET" && segments[1]) {
    const [rows] = await db().execute<RowDataPacket[]>(
      "SELECT * FROM FotoClinica WHERE id_foto=?",
      [Number(segments[1])],
    );
    const row = rows[0];
    if (!row) throw new ClinicError("Foto não encontrada.", 404);
    await access(row.id_atendimento, actor);
    await audit(actor, "foto_consultada", String(row.id_foto));
    const bytes = await readFile(path.join(root(), row.arquivo));
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": row.mime,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": 'inline; filename="registro-clinico"',
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  }
  if (request.method === "GET") {
    const id = Number(new URL(request.url).searchParams.get("atendimento"));
    await access(id, actor);
    const [items] = await db().execute<RowDataPacket[]>(
      "SELECT id_foto,id_atendimento,mime,tamanho,criado_em FROM FotoClinica WHERE id_atendimento=? ORDER BY id_foto",
      [id],
    );
    return { items };
  }
  if (request.method !== "POST")
    throw new ClinicError("Método não permitido.", 405);
  if (Number(request.headers.get("content-length") || 0) > 6 * 1024 * 1024)
    throw new ClinicError("Imagem deve ter até 5 MB.", 413);
  const form = await new Response(await limitedBody(request, 6 * 1024 * 1024), {
      headers: { "Content-Type": request.headers.get("content-type") || "" },
    }).formData(),
    file = form.get("file"),
    id = Number(form.get("id_atendimento")),
    consentimento = String(form.get("consentimento") || "").trim();
  await access(id, actor);
  if (consentimento.length < 10 || consentimento.length > 2000)
    throw new ClinicError(
      "Registre o consentimento específico para a fotografia (10 a 2000 caracteres).",
    );
  if (!(file instanceof File) || file.size > 5 * 1024 * 1024 || file.size < 12)
    throw new ClinicError("Imagem deve ter até 5 MB.", 413);
  const bytes = Buffer.from(await file.arrayBuffer()),
    mime = imageType(bytes);
  if (file.type !== mime)
    throw new ClinicError(
      "Tipo do arquivo incompatível com seu conteúdo.",
      415,
    );
  let safe: Buffer;
  try {
    safe = await sharp(bytes, { limitInputPixels: 25000000, failOn: "warning" })
      .rotate()
      .toFormat(
        mime === "image/png" ? "png" : mime === "image/jpeg" ? "jpeg" : "webp",
      )
      .toBuffer();
  } catch {
    throw new ClinicError(
      "Não foi possível decodificar a imagem. Envie uma imagem válida de até 25 megapixels.",
      415,
    );
  }
  const filename = randomUUID();
  await mkdir(root(), { recursive: true, mode: 0o700 });
  await writeFile(path.join(root(), filename), safe, {
    mode: 0o600,
    flag: "wx",
  });
  try {
    const result = await transaction(async (c) => {
      const r = await exec(
        c,
        "INSERT INTO FotoClinica(id_atendimento,id_usuario,arquivo,mime,tamanho,consentimento) VALUES (?,?,?,?,?,?)",
        [id, actor.id, filename, mime, safe.length, consentimento],
      );
      await exec(
        c,
        "INSERT INTO AuditoriaSeguranca(id_usuario,acao,recurso) VALUES (?,?,?)",
        [actor.id, "foto_registrada", String(r.insertId)],
      );
      return r;
    });
    return { id_foto: result.insertId };
  } catch (e) {
    await unlink(path.join(root(), filename));
    throw e;
  }
}
