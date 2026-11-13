import mysql from "mysql2/promise";
import { readFile } from "node:fs/promises";
if (!process.env.DATABASE_URL)
  throw new Error("Defina DATABASE_URL em .env.local");
const connection = await mysql.createConnection({
  uri: process.env.DATABASE_URL,
  multipleStatements: true,
});
try {
  const [tables] = await connection.query(
    "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()",
  );
  const names = tables.map((t) => t.TABLE_NAME);
  if (process.argv.includes("--migrate")) {
    for (const name of [
      "Cliente",
      "Procedimento",
      "ProfissionalProcedimento",
      "Agendamento",
      "Pagamento",
      "Parcela",
      "Favorito",
      "Avaliacao",
    ])
      if (!names.includes(name))
        throw new Error(
          "Tabela ausente: " +
            name +
            ". Importe BellaPelle-MySQL.sql primeiro.",
        );
  } else {
    if (names.length)
      throw new Error(
        "O banco já contém tabelas. Para o modelo novo existente, use npm run db:migrate. Para instalação nova, use um banco vazio.",
      );
    await connection.query(
      await readFile(
        new URL("../database/schema.sql", import.meta.url),
        "utf8",
      ),
    );
  }
  await connection.query(
    await readFile(new URL("../database/002-api.sql", import.meta.url), "utf8"),
  );
  console.log("Banco do modelo e extensões da API disponíveis.");
} finally {
  await connection.end();
}
