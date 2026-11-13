import { db } from "../db";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { z } from "zod";
import {
  Actor,
  ClinicError,
  rolePermissions,
  requirePermission,
  validPermissions,
} from "./permissions";
import {
  hashToken,
  randomToken,
  hashPassword,
  verifyPassword,
  jsonBody,
} from "./security";
export const COOKIE = "bellapelle_staff";
interface UserRow extends RowDataPacket {
  id_usuario: number;
  nome: string;
  email: string;
  perfil: string;
  id_profissional: number | null;
  permissoes: string[] | string | null;
  senha_hash: string;
  ativo: number;
  csrf_token?: string;
}
export function actorFrom(row: UserRow): Actor {
  const custom =
    typeof row.permissoes === "string"
      ? JSON.parse(row.permissoes)
      : row.permissoes;
  return {
    id: row.id_usuario,
    nome: row.nome,
    email: row.email,
    perfil: row.perfil,
    id_profissional: row.id_profissional,
    permissions:
      row.perfil === "administrador"
        ? ["*"]
        : (custom ?? rolePermissions[row.perfil] ?? []),
  };
}
export async function audit(
  actor: Actor | null,
  action: string,
  resource = "",
) {
  await db().execute(
    "INSERT INTO AuditoriaSeguranca(id_usuario,acao,recurso) VALUES (?,?,?)",
    [actor?.id ?? null, action, resource],
  );
}
export function cookie(value: string, expire = false) {
  const secure = process.env.APP_ORIGIN?.startsWith("https://");
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${expire ? 0 : 28800}${secure ? "; Secure" : ""}`;
}
function sessionToken(request: Request) {
  return (
    request.headers
      .get("cookie")
      ?.split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith(COOKIE + "="))
      ?.slice(COOKIE.length + 1) || ""
  );
}
export async function session(request: Request) {
  const token = sessionToken(request);
  if (!token)
    throw new ClinicError("Faça login para continuar.", 401, "UNAUTHENTICATED");
  const [rows] = await db().execute<UserRow[]>(
    "SELECT u.*,s.csrf_token FROM SessaoUsuario s JOIN Usuario u ON u.id_usuario=s.id_usuario WHERE s.token_hash=? AND s.expira_em>UTC_TIMESTAMP() AND u.ativo=1",
    [hashToken(token)],
  );
  if (!rows[0])
    throw new ClinicError("Sessão expirada.", 401, "UNAUTHENTICATED");
  return { user: actorFrom(rows[0]), csrfToken: rows[0].csrf_token! };
}
export async function rateLimit(key: string, max = 10) {
  const conn = await db().getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute(
      "INSERT IGNORE INTO LimiteAcesso(chave,tentativas,expira_em) VALUES (?,0,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 15 MINUTE))",
      [hashToken(key)],
    );
    const [rows] = await conn.execute<RowDataPacket[]>(
      "SELECT tentativas, expira_em<=UTC_TIMESTAMP() AS expired FROM LimiteAcesso WHERE chave=? FOR UPDATE",
      [hashToken(key)],
    );
    const count = rows[0].expired ? 0 : Number(rows[0].tentativas);
    if (count >= max)
      throw new ClinicError(
        "Muitas tentativas. Tente novamente em 15 minutos.",
        429,
        "RATE_LIMIT",
      );
    await conn.execute(
      "UPDATE LimiteAcesso SET tentativas=?,expira_em=IF(expira_em<=UTC_TIMESTAMP(),DATE_ADD(UTC_TIMESTAMP(),INTERVAL 15 MINUTE),expira_em) WHERE chave=?",
      [count + 1, hashToken(key)],
    );
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}
const loginSchema = z.object({
  email: z
    .email()
    .max(254)
    .transform((x) => x.toLowerCase().trim()),
  password: z.string().min(1).max(128),
});
export async function login(request: Request) {
  const input = loginSchema.parse(await jsonBody(request));
  await rateLimit("login:" + input.email);
  await rateLimit("login:global", 200);
  const [rows] = await db().execute<UserRow[]>(
    "SELECT * FROM Usuario WHERE email=?",
    [input.email],
  );
  const u = rows[0];
  const fallback = "scrypt$00000000000000000000000000000000$" + "00".repeat(64);
  const valid = await verifyPassword(input.password, u?.senha_hash ?? fallback);
  if (!u || !valid || !u.ativo) {
    await audit(null, "login_falhou");
    throw new ClinicError(
      "E-mail ou senha inválidos.",
      401,
      "INVALID_CREDENTIALS",
    );
  }
  const token = randomToken(),
    csrfToken = randomToken();
  await db().execute(
    "INSERT INTO SessaoUsuario(token_hash,id_usuario,csrf_token,expira_em) VALUES (?,?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 8 HOUR))",
    [hashToken(token), u.id_usuario, csrfToken],
  );
  const user = actorFrom(u);
  await audit(user, "login");
  return { data: { user, csrfToken }, cookie: cookie(token) };
}
export async function logout(request: Request, actor: Actor) {
  await db().execute("DELETE FROM SessaoUsuario WHERE token_hash=?", [
    hashToken(sessionToken(request)),
  ]);
  await audit(actor, "logout");
  return cookie("", true);
}
export async function forgot(request: Request) {
  const { email } = z
    .object({
      email: z
        .email()
        .max(254)
        .transform((x) => x.toLowerCase().trim()),
    })
    .parse(await jsonBody(request));
  await rateLimit("forgot:" + email, 5);
  await rateLimit("forgot:global", 100);
  const [rows] = await db().execute<UserRow[]>(
    "SELECT * FROM Usuario WHERE email=? AND ativo=1",
    [email],
  );
  if (rows[0]) {
    const token = randomToken(),
      conn = await db().getConnection();
    try {
      await conn.beginTransaction();
      await conn.execute(
        "UPDATE RecuperacaoSenha SET utilizado_em=UTC_TIMESTAMP() WHERE id_usuario=? AND utilizado_em IS NULL",
        [rows[0].id_usuario],
      );
      await conn.execute(
        "INSERT INTO RecuperacaoSenha(token_hash,id_usuario,expira_em) VALUES (?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 30 MINUTE))",
        [hashToken(token), rows[0].id_usuario],
      );
      await conn.execute(
        "INSERT INTO EmailOutbox(destinatario,assunto,conteudo) VALUES (?,?,?)",
        [
          email,
          "Recuperação de senha BellaPelle",
          `${process.env.APP_ORIGIN}/?reset=${encodeURIComponent(token)}`,
        ],
      );
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }
  return {
    message:
      "Se o e-mail estiver cadastrado, a solicitação foi registrada. A entrega depende do serviço de e-mail da clínica.",
  };
}
export async function reset(request: Request) {
  const input = z
    .object({
      token: z.string().min(32).max(128),
      password: z.string().min(12).max(128),
    })
    .parse(await jsonBody(request));
  await rateLimit("reset:global", 100);
  const hash = await hashPassword(input.password),
    conn = await db().getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.execute<RowDataPacket[]>(
      "SELECT * FROM RecuperacaoSenha WHERE token_hash=? AND utilizado_em IS NULL AND expira_em>UTC_TIMESTAMP() FOR UPDATE",
      [hashToken(input.token)],
    );
    if (!rows[0]) throw new ClinicError("Link inválido ou expirado.");
    await conn.execute("UPDATE Usuario SET senha_hash=? WHERE id_usuario=?", [
      hash,
      rows[0].id_usuario,
    ]);
    await conn.execute(
      "UPDATE RecuperacaoSenha SET utilizado_em=UTC_TIMESTAMP() WHERE id_usuario=? AND utilizado_em IS NULL",
      [rows[0].id_usuario],
    );
    await conn.execute("DELETE FROM SessaoUsuario WHERE id_usuario=?", [
      rows[0].id_usuario,
    ]);
    await conn.commit();
    return { message: "Senha alterada. Faça login." };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}
const userSchema = z.object({
  nome: z.string().trim().min(2).max(150),
  email: z
    .email()
    .max(254)
    .transform((x) => x.toLowerCase()),
  perfil: z.enum([
    "administrador",
    "recepcao",
    "profissional",
    "financeiro",
    "estoque",
  ]),
  id_profissional: z.coerce.number().int().positive().nullable().optional(),
  permissions: z
    .array(z.string().refine((x) => validPermissions.includes(x)))
    .max(100)
    .nullable()
    .optional(),
  ativo: z.boolean().optional(),
  password: z.string().min(12).max(128).optional(),
});
export async function users(
  request: Request,
  segments: string[],
  actor: Actor,
) {
  requirePermission(actor, "users:write");
  if (request.method === "GET") {
    const [items] = await db().query<RowDataPacket[]>(
      "SELECT id_usuario,nome,email,perfil,id_profissional,permissoes,ativo FROM Usuario ORDER BY nome LIMIT 500",
    );
    return {
      items,
      total: items.length,
      roles: rolePermissions,
      permissions: validPermissions,
    };
  }
  const id = segments[1] ? Number(segments[1]) : null;
  if (id !== null && (!Number.isSafeInteger(id) || id < 1))
    throw new ClinicError("Usuário inválido.");
  if (!["POST", "PATCH", "DELETE"].includes(request.method))
    throw new ClinicError("Método não permitido.", 405);
  const input =
    request.method === "DELETE"
      ? null
      : userSchema.parse(await jsonBody(request));
  if (!id && !input?.password)
    throw new ClinicError("Senha inicial obrigatória.");
  if (input?.perfil === "profissional" && !input.id_profissional)
    throw new ClinicError("Vincule o profissional.");
  const password = input?.password ? await hashPassword(input.password) : null;
  const conn = await db().getConnection();
  try {
    await conn.beginTransaction();
    const [admins] = await conn.query<RowDataPacket[]>(
      "SELECT id_usuario FROM Usuario WHERE perfil='administrador' AND ativo=1 ORDER BY id_usuario FOR UPDATE",
    );
    if (id) {
      const [old] = await conn.execute<UserRow[]>(
        "SELECT * FROM Usuario WHERE id_usuario=? FOR UPDATE",
        [id],
      );
      if (!old[0]) throw new ClinicError("Usuário não encontrado.", 404);
      if (
        old[0].perfil === "administrador" &&
        old[0].ativo &&
        admins.length === 1 &&
        (!input || input.perfil !== "administrador" || input.ativo === false)
      )
        throw new ClinicError(
          "Mantenha pelo menos um administrador ativo.",
          409,
        );
      if (input)
        await conn.execute(
          "UPDATE Usuario SET nome=?,email=?,perfil=?,id_profissional=?,permissoes=?,ativo=?,senha_hash=COALESCE(?,senha_hash) WHERE id_usuario=?",
          [
            input.nome,
            input.email,
            input.perfil,
            input.id_profissional ?? null,
            input.permissions ? JSON.stringify(input.permissions) : null,
            input.ativo ?? true,
            password,
            id,
          ],
        );
      else
        await conn.execute("UPDATE Usuario SET ativo=0 WHERE id_usuario=?", [
          id,
        ]);
      await conn.execute("DELETE FROM SessaoUsuario WHERE id_usuario=?", [id]);
    } else {
      await conn.execute<ResultSetHeader>(
        "INSERT INTO Usuario(nome,email,senha_hash,perfil,id_profissional,permissoes) VALUES (?,?,?,?,?,?)",
        [
          input!.nome,
          input!.email,
          password,
          input!.perfil,
          input!.id_profissional ?? null,
          input!.permissions ? JSON.stringify(input!.permissions) : null,
        ],
      );
    }
    await conn.execute(
      "INSERT INTO AuditoriaSeguranca(id_usuario,acao,recurso) VALUES (?,?,?)",
      [
        actor.id,
        request.method === "DELETE" ? "usuario_desativado" : "usuario_salvo",
        String(id ?? "novo"),
      ],
    );
    await conn.commit();
    return { ok: true };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}
