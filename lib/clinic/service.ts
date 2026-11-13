import { z } from "zod";
import { resources, resource, type Resource } from "./catalog";
import {
  type Actor,
  requirePermission,
  hasPermission,
  ClinicError,
} from "./permissions";
import { transaction, rows, exec, audit, lock, type Connection } from "./db";
import { jsonBody } from "./security";
import { id, validCPF, utc, cents, date, assert } from "./validation";
import { operate, operationPermission } from "./operations";
import { report, dashboard } from "./reports";
const permission = (r: Resource, action: string) =>
  `${r.permission || r.key}:${action}`;
function scope(r: Resource, a: Actor) {
  if (a.perfil !== "profissional")
    return { sql: "1=1", values: [] as unknown[] };
  const p = a.id_profissional;
  if (!p) throw new ClinicError("Usuário sem profissional vinculado.", 403);
  if (
    [
      "agendamentos",
      "anamneses",
      "disponibilidades",
      "habilitacoes",
      "comissoes",
    ].includes(r.key)
  )
    return { sql: "t.id_profissional=?", values: [p] };
  if (r.key === "clientes")
    return {
      sql: "(EXISTS (SELECT 1 FROM Agendamento s WHERE s.id_cliente=t.id_cliente AND s.id_profissional=?) OR EXISTS (SELECT 1 FROM VinculoClinico v WHERE v.id_cliente=t.id_cliente AND v.id_profissional=? AND v.ativo=1))",
      values: [p, p],
    };
  if (r.key === "atendimentos" || r.key === "faltas")
    return {
      sql: "EXISTS (SELECT 1 FROM Agendamento s WHERE s.id_agendamento=t.id_agendamento AND s.id_profissional=?)",
      values: [p],
    };
  if (r.key === "pacotes-clientes")
    return {
      sql: "(EXISTS (SELECT 1 FROM Agendamento s WHERE s.id_cliente=t.id_cliente AND s.id_profissional=?) OR EXISTS (SELECT 1 FROM VinculoClinico v WHERE v.id_cliente=t.id_cliente AND v.id_profissional=? AND v.ativo=1))",
      values: [p, p],
    };
  return { sql: "1=1", values: [] as unknown[] };
}
function parse(r: Resource, input: unknown) {
  const shape: Record<string, z.ZodType> = {};
  for (const f of r.fields) {
    let s: z.ZodType;
    if (f.type === "boolean") s = z.boolean();
    else if (f.type === "reference") s = id;
    else if (f.type === "number")
      s = z.coerce.number().int().min(0).max(1000000);
    else if (f.type === "money" || f.type === "decimal")
      s = z.string().regex(/^\d{1,8}(\.\d{1,3})?$/);
    else if (f.type === "date") s = date;
    else if (f.type === "email") s = z.email().max(254);
    else if (f.type === "time")
      s = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:00)?$/);
    else if (f.options)
      s = z.enum(f.options.map((o) => o.value) as [string, ...string[]]);
    else
      s = z
        .string()
        .trim()
        .min(f.required ? 1 : 0)
        .max(f.type === "textarea" ? 10000 : 255);
    shape[f.name] = f.required ? s : s.nullish();
  }
  const data = z.object(shape).strict().parse(input) as Record<string, unknown>;
  for (const f of r.fields) {
    if (data[f.name] != null && f.type === "datetime-local")
      data[f.name] = utc(data[f.name]);
    if (data[f.name] != null && f.type === "money") cents(data[f.name]);
    if (data[f.name] === undefined)
      data[f.name] = f.type === "boolean" ? false : null;
  }
  if (r.key === "clientes") {
    data.cpf = String(data.cpf).replace(/\D/g, "");
    assert(validCPF(String(data.cpf)), "CPF inválido");
    assert(
      String(data.data_nascimento) <= new Date().toISOString().slice(0, 10),
      "Nascimento não pode ser futuro",
    );
  }
  if (r.key === "procedimentos")
    assert(Number(data.duracao_minutos) <= 1440, "Duração máxima: 24 horas");
  if (r.key === "habilitacoes")
    assert(
      Number(data.percentual_comissao) <= 100,
      "Comissão deve ser de 0 a 100%",
    );
  if (r.key === "anamneses" && data.fototipo_fitzpatrick != null)
    assert(Number(data.fototipo_fitzpatrick) <= 6, "Fototipo de 1 a 6");
  if (r.key === "disponibilidades")
    assert(
      String(data.hora_fim) > String(data.hora_inicio),
      "Intervalo inválido",
    );
  if (r.key === "bloqueios") {
    assert(
      data.id_profissional || data.id_sala || data.id_equipamento,
      "Selecione ao menos um recurso",
    );
    assert(String(data.fim) > String(data.inicio), "Intervalo inválido");
  }
  return data;
}
async function entity(
  c: Connection,
  r: Resource,
  request: Request,
  segments: string[],
  actor: Actor,
) {
  const where = scope(r, actor),
    params = new URL(request.url).searchParams;
  const key = segments[1] ? id.parse(segments[1]) : null;
  const columns = [
    r.pk,
    ...r.fields.map((f) => f.name),
    ...(r.active ? ["ativo"] : []),
    ...(r.key === "produtos" ? ["quantidade_estoque"] : []),
  ];
  const select =
    columns.map((k) => `t.\`${k}\``).join(",") +
    (r.key === "agendamentos"
      ? ",(SELECT nome_completo FROM Cliente cl WHERE cl.id_cliente=t.id_cliente) cliente_nome,(SELECT nome FROM Profissional pr WHERE pr.id_profissional=t.id_profissional) profissional_nome,(SELECT nome FROM Procedimento pr WHERE pr.id_procedimento=t.id_procedimento) procedimento_nome,(SELECT nome FROM Sala sl WHERE sl.id_sala=t.id_sala) sala_nome,(SELECT nome FROM PacoteCliente pcx JOIN Pacote pk ON pk.id_pacote=pcx.id_pacote WHERE pcx.id_pacote_cliente=t.id_pacote_cliente) pacote_nome,COALESCE((SELECT status FROM Pagamento pg WHERE pg.id_agendamento=t.id_agendamento ORDER BY pg.id_pagamento DESC LIMIT 1),(SELECT status_pagamento FROM PacoteCliente pcx WHERE pcx.id_pacote_cliente=t.id_pacote_cliente)) pagamento_status,COALESCE((SELECT forma_pagamento FROM Pagamento pg WHERE pg.id_agendamento=t.id_agendamento ORDER BY pg.id_pagamento DESC LIMIT 1),(SELECT forma_pagamento FROM Pagamento pg WHERE pg.id_pacote_cliente=t.id_pacote_cliente ORDER BY pg.id_pagamento DESC LIMIT 1)) forma_pagamento,(SELECT COALESCE(SUM(pa.valor_recebido),0) FROM Pagamento pg JOIN Parcela pa ON pa.id_pagamento=pg.id_pagamento WHERE pg.id_agendamento=t.id_agendamento OR (t.id_pacote_cliente IS NOT NULL AND pg.id_pacote_cliente=t.id_pacote_cliente)) valor_recebido"
      : r.key === "pagamentos"
        ? ",(SELECT nome_completo FROM Cliente cl WHERE cl.id_cliente=t.id_cliente) cliente_nome,COALESCE((SELECT CONCAT('Plano · ',p.nome) FROM PacoteCliente pc JOIN Pacote p ON p.id_pacote=pc.id_pacote WHERE pc.id_pacote_cliente=t.id_pacote_cliente),(SELECT CONCAT('Agendamento · ',pr.nome) FROM Agendamento a JOIN Procedimento pr ON pr.id_procedimento=a.id_procedimento WHERE a.id_agendamento=t.id_agendamento)) destino,(SELECT COALESCE(SUM(pa.valor_recebido),0) FROM Parcela pa WHERE pa.id_pagamento=t.id_pagamento) valor_recebido,t.valor_total-(SELECT COALESCE(SUM(pa.valor_recebido),0) FROM Parcela pa WHERE pa.id_pagamento=t.id_pagamento) saldo_pendente"
        : r.key === "parcelas"
          ? ",(SELECT nome_completo FROM Cliente cl JOIN Pagamento pg ON pg.id_cliente=cl.id_cliente WHERE pg.id_pagamento=t.id_pagamento) cliente_nome,(SELECT COALESCE((SELECT CONCAT('Plano · ',p.nome) FROM PacoteCliente pc JOIN Pacote p ON p.id_pacote=pc.id_pacote WHERE pc.id_pacote_cliente=pg.id_pacote_cliente),(SELECT CONCAT('Agendamento · ',pr.nome) FROM Agendamento a JOIN Procedimento pr ON pr.id_procedimento=a.id_procedimento WHERE a.id_agendamento=pg.id_agendamento)) FROM Pagamento pg WHERE pg.id_pagamento=t.id_pagamento) destino"
          : "");
  if (request.method === "GET") {
    const clauses = [where.sql],
      values = [...where.values];
    if (key) {
      clauses.push(`t.${r.pk}=?`);
      values.push(key);
    }
    const search = params.get("search");
    if (search) {
      const searchable = r.fields
        .filter((f) => ["text", "email", "textarea"].includes(f.type))
        .map((f) => f.name);
      if (searchable.length) {
        clauses.push(
          `(${searchable.map((k) => `t.\`${k}\` LIKE ?`).join(" OR ")})`,
        );
        values.push(...searchable.map(() => `%${search.slice(0, 100)}%`));
      }
    }
    for (const [q, col] of [
      ["cliente", "id_cliente"],
      ["profissional", "id_profissional"],
      ["sala", "id_sala"],
      ["procedimento", "id_procedimento"],
      ["status", "status"],
    ])
      if (params.has(q) && columns.includes(col)) {
        clauses.push(`t.${col}=?`);
        values.push(params.get(q));
      }
    if (params.has("cliente") && ["atendimentos", "faltas"].includes(r.key)) {
      clauses.push(
        "EXISTS (SELECT 1 FROM Agendamento s WHERE s.id_agendamento=t.id_agendamento AND s.id_cliente=?)",
      );
      values.push(id.parse(params.get("cliente")));
    }
    if (r.date)
      for (const [q, operator] of [
        ["from", ">="],
        ["to", "<="],
      ])
        if (params.has(q)) {
          clauses.push(`t.${r.date}${operator}?`);
          values.push(
            date.parse(params.get(q)) + (q === "to" ? " 23:59:59" : ""),
          );
        }
    const page = z.coerce
        .number()
        .int()
        .min(1)
        .max(100000)
        .parse(params.get("page") || 1),
      pageSize = z.coerce
        .number()
        .int()
        .min(1)
        .max(100)
        .parse(params.get("pageSize") || 20);
    const sort = columns.includes(params.get("sort") || "")
      ? params.get("sort")!
      : r.pk;
    const direction = params.get("direction") === "asc" ? "ASC" : "DESC";
    const items = await rows(
      c,
      `SELECT ${select} FROM ${r.table} t WHERE ${clauses.join(" AND ")} ORDER BY t.\`${sort}\` ${direction} LIMIT ? OFFSET ?`,
      [...values, key ? 1 : pageSize, key ? 0 : (page - 1) * pageSize],
    );
    if (r.permission === "clinical")
      await audit(c, actor.id, "consulta", r.key, key);
    if (key) {
      assert(items[0], "Registro não encontrado", 404);
      return items[0];
    }
    const [count] = await rows(
      c,
      `SELECT COUNT(*) total FROM ${r.table} t WHERE ${clauses.join(" AND ")}`,
      values,
    );
    return { items, total: Number(count.total), page, pageSize };
  }
  assert(!r.readonly, "Use a operação de negócio correspondente", 405);
  await lock(c);
  if (key) {
    const existing = await rows(
      c,
      `SELECT t.${r.pk} FROM ${r.table} t WHERE t.${r.pk}=? AND ${where.sql} FOR UPDATE`,
      [key, ...where.values],
    );
    assert(existing.length, "Registro não encontrado", 404);
  }
  if (request.method === "DELETE") {
    assert(!r.singleton, "Esta configuração não pode ser removida", 405);
    assert(key && r.active, "Exclusão não permitida", 405);
    await exec(c, `UPDATE ${r.table} SET ativo=0 WHERE ${r.pk}=?`, [key]);
  } else {
    assert(
      (request.method === "POST" && !key) ||
        (request.method === "PATCH" && key),
      "Método não permitido",
      405,
    );
    assert(
      !(key && r.appendOnly),
      "Crie uma nova avaliação para preservar o histórico",
      405,
    );
    if (r.singleton)
      assert(
        request.method === "PATCH" && key === 1,
        "Edite a configuração existente",
        405,
      );
    const data = parse(r, await jsonBody(request));
    if (r.key === "politica-faltas") {
      assert(key === 1, "Edite a política existente", 405);
      data.id_autor = actor.id;
      data.atualizado_em = new Date();
    }
    if (r.key === "agenda-portal") {
      const enabled = await rows(
        c,
        "SELECT 1 FROM ProfissionalProcedimento WHERE id_profissional=? AND id_procedimento=? AND ativo=1",
        [data.id_profissional, data.id_procedimento],
      );
      assert(enabled.length, "Profissional não habilitado");
      assert(
        !key || key === Number(data.id_procedimento),
        "Não altere o identificador do procedimento",
      );
    }

    if (r.key === "anamneses") {
      if (actor.perfil === "profissional") {
        assert(
          Number(data.id_profissional) === actor.id_profissional,
          "Profissional não autorizado",
          403,
        );
        const authorized = await rows(
          c,
          "SELECT 1 FROM Agendamento WHERE id_cliente=? AND id_profissional=? UNION SELECT 1 FROM VinculoClinico WHERE id_cliente=? AND id_profissional=? AND ativo=1 LIMIT 1",
          [
            data.id_cliente,
            actor.id_profissional,
            data.id_cliente,
            actor.id_profissional,
          ],
        );
        assert(authorized.length, "Cliente não vinculado à sua agenda", 403);
      }
      data.id_autor = actor.id;
    }
    if (r.key === "produtos" && data.estoque_minimo === null)
      data.estoque_minimo = "0";
    const keys = Object.keys(data),
      values = Object.values(data);
    if (key)
      await exec(
        c,
        `UPDATE ${r.table} SET ${keys.map((k) => `\`${k}\`=?`).join(",")} WHERE ${r.pk}=?`,
        [...values, key],
      );
    else {
      const created = await exec(
        c,
        `INSERT INTO ${r.table} (${keys.map((k) => `\`${k}\``).join(",")}) VALUES (${keys.map(() => "?").join(",")})`,
        values,
      );
      data[r.pk] = data[r.pk] || created.insertId;
    }
    const resultId = key || Number(data[r.pk]);
    if (r.key === "procedimentos")
      await exec(
        c,
        "INSERT INTO HistoricoPreco(id_procedimento,valor,id_autor) VALUES(?,?,?)",
        [resultId, data.valor_avulso, actor.id],
      );
    await audit(c, actor.id, key ? "atualizar" : "criar", r.key, resultId);
    return { [r.pk]: resultId };
  }
  await audit(c, actor.id, "desativar", r.key, key);
  return { ok: true };
}
export async function dispatchClinic(
  request: Request,
  segments: string[],
  actor: Actor,
): Promise<unknown> {
  if (segments[0] === "meta" && request.method === "GET")
    return {
      resources: resources
        .filter((r) => hasPermission(actor, permission(r, "read")))
        .map(({ table: _table, permission: _, ...r }) => ({
          ...r,
          writable:
            !r.readonly &&
            hasPermission(actor, permission(resource(r.key)!, "write")),
        })),
    };
  if (segments[0] === "operations" && request.method === "POST") {
    requirePermission(actor, operationPermission(segments[1]));
    const input = await jsonBody(request);
    return transaction((c) => operate(c, segments[1], input, actor));
  }
  if (segments[0] === "reports" && request.method === "GET") {
    requirePermission(actor, "reports:read");
    requirePermission(actor, "finance:read");
    return transaction((c) =>
      report(c, segments[1], new URL(request.url).searchParams),
    );
  }
  if (segments[0] === "dashboard" && request.method === "GET") {
    requirePermission(actor, "finance:read");
    return transaction((c) => dashboard(c, new URL(request.url).searchParams));
  }
  const r = resource(segments[0]);
  if (!r || segments.length > 2)
    throw new ClinicError("Rota não encontrada", 404);
  requirePermission(
    actor,
    permission(r, request.method === "GET" ? "read" : "write"),
  );
  return transaction((c) => entity(c, r, request, segments, actor));
}
