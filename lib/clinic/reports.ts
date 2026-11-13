import { rows, type Connection } from "./db";
import { date, assert } from "./validation";
export const reports: Record<string, { sql: string; date: string }> = {
  faturamento: {
    sql: "SELECT r.id_recebimento,r.data,r.tipo,r.valor,r.forma_pagamento,p.id_cliente,c.nome_completo cliente_nome,p.id_pagamento FROM Recebimento r JOIN Parcela pa ON pa.id_parcela=r.id_parcela JOIN Pagamento p ON p.id_pagamento=pa.id_pagamento JOIN Cliente c ON c.id_cliente=p.id_cliente",
    date: "r.data",
  },
  pagamentos: {
    sql: "SELECT p.id_pagamento,p.id_cliente,p.forma_pagamento,p.status,pa.numero_parcela,pa.data_vencimento,pa.valor_parcela,pa.valor_recebido,pa.valor_parcela-pa.valor_recebido valor_pendente FROM Pagamento p JOIN Parcela pa ON pa.id_pagamento=p.id_pagamento",
    date: "pa.data_vencimento",
  },
  comissoes: {
    sql: "SELECT c.*,p.nome profissional FROM Comissao c JOIN Profissional p ON p.id_profissional=c.id_profissional",
    date: "c.data",
  },
  atendimentos: {
    sql: "SELECT t.id_atendimento,t.data_atendimento,t.status,a.id_profissional,a.id_procedimento,a.id_cliente FROM Atendimento t JOIN Agendamento a ON a.id_agendamento=t.id_agendamento",
    date: "t.data_atendimento",
  },
  procedimentos: {
    sql: "SELECT p.nome,COUNT(*) quantidade FROM Atendimento t JOIN Agendamento a ON a.id_agendamento=t.id_agendamento JOIN Procedimento p ON p.id_procedimento=a.id_procedimento WHERE t.status='concluido'",
    date: "t.data_atendimento",
  },
  pacotes: {
    sql: "SELECT pc.*,p.nome FROM PacoteCliente pc JOIN Pacote p ON p.id_pacote=pc.id_pacote",
    date: "pc.data_compra",
  },
  vencimentos: {
    sql: "SELECT pc.id_pacote_cliente,pc.id_cliente,p.nome,pc.data_validade,pc.sessoes_restantes FROM PacoteCliente pc JOIN Pacote p ON p.id_pacote=pc.id_pacote WHERE pc.sessoes_restantes>0",
    date: "pc.data_validade",
  },
  sessoes: {
    sql: "SELECT pc.id_pacote_cliente,pc.id_cliente,p.nome,pc.sessoes_contratadas,pc.sessoes_utilizadas,pc.sessoes_restantes,pc.data_validade FROM PacoteCliente pc JOIN Pacote p ON p.id_pacote=pc.id_pacote",
    date: "pc.data_compra",
  },
  faltas: {
    sql: "SELECT e.id_evento,e.data,e.tipo,e.motivo,a.id_cliente,a.id_profissional,a.id_procedimento FROM EventoAgenda e JOIN Agendamento a ON a.id_agendamento=e.id_agendamento WHERE e.tipo IN ('cancelado','nao_compareceu','remarcado')",
    date: "e.data",
  },
  estoque: {
    sql: "SELECT m.id_movimentacao,m.data,m.tipo,m.quantidade,m.motivo,p.nome,p.numero_lote FROM MovimentacaoEstoque m JOIN Produto p ON p.id_produto=m.id_produto",
    date: "m.data",
  },
  produtos: {
    sql: "SELECT p.id_produto,p.nome,p.numero_lote,p.data_validade,p.quantidade_estoque,p.estoque_minimo FROM Produto p WHERE p.ativo=1",
    date: "p.data_validade",
  },
};
export async function report(
  c: Connection,
  kind: string,
  params: URLSearchParams,
) {
  const spec = reports[kind];
  assert(spec, "Relatório não encontrado", 404);
  let sql = spec.sql;
  const values: unknown[] = [];
  for (const [q, op] of [
    ["from", ">="],
    ["to", "<="],
  ]) {
    if (params.has(q)) {
      sql += `${sql.includes(" WHERE ") ? " AND" : " WHERE"} ${spec.date}${op}?`;
      values.push(date.parse(params.get(q)) + (q === "to" ? " 23:59:59" : ""));
    }
  }
  const filters: Record<string, Record<string, string>> = {
    faturamento: {
      cliente: "p.id_cliente",
      metodo: "p.forma_pagamento",
      status: "r.tipo",
    },
    pagamentos: {
      cliente: "p.id_cliente",
      metodo: "p.forma_pagamento",
      status: "p.status",
    },
    comissoes: { profissional: "c.id_profissional", status: "c.status" },
    atendimentos: {
      profissional: "a.id_profissional",
      procedimento: "a.id_procedimento",
      cliente: "a.id_cliente",
      status: "t.status",
    },
    procedimentos: {
      profissional: "a.id_profissional",
      procedimento: "a.id_procedimento",
    },
    pacotes: {
      cliente: "pc.id_cliente",
      procedimento: "p.id_procedimento",
      status: "pc.status_pagamento",
    },
    vencimentos: {
      cliente: "pc.id_cliente",
      procedimento: "p.id_procedimento",
    },
    sessoes: { cliente: "pc.id_cliente", procedimento: "p.id_procedimento" },
    faltas: {
      cliente: "a.id_cliente",
      profissional: "a.id_profissional",
      procedimento: "a.id_procedimento",
      status: "e.tipo",
    },
    estoque: { status: "m.tipo" },
  };
  for (const [key, col] of Object.entries(filters[kind] || {}))
    if (params.get(key)) {
      sql += `${sql.includes(" WHERE ") ? " AND" : " WHERE"} ${col}=?`;
      values.push(params.get(key)!.slice(0, 80));
    }
  if (kind === "procedimentos")
    sql += " GROUP BY p.id_procedimento,p.nome ORDER BY quantidade DESC";
  else sql += ` ORDER BY ${spec.date} DESC`;
  const items = await rows(c, sql + " LIMIT 5000", values);
  return {
    items,
    columns: items.length ? Object.keys(items[0]) : [],
    limitedTo: 5000,
  };
}
export async function dashboard(c: Connection, params: URLSearchParams) {
  const from = date.parse(
      params.get("from") || new Date().toISOString().slice(0, 7) + "-01",
    ),
    to = date.parse(params.get("to") || new Date().toISOString().slice(0, 10));
  const [totals] = await rows(
    c,
    `SELECT
 (SELECT COUNT(*) FROM Cliente WHERE ativo=1) clientes,
 (SELECT COUNT(*) FROM Agendamento WHERE DATE(DATE_SUB(data_hora_inicio,INTERVAL 3 HOUR))=DATE(DATE_SUB(UTC_TIMESTAMP(),INTERVAL 3 HOUR))) agendamentos_hoje,
 (SELECT COUNT(*) FROM Atendimento WHERE status='concluido' AND data_atendimento>=? AND data_atendimento<DATE_ADD(?,INTERVAL 1 DAY)) atendimentos,
 (SELECT COALESCE(SUM(IF(tipo='recebimento',valor,-valor)),0) FROM Recebimento WHERE data>=? AND data<DATE_ADD(?,INTERVAL 1 DAY)) valor_recebido,
 (SELECT COALESCE(SUM(valor_parcela-valor_recebido),0) FROM Parcela WHERE status='pendente') valor_pendente,
 (SELECT COUNT(*) FROM PacoteCliente WHERE sessoes_restantes>0 AND data_validade>=UTC_DATE() AND status_pagamento<>'estornado') pacotes_ativos,
 (SELECT COUNT(*) FROM Produto WHERE ativo=1 AND quantidade_estoque<=estoque_minimo) estoque_baixo,
 (SELECT COUNT(*) FROM Agendamento WHERE status='nao_compareceu' AND data_hora_inicio>=? AND data_hora_inicio<DATE_ADD(?,INTERVAL 1 DAY)) faltas`,
    [from, to, from, to, from, to],
  );
  const [extra] = await rows(
    c,
    `SELECT
 (SELECT COUNT(*) FROM Agendamento WHERE YEARWEEK(DATE_SUB(data_hora_inicio,INTERVAL 3 HOUR),1)=YEARWEEK(DATE_SUB(UTC_TIMESTAMP(),INTERVAL 3 HOUR),1) AND status IN ('pendente','confirmado','concluido')) agendamentos_semana,
 (SELECT COUNT(*) FROM PacoteCliente WHERE sessoes_restantes>0 AND data_validade BETWEEN UTC_DATE() AND DATE_ADD(UTC_DATE(),INTERVAL 30 DAY)) pacotes_vencendo,
 (SELECT COALESCE(SUM(valor),0) FROM Comissao WHERE status<>'cancelada' AND data>=? AND data<DATE_ADD(?,INTERVAL 1 DAY)) valor_comissoes,
 (SELECT COALESCE(ROUND(100*SUM(status='nao_compareceu')/NULLIF(COUNT(*),0),2),0) FROM Agendamento WHERE status IN ('concluido','nao_compareceu') AND data_hora_inicio>=? AND data_hora_inicio<DATE_ADD(?,INTERVAL 1 DAY)) taxa_faltas_percentual`,
    [from, to, from, to],
  );
  return {
    totals: { ...totals, ...extra },
    procedimentos: (
      await report(c, "procedimentos", new URLSearchParams({ from, to }))
    ).items,
    from,
    to,
  };
}
