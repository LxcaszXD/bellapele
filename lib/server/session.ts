import { cookies } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import type { RowDataPacket } from "mysql2";
import { db } from "@/lib/db";
import { ApiError } from "./errors";
const cookieName = "bellapelle_session_v2";
export async function customerId(request: Request) {
  const jar = await cookies();
  const token = jar.get(cookieName)?.value;
  if (token && /^[a-f0-9]{64}$/.test(token)) {
    const hash = createHash("sha256").update(token).digest("hex");
    const [rows] = await db().execute<RowDataPacket[]>(
      "SELECT id_cliente FROM SessaoCliente WHERE token_hash=? AND expira_em>UTC_TIMESTAMP()",
      [hash],
    );
    if (rows.length) return Number(rows[0].id_cliente);
  }
  // Acesso DEMONSTRATIVO explicito e restrito ao host local. Nunca recebe id do cliente pelo corpo.
  const host = new URL(request.url).hostname;
  const demoId = Number(process.env.LOCAL_DEMO_CLIENT_ID);
  if (
    process.env.ENABLE_LOCAL_DEMO_AUTH !== "true" ||
    !["localhost", "127.0.0.1", "[::1]"].includes(host) ||
    !Number.isSafeInteger(demoId) ||
    demoId < 1
  )
    throw new ApiError(
      401,
      "Sessão necessária. Em desenvolvimento local, configure o acesso demonstrativo conforme o README.",
    );
  const [rows] = await db().execute<RowDataPacket[]>(
    "SELECT id_cliente FROM Cliente WHERE id_cliente=?",
    [demoId],
  );
  if (!rows.length)
    throw new ApiError(
      401,
      "Cliente demonstrativo não encontrado. Importe o banco de exemplo.",
    );
  const newToken = randomBytes(32).toString("hex");
  const hash = createHash("sha256").update(newToken).digest("hex");
  await db().execute(
    "INSERT INTO SessaoCliente(token_hash,id_cliente,expira_em) VALUES (?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 7 DAY))",
    [hash, demoId],
  );
  jar.set(cookieName, newToken, {
    httpOnly: true,
    secure:
      process.env.NODE_ENV === "production" &&
      process.env.COOKIE_SECURE !== "false",
    sameSite: "strict",
    path: "/",
    maxAge: 7 * 86400,
  });
  return demoId;
}
