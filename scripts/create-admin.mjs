import mysql from "mysql2/promise";
import { randomBytes, scrypt } from "node:crypto";
const { DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME } = process.env;
if (
  !DATABASE_URL ||
  !ADMIN_EMAIL ||
  !ADMIN_PASSWORD ||
  ADMIN_PASSWORD.length < 12 ||
  ADMIN_PASSWORD.length > 128
)
  throw new Error(
    "Configure DATABASE_URL, ADMIN_EMAIL e ADMIN_PASSWORD (12 a 128 caracteres).",
  );
const salt = randomBytes(16).toString("hex");
const key = await new Promise((resolve, reject) =>
  scrypt(
    ADMIN_PASSWORD,
    salt,
    64,
    { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 },
    (err, result) => (err ? reject(err) : resolve(result)),
  ),
);
const conn = await mysql.createConnection(DATABASE_URL);
try {
  await conn.execute(
    "INSERT INTO Usuario(nome,email,senha_hash,perfil) VALUES (?,?,?,?)",
    [
      ADMIN_NAME || "Administrador",
      ADMIN_EMAIL.toLowerCase(),
      `scrypt$${salt}$${key.toString("hex")}`,
      "administrador",
    ],
  );
  console.log("Administrador criado. Nenhuma senha foi registrada no log.");
} finally {
  await conn.end();
}
