import mysql from "mysql2/promise";
import { readFile } from "node:fs/promises";
if (process.env.ALLOW_DEMO_SEED !== "true")
  throw Error(
    "Defina ALLOW_DEMO_SEED=true exclusivamente num banco de demonstração vazio.",
  );
const c = await mysql.createConnection({
  uri: process.env.DATABASE_URL,
  multipleStatements: true,
});
try {
  const [[row]] = await c.query("SELECT COUNT(*) n FROM Cliente");
  if (row.n)
    throw Error(
      "Seed recusado: já existem clientes; nenhum dado foi alterado.",
    );
  await c.query("SET time_zone='+00:00'");
  await c.query(
    await readFile(new URL("../database/demo.sql", import.meta.url), "utf8"),
  );
  await c.query(
    await readFile(new URL("../database/002-api.sql", import.meta.url), "utf8"),
  );
  await c.query(
    "UPDATE Parcela SET valor_recebido=valor_parcela WHERE status='paga'",
  );
  for (let i = 1; i <= 5; i++) {
    let base = "90000000" + i;
    for (let len = 9; len <= 10; len++) {
      let sum = 0;
      for (let j = 0; j < len; j++) sum += Number(base[j]) * (len + 1 - j);
      const digit = (sum * 10) % 11;
      base += digit === 10 ? 0 : digit;
    }
    await c.execute("UPDATE Cliente SET cpf=? WHERE id_cliente=?", [base, i]);
  }
  for (let d = 0; d < 7; d++)
    await c.execute(
      "INSERT INTO Disponibilidade(id_profissional,dia_semana,hora_inicio,hora_fim) SELECT id_profissional,?,'08:00:00','19:00:00' FROM Profissional",
      [d],
    );
  console.log(
    "Exemplos fictícios carregados. Produtos têm saldo histórico zero; registre entradas antes de consumir.",
  );
} finally {
  await c.end();
}
