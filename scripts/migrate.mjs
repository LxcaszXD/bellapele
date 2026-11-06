import mysql from "mysql2/promise";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
if (!process.env.DATABASE_URL)
  throw Error("Configure DATABASE_URL. Execute npm run env:init.");
const c = await mysql.createConnection({
  uri: process.env.DATABASE_URL,
  multipleStatements: true,
  timezone: "Z",
});
try {
  const [[lock]] = await c.query(
    "SELECT GET_LOCK('bellapelle_migrations',30) AS acquired",
  );
  if (lock.acquired !== 1) throw Error("Outra migração está em execução.");
  await c.query("SET time_zone='+00:00'");
  await c.query(
    `CREATE TABLE IF NOT EXISTS SchemaMigration (version VARCHAR(80) PRIMARY KEY,checksum CHAR(64) NOT NULL,state ENUM('running','applied') NOT NULL,applied_at DATETIME NULL)`,
  );
  for (const name of [
    "001-base.sql",
    "002-api.sql",
    "003-clinic.sql",
    "004-security.sql",
    "005-portal.sql",
  ]) {
    const sql = await readFile(
      new URL("../database/" + name, import.meta.url),
      "utf8",
    );
    const checksum = createHash("sha256").update(sql).digest("hex");
    const [[old]] = await c.execute(
      "SELECT * FROM SchemaMigration WHERE version=?",
      [name],
    );
    if (old) {
      if (old.state !== "applied")
        throw Error(
          `Migração ${name} interrompida. Restaure o backup ou revise o DDL antes de retomar; veja docs/OPERACAO.md.`,
        );
      if (old.checksum !== checksum)
        throw Error(`Migração ${name} alterada após aplicação.`);
      continue;
    }
    if (name === "001-base.sql") {
      const [[table]] = await c.query(
        "SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='Cliente'",
      );
      if (table.n) {
        await c.execute(
          "INSERT INTO SchemaMigration VALUES (?,?,'applied',UTC_TIMESTAMP())",
          [name, checksum],
        );
        console.log("001: base v3 existente adotada, sem excluir registros.");
        continue;
      }
    }
    await c.execute(
      "INSERT INTO SchemaMigration(version,checksum,state) VALUES (?,?,'running')",
      [name, checksum],
    );
    await c.query(sql);
    await c.execute(
      "UPDATE SchemaMigration SET state='applied',applied_at=UTC_TIMESTAMP() WHERE version=?",
      [name],
    );
    console.log("Aplicada:", name);
  }
} finally {
  await c.query("SELECT RELEASE_LOCK('bellapelle_migrations')").catch(() => {});
  await c.end();
}
