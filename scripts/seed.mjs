import mysql from "mysql2/promise";
import { randomBytes, scrypt as cryptoScrypt } from "node:crypto";
import { readFile } from "node:fs/promises";
if (process.env.ALLOW_DEMO_SEED !== "true")
  throw Error(
    "Defina ALLOW_DEMO_SEED=true exclusivamente num banco de demonstração vazio.",
  );
const c = await mysql.createConnection({
  uri: process.env.DATABASE_URL,
  multipleStatements: true,
});
const demoPassword = "BellaPelleDemo2026!";
const passwordHash = async () => {
  const salt = randomBytes(16).toString("hex");
  const key = await new Promise((resolve, reject) =>
    cryptoScrypt(
      demoPassword,
      salt,
      64,
      { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 },
      (error, value) => (error ? reject(error) : resolve(value)),
    ),
  );
  return `scrypt$${salt}$${key.toString("hex")}`;
};
function demoCpf(index) {
  const digits = String(900000000 + index).padStart(9, "0").split("").map(Number);
  for (let length = 9; length <= 10; length++) {
    const sum = digits.reduce(
      (total, digit, position) => total + digit * (length + 1 - position),
      0,
    );
    const check = (sum * 10) % 11;
    digits.push(check === 10 ? 0 : check);
  }
  return digits.join("");
}
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
  const hash = await passwordHash();
  for (let i = 1; i <= 10; i++) {
    await c.execute("UPDATE Cliente SET cpf=? WHERE id_cliente=?", [demoCpf(i), i]);
  }
  await c.execute("UPDATE Usuario SET senha_hash=? WHERE senha_hash='demo-password-pending'", [hash]);
  await c.execute("UPDATE ContaCliente SET senha_hash=? WHERE senha_hash='demo-password-pending'", [hash]);
  for (let d = 0; d < 7; d++)
    await c.execute(
      "INSERT INTO Disponibilidade(id_profissional,dia_semana,hora_inicio,hora_fim) SELECT id_profissional,?,'08:00:00','19:00:00' FROM Profissional",
      [d],
    );
  const demoTables = [
    "Cliente", "Profissional", "Procedimento", "Sala", "Equipamento",
    "ProfissionalProcedimento", "Anamnese", "Pacote", "PacoteCliente",
    "Agendamento", "Atendimento", "Produto", "ProdutoAplicado",
    "MovimentacaoEstoque", "Pagamento", "Parcela", "Favorito", "Avaliacao",
    "AgendaConfiguracao", "Auditoria", "Disponibilidade", "Bloqueio",
    "EventoAgenda", "ConsumoSessao", "Comissao", "Recebimento",
    "HistoricoPreco", "Usuario", "AuditoriaSeguranca", "ContaCliente",
    "AuditoriaCliente", "VinculoClinico", "PedidoPrivacidade", "BlogPost",
  ];
  for (const table of demoTables) {
    const [[count]] = await c.query(`SELECT COUNT(*) AS total FROM \`${table}\``);
    if (Number(count.total) < 10)
      throw Error(`Seed incompleto: ${table} tem menos de 10 registros.`);
  }
  console.log(
    `10 conjuntos de dados fictícios carregados. Login de clientes e usuários demo: senha ${demoPassword}. As tabelas de sessão, tokens, limite de acesso, e-mail e fotos clínicas continuam vazias por segurança.`,
  );
} finally {
  await c.end();
}
