import {
  randomBytes,
  createHash,
  scrypt as cryptoScrypt,
  timingSafeEqual,
} from "node:crypto";
import { ClinicError } from "./permissions";
export const hashToken = (s: string) =>
  createHash("sha256").update(s).digest("hex");
export const randomToken = () => randomBytes(32).toString("base64url");
const derive = (password: string, salt: string) =>
  new Promise<Buffer>((resolve, reject) =>
    cryptoScrypt(
      password,
      salt,
      64,
      { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 },
      (e, b) => (e ? reject(e) : resolve(b)),
    ),
  );
export async function hashPassword(password: string) {
  if (password.length < 12 || password.length > 128)
    throw new ClinicError("A senha deve ter entre 12 e 128 caracteres.");
  const salt = randomBytes(16).toString("hex");
  return `scrypt$${salt}$${(await derive(password, salt)).toString("hex")}`;
}
export async function verifyPassword(password: string, encoded: string) {
  const [scheme, salt, key] = encoded.split("$");
  if (scheme !== "scrypt" || !salt || !key || password.length > 128)
    return false;
  const actual = await derive(password, salt);
  const expected = Buffer.from(key, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export function assertOrigin(request: Request) {
  const configured = process.env.APP_ORIGIN;
  if (!configured)
    throw new ClinicError("APP_ORIGIN não configurada.", 503, "CONFIGURATION");
  if (request.headers.get("origin") !== new URL(configured).origin)
    throw new ClinicError("Origem não autorizada.", 403, "ORIGIN");
}
export function assertCsrf(request: Request, expected: string) {
  const received = request.headers.get("x-csrf-token") || "";
  const a = Buffer.from(received),
    b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b))
    throw new ClinicError("Sessão expirada. Atualize a página.", 403, "CSRF");
}
export async function limitedBody(request: Request, max: number) {
  if (Number(request.headers.get("content-length") || 0) > max)
    throw new ClinicError("Requisição muito grande.", 413);
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > max) {
        await reader.cancel();
        throw new ClinicError("Requisição muito grande.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const part of chunks) {
    bytes.set(part, offset);
    offset += part.length;
  }
  return bytes;
}
export async function jsonBody(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new ClinicError("Envie JSON.", 415);
  const text = new TextDecoder().decode(await limitedBody(request, 65536));
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ClinicError("JSON inválido.");
  }
}
