import mysql from "mysql2/promise";
const globalDB = globalThis as unknown as { pool?: mysql.Pool };
export function db() {
  if (!process.env.DATABASE_URL)
    throw new Error("DATABASE_URL não configurada. Consulte o README.");
  return (globalDB.pool ??= mysql.createPool({
    uri: process.env.DATABASE_URL,
    connectionLimit: 10,
    dateStrings: true,
    timezone: "Z",
  }));
}
