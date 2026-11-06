import mysql from "mysql2/promise";
const globalDB = globalThis as unknown as { pool?: mysql.Pool };
export function db() {
  if (!process.env.DATABASE_URL)
    throw new Error("DATABASE_URL não configurada. Consulte o README.");
  if (globalDB.pool) return globalDB.pool;
  globalDB.pool = mysql.createPool({
    uri: process.env.DATABASE_URL,
    connectionLimit: 10,
    dateStrings: true,
    timezone: "Z",
  });
  globalDB.pool.on("connection", (connection) => {
    connection.query("SET time_zone='+00:00'");
  });
  return globalDB.pool;
}
