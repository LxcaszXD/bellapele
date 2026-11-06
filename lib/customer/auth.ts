import { z } from "zod";
import { db } from "../db";
import { rows, exec, transaction } from "../clinic/db";
import {
  hashPassword,
  verifyPassword,
  hashToken,
  randomToken,
  jsonBody,
} from "../clinic/security";
import { rateLimit } from "../clinic/auth";
import { ClinicError } from "../clinic/permissions";
import { validCPF, date, assert } from "../clinic/validation";
import type { RowDataPacket } from "mysql2";
export const COOKIE = "bellapelle_customer";
export type Customer = {
  id: number;
  name: string;
  email: string;
  csrfToken: string;
};
export function cookie(value: string, clear = false) {
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${clear ? 0 : 28800}${process.env.APP_ORIGIN?.startsWith("https://") ? "; Secure" : ""}`;
}
function token(r: Request) {
  return (
    r.headers
      .get("cookie")
      ?.split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith(COOKIE + "="))
      ?.slice(COOKIE.length + 1) || ""
  );
}
export async function customerSession(r: Request): Promise<Customer> {
  const [list] = await db().execute<RowDataPacket[]>(
    "SELECT c.id_cliente,c.nome_completo,c.email,s.csrf_token FROM SessaoPortal s JOIN Cliente c ON c.id_cliente=s.id_cliente WHERE s.token_hash=? AND s.expira_em>UTC_TIMESTAMP() AND c.ativo=1",
    [hashToken(token(r))],
  );
  const c = list[0];
  if (!c) throw new ClinicError("Entre na sua conta para continuar.", 401);
  return {
    id: c.id_cliente,
    name: c.nome_completo,
    email: c.email,
    csrfToken: c.csrf_token,
  };
}
const credentials = z.object({
  email: z
    .email()
    .max(254)
    .transform((s) => s.toLowerCase()),
  password: z.string().min(1).max(128),
});
async function start(id: number) {
  const t = randomToken(),
    csrf = randomToken();
  await db().execute(
    "INSERT INTO SessaoPortal(token_hash,id_cliente,csrf_token,expira_em) VALUES(?,?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 8 HOUR))",
    [hashToken(t), id, csrf],
  );
  return { cookie: cookie(t), csrfToken: csrf };
}
export async function customerLogin(r: Request) {
  const b = credentials.parse(await jsonBody(r));
  await rateLimit("portal:login:" + b.email);
  await rateLimit("portal:login:global", 200);
  const [list] = await db().execute<RowDataPacket[]>(
    "SELECT c.id_cliente,c.ativo,a.senha_hash FROM Cliente c JOIN ContaCliente a ON a.id_cliente=c.id_cliente WHERE c.email=?",
    [b.email],
  );
  const c = list[0];
  const ok = await verifyPassword(
    b.password,
    c?.senha_hash ||
      "scrypt$00000000000000000000000000000000$" + "00".repeat(64),
  );
  if (!c?.ativo || !ok)
    throw new ClinicError("E-mail ou senha inválidos.", 401);
  return start(c.id_cliente);
}
export async function customerRegister(r: Request) {
  await rateLimit("portal:register:global", 60);
  const b = credentials
    .extend({
      password: z.string().min(12).max(128),
      nome_completo: z.string().trim().min(3).max(150),
      cpf: z
        .string()
        .transform((s) => s.replace(/\D/g, ""))
        .refine(validCPF, "CPF inválido"),
      data_nascimento: date,
      telefone: z.string().max(20).optional(),
    })
    .parse(await jsonBody(r));
  assert(
    b.data_nascimento <= new Date().toISOString().slice(0, 10),
    "Nascimento inválido",
  );
  const hash = await hashPassword(b.password);
  try {
    const id = await transaction(async (c) => {
      const result = await exec(
        c,
        "INSERT INTO Cliente(nome_completo,cpf,data_nascimento,email,telefone) VALUES(?,?,?,?,?)",
        [
          b.nome_completo,
          b.cpf,
          b.data_nascimento,
          b.email,
          b.telefone ?? null,
        ],
      );
      await exec(
        c,
        "INSERT INTO ContaCliente(id_cliente,senha_hash) VALUES(?,?)",
        [result.insertId, hash],
      );
      await exec(
        c,
        "INSERT INTO AuditoriaCliente(id_cliente,acao) VALUES(?,'cadastro')",
        [result.insertId],
      );
      return result.insertId;
    });
    return start(id);
  } catch (e) {
    if ((e as { code?: string }).code === "ER_DUP_ENTRY")
      throw new ClinicError(
        "Não foi possível criar a conta. Se já tem cadastro na clínica, use Recuperar / ativar acesso.",
        409,
      );
    throw e;
  }
}
export async function customerForgot(r: Request) {
  const { email } = credentials.pick({ email: true }).parse(await jsonBody(r));
  await rateLimit("portal:forgot:" + email, 5);
  await rateLimit("portal:forgot:global", 100);
  await transaction(async (c) => {
    const [client] = await rows(
      c,
      "SELECT id_cliente FROM Cliente WHERE email=? AND ativo=1",
      [email],
    );
    if (client) {
      const t = randomToken();
      await exec(
        c,
        "UPDATE TokenPortal SET utilizado_em=UTC_TIMESTAMP() WHERE id_cliente=? AND utilizado_em IS NULL",
        [client.id_cliente],
      );
      await exec(
        c,
        "INSERT INTO TokenPortal(token_hash,id_cliente,expira_em) VALUES(?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 30 MINUTE))",
        [hashToken(t), client.id_cliente],
      );
      await exec(
        c,
        "INSERT INTO EmailOutbox(destinatario,assunto,conteudo) VALUES(?,?,?)",
        [
          email,
          "Seu acesso à BellaPelle",
          `${process.env.APP_ORIGIN}/portal?reset=${t}`,
        ],
      );
    }
  });
  return {
    message:
      "Se houver um cadastro ativo, as instruções serão encaminhadas ao e-mail cadastrado.",
  };
}
export async function customerReset(r: Request) {
  await rateLimit("portal:reset:global", 100);
  const b = z
    .object({
      token: z.string().min(32).max(128),
      password: z.string().min(12).max(128),
    })
    .parse(await jsonBody(r));
  const hash = await hashPassword(b.password);
  await transaction(async (c) => {
    const [t] = await rows(
      c,
      "SELECT t.* FROM TokenPortal t JOIN Cliente c ON c.id_cliente=t.id_cliente WHERE t.token_hash=? AND t.utilizado_em IS NULL AND t.expira_em>UTC_TIMESTAMP() AND c.ativo=1 FOR UPDATE",
      [hashToken(b.token)],
    );
    assert(t, "Link inválido ou expirado");
    await exec(
      c,
      "INSERT INTO ContaCliente(id_cliente,senha_hash) VALUES(?,?) ON DUPLICATE KEY UPDATE senha_hash=?",
      [t.id_cliente, hash, hash],
    );
    await exec(
      c,
      "UPDATE TokenPortal SET utilizado_em=UTC_TIMESTAMP() WHERE id_cliente=? AND utilizado_em IS NULL",
      [t.id_cliente],
    );
    await exec(c, "DELETE FROM SessaoPortal WHERE id_cliente=?", [
      t.id_cliente,
    ]);
  });
  return { message: "Senha definida. Entre na sua conta." };
}
export async function customerLogout(r: Request) {
  await db().execute("DELETE FROM SessaoPortal WHERE token_hash=?", [
    hashToken(token(r)),
  ]);
  return cookie("", true);
}
