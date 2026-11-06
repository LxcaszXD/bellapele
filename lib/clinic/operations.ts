import { z } from "zod";
import type { Actor } from "./permissions";
import { rows, exec, lock, audit, type Connection, type Row } from "./db";
import {
  id,
  date,
  utc,
  assert,
  cents,
  money,
  installments,
  quantity,
} from "./validation";
const method = z.enum(["pix", "cartao_credito", "cartao_debito", "dinheiro"]);
async function one(c: Connection, table: string, pk: string, value: number) {
  const [r] = await rows(c, `SELECT * FROM ${table} WHERE ${pk}=? FOR UPDATE`, [
    value,
  ]);
  assert(r, "Registro não encontrado", 404);
  return r;
}
function owned(a: Actor, r: Row) {
  if (a.perfil === "profissional")
    assert(
      Number(r.id_profissional) === a.id_profissional,
      "Acesso negado",
      403,
    );
}
export async function available(
  c: Connection,
  b: Record<string, unknown>,
  start: string,
  end: string,
  except = 0,
) {
  for (const [t, k] of [
    ["Cliente", "id_cliente"],
    ["Profissional", "id_profissional"],
    ["Sala", "id_sala"],
    ["Equipamento", "id_equipamento"],
  ])
    if (b[k]) {
      const r = await one(c, t, k, Number(b[k]));
      assert(r.ativo, "Cadastro inativo");
    }
  const [h] = await rows(
    c,
    "SELECT * FROM ProfissionalProcedimento WHERE id_profissional=? AND id_procedimento=? AND ativo=1",
    [b.id_profissional, b.id_procedimento],
  );
  assert(h, "Profissional não habilitado");
  const conflicts = await rows(
    c,
    `SELECT id_agendamento FROM Agendamento WHERE id_agendamento<>? AND status IN ('pendente','confirmado') AND data_hora_inicio<? AND data_hora_fim>? AND (id_cliente=? OR id_profissional=? OR id_sala=? OR (? IS NOT NULL AND id_equipamento=?)) LIMIT 1`,
    [
      except,
      end,
      start,
      b.id_cliente,
      b.id_profissional,
      b.id_sala,
      b.id_equipamento ?? null,
      b.id_equipamento ?? null,
    ],
  );
  assert(
    !conflicts.length,
    "Conflito de horário para cliente, profissional, sala ou equipamento",
    409,
  );
  const blocks = await rows(
    c,
    "SELECT id_bloqueio FROM Bloqueio WHERE ativo=1 AND inicio<? AND fim>? AND (id_profissional=? OR id_sala=? OR id_equipamento=?) LIMIT 1",
    [end, start, b.id_profissional, b.id_sala, b.id_equipamento ?? null],
  );
  assert(!blocks.length, "Recurso indisponível no período", 409);
  const schedules = await rows(
    c,
    "SELECT * FROM Disponibilidade WHERE id_profissional=? AND ativo=1",
    [b.id_profissional],
  );
  if (schedules.length) {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    const parts = (v: string) =>
      Object.fromEntries(
        fmt
          .formatToParts(new Date(v.replace(" ", "T") + "Z"))
          .map((p) => [p.type, p.value]),
      );
    const a = parts(start),
      z = parts(end),
      day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
        a.weekday,
      );
    assert(
      schedules.some(
        (s) =>
          Number(s.dia_semana) === day &&
          a.weekday === z.weekday &&
          `${a.hour}:${a.minute}:00` >= String(s.hora_inicio) &&
          `${z.hour}:${z.minute}:00` <= String(s.hora_fim),
      ),
      "Fora da disponibilidade do profissional",
      409,
    );
  }
  if (b.id_pacote_cliente) {
    const p = await one(
      c,
      "PacoteCliente",
      "id_pacote_cliente",
      Number(b.id_pacote_cliente),
    );
    const pack = await one(c, "Pacote", "id_pacote", Number(p.id_pacote));
    assert(
      Number(p.id_cliente) === Number(b.id_cliente) &&
        Number(pack.id_procedimento) === Number(b.id_procedimento),
      "Pacote incompatível",
    );
    assert(
      Number(p.sessoes_restantes) > 0 &&
        String(p.data_validade) >= start.slice(0, 10) &&
        p.status_pagamento !== "estornado",
      "Pacote vencido, estornado ou sem saldo",
      409,
    );
    const reserved = await rows(
      c,
      "SELECT COUNT(*) n FROM Agendamento WHERE id_pacote_cliente=? AND status IN ('pendente','confirmado') AND id_agendamento<>?",
      [b.id_pacote_cliente, except],
    );
    assert(
      Number(reserved[0].n) < Number(p.sessoes_restantes),
      "Todas as sessões restantes estão reservadas",
      409,
    );
  }
}
async function payment(
  c: Connection,
  b: {
    id_cliente: number;
    id_pacote_cliente?: number;
    id_agendamento?: number;
    forma_pagamento: string;
    numero_parcelas: number;
    data_vencimento: string;
  },
  total: number,
) {
  const values = installments(total, b.numero_parcelas);
  const p = await exec(
    c,
    "INSERT INTO Pagamento(id_cliente,id_pacote_cliente,id_agendamento,forma_pagamento,valor_total,numero_parcelas) VALUES(?,?,?,?,?,?)",
    [
      b.id_cliente,
      b.id_pacote_cliente ?? null,
      b.id_agendamento ?? null,
      b.forma_pagamento,
      money(total),
      b.numero_parcelas,
    ],
  );
  for (let i = 0; i < values.length; i++)
    await exec(
      c,
      "INSERT INTO Parcela(id_pagamento,numero_parcela,valor_parcela,data_vencimento) VALUES(?,?,?,DATE_ADD(?,INTERVAL ? MONTH))",
      [p.insertId, i + 1, money(values[i]), b.data_vencimento, i],
    );
  return p.insertId;
}
export function operationPermission(name: string) {
  if (
    [
      "vender-pacote",
      "receber-parcela",
      "estornar-pagamento",
      "cancelar-pagamento",
      "pagar-comissao",
      "pagamento-avulso",
    ].includes(name)
  )
    return "finance:write";
  if (name === "movimentar-estoque") return "stock:write";
  if (name.includes("atendimento")) return "clinical:write";
  return "agendamentos:write";
}
export async function operate(
  c: Connection,
  name: string,
  input: unknown,
  actor: Actor,
) {
  await lock(c);
  let result: Record<string, unknown> = { ok: true };
  if (name === "vender-pacote") {
    const b = z
      .object({
        id_cliente: id,
        id_pacote: id,
        numero_parcelas: z.coerce.number().int().min(1).max(48),
        forma_pagamento: method,
        data_compra: date,
        data_vencimento: date,
      })
      .parse(input);
    const p = await one(c, "Pacote", "id_pacote", b.id_pacote);
    assert(p.ativo, "Pacote inativo");
    assert(
      (await one(c, "Cliente", "id_cliente", b.id_cliente)).ativo,
      "Cliente inativo",
    );
    const r = await exec(
      c,
      "INSERT INTO PacoteCliente(id_cliente,id_pacote,data_compra,data_validade,sessoes_contratadas,valor_contratado) VALUES(?,?,?,DATE_ADD(?,INTERVAL ? MONTH),?,?)",
      [
        b.id_cliente,
        b.id_pacote,
        b.data_compra,
        b.data_compra,
        p.validade_meses,
        p.quantidade_sessoes,
        p.valor_total,
      ],
    );
    const id_pagamento = await payment(
      c,
      { ...b, id_pacote_cliente: r.insertId },
      cents(p.valor_total),
    );
    result = { id_pacote_cliente: r.insertId, id_pagamento };
  } else if (name === "agendar" || name === "reagendar") {
    const edit = name === "reagendar";
    const b = edit
      ? z
          .object({
            id_agendamento: id,
            data_hora_inicio: z.string(),
            motivo: z.string().min(3).max(500),
          })
          .parse(input)
      : z
          .object({
            id_cliente: id,
            id_profissional: id,
            id_procedimento: id,
            id_sala: id,
            id_equipamento: id.nullish(),
            id_pacote_cliente: id.nullish(),
            data_hora_inicio: z.string(),
            origem_solicitacao: z
              .enum(["aplicativo", "recepcao", "telefone", "whatsapp"])
              .default("recepcao"),
          })
          .parse(input);
    const old = edit
      ? await one(
          c,
          "Agendamento",
          "id_agendamento",
          Number("id_agendamento" in b ? b.id_agendamento : 0),
        )
      : null;
    if (old) {
      owned(actor, old);
      assert(
        ["pendente", "confirmado"].includes(String(old.status)),
        "Agendamento não pode ser remarcado",
        409,
      );
    }
    const data: Record<string, unknown> = { ...old, ...b };
    owned(actor, data as Row);
    const proc = await one(
      c,
      "Procedimento",
      "id_procedimento",
      Number(data.id_procedimento),
    );
    assert(proc.ativo, "Procedimento inativo");
    const start = utc(b.data_hora_inicio);
    assert(
      Date.parse(start.replace(" ", "T") + "Z") > Date.now(),
      "Agendamento deve ser futuro",
    );
    const end = new Date(
      Date.parse(start.replace(" ", "T") + "Z") +
        Number(proc.duracao_minutos) * 60000,
    )
      .toISOString()
      .slice(0, 19)
      .replace("T", " ");
    await available(c, data, start, end, Number(old?.id_agendamento ?? 0));
    let agenda = Number(old?.id_agendamento ?? 0);
    if (edit) {
      await exec(
        c,
        "UPDATE Agendamento SET data_hora_inicio=?,data_hora_fim=? WHERE id_agendamento=?",
        [start, end, agenda],
      );
      await exec(
        c,
        "INSERT INTO EventoAgenda(id_agendamento,tipo,motivo,id_autor) VALUES(?,'remarcado',?,?)",
        [agenda, "motivo" in b ? b.motivo : "", actor.id || null],
      );
    } else {
      let value = String(proc.valor_avulso);
      if (data.id_pacote_cliente) {
        const p = await one(
          c,
          "PacoteCliente",
          "id_pacote_cliente",
          Number(data.id_pacote_cliente),
        );
        value = money(
          Math.floor(cents(p.valor_contratado) / Number(p.sessoes_contratadas)),
        );
      }
      const r = await exec(
        c,
        "INSERT INTO Agendamento(id_cliente,id_profissional,id_procedimento,id_sala,id_equipamento,id_pacote_cliente,data_hora_inicio,data_hora_fim,origem_solicitacao,valor_sessao) VALUES(?,?,?,?,?,?,?,?,?,?)",
        [
          data.id_cliente,
          data.id_profissional,
          data.id_procedimento,
          data.id_sala,
          data.id_equipamento ?? null,
          data.id_pacote_cliente ?? null,
          start,
          end,
          data.origem_solicitacao,
          value,
        ],
      );
      agenda = r.insertId;
    }
    result = { id_agendamento: agenda };
  } else if (name === "status-agenda") {
    const b = z
      .object({
        id_agendamento: id,
        status: z.enum(["confirmado", "cancelado", "nao_compareceu"]),
        motivo: z.string().min(3).max(500),
      })
      .parse(input);
    const a = await one(c, "Agendamento", "id_agendamento", b.id_agendamento);
    owned(actor, a);
    const underway = await rows(
      c,
      "SELECT id_atendimento FROM Atendimento WHERE id_agendamento=? AND status='iniciado'",
      [a.id_agendamento],
    );
    assert(
      !underway.length,
      "Atendimento em andamento; finalize antes de alterar a agenda",
      409,
    );
    assert(
      ["pendente", "confirmado"].includes(String(a.status)),
      "Transição não permitida",
      409,
    );
    if (b.status === "nao_compareceu")
      assert(
        Date.parse(String(a.data_hora_inicio).replace(" ", "T") + "Z") <=
          Date.now(),
        "Ainda não chegou o horário",
      );
    const [policy] = await rows(c, "SELECT * FROM PoliticaFalta WHERE id=1");
    let consumed = false;
    if (
      b.status === "nao_compareceu" &&
      policy.consumir_sessao &&
      a.id_pacote_cliente
    ) {
      const changed = await exec(
        c,
        "UPDATE PacoteCliente SET sessoes_utilizadas=sessoes_utilizadas+1 WHERE id_pacote_cliente=? AND sessoes_restantes>0",
        [a.id_pacote_cliente],
      );
      assert(
        changed.affectedRows === 1,
        "Pacote sem saldo para aplicar a política de falta",
        409,
      );
      await exec(
        c,
        "INSERT INTO ConsumoSessao(id_agendamento,id_pacote_cliente) VALUES(?,?)",
        [a.id_agendamento, a.id_pacote_cliente],
      );
      consumed = true;
    }
    await exec(c, "UPDATE Agendamento SET status=? WHERE id_agendamento=?", [
      b.status,
      b.id_agendamento,
    ]);
    await exec(
      c,
      "INSERT INTO EventoAgenda(id_agendamento,tipo,motivo,id_autor,sessao_consumida,politica_aplicada) VALUES(?,?,?,?,?,?)",
      [
        b.id_agendamento,
        b.status,
        b.motivo,
        actor.id || null,
        consumed,
        policy.justificativa,
      ],
    );
  } else if (
    name === "iniciar-atendimento" ||
    name === "concluir-atendimento"
  ) {
    const b = z
      .object({
        id_agendamento: id,
        regiao_corpo_tratada: z.string().max(150).optional(),
        parametros_utilizados: z.string().max(10000).optional(),
        descricao_evolucao: z.string().max(10000).optional(),
        produtos: z
          .array(
            z.object({
              id_produto: id,
              quantidade: z.union([z.string(), z.number()]),
            }),
          )
          .max(100)
          .default([]),
      })
      .parse(input);
    const a = await one(c, "Agendamento", "id_agendamento", b.id_agendamento);
    owned(actor, a);
    let [at] = await rows(
      c,
      "SELECT * FROM Atendimento WHERE id_agendamento=? FOR UPDATE",
      [b.id_agendamento],
    );
    if (at?.status === "concluido")
      return { id_atendimento: at.id_atendimento, idempotent: true };
    assert(a.status === "confirmado", "Agendamento deve estar confirmado", 409);
    assert(
      Date.parse(String(a.data_hora_inicio).replace(" ", "T") + "Z") <=
        Date.now(),
      "Atendimento não pode iniciar antes do agendamento",
    );
    if (!at) {
      const r = await exec(
        c,
        "INSERT INTO Atendimento(id_agendamento,regiao_corpo_tratada,data_atendimento,status,id_autor) VALUES(?,'',UTC_TIMESTAMP(),'iniciado',?)",
        [b.id_agendamento, actor.id || null],
      );
      at = { id_atendimento: r.insertId };
    }
    result = { id_atendimento: at.id_atendimento };
    if (name === "concluir-atendimento") {
      assert(b.regiao_corpo_tratada?.trim(), "Informe região tratada");
      const [ana] = await rows(
        c,
        "SELECT id_anamnese FROM Anamnese WHERE id_cliente=? ORDER BY data_avaliacao DESC LIMIT 1",
        [a.id_cliente],
      );
      assert(ana, "Registre uma anamnese antes de concluir");
      const [proc] = await rows(
        c,
        "SELECT exige_registro_foto FROM Procedimento WHERE id_procedimento=?",
        [a.id_procedimento],
      );
      if (proc.exige_registro_foto) {
        const photos = await rows(
          c,
          "SELECT id_foto FROM FotoClinica WHERE id_atendimento=? LIMIT 1",
          [at.id_atendimento],
        );
        assert(photos.length, "Procedimento exige fotografia autorizada");
      }
      if (a.id_pacote_cliente) {
        const p = await one(
          c,
          "PacoteCliente",
          "id_pacote_cliente",
          Number(a.id_pacote_cliente),
        );
        assert(
          Number(p.sessoes_restantes) > 0 &&
            String(p.data_validade) >= new Date().toISOString().slice(0, 10) &&
            p.status_pagamento !== "estornado",
          "Pacote vencido ou sem saldo",
          409,
        );
        await exec(
          c,
          "INSERT INTO ConsumoSessao(id_agendamento,id_pacote_cliente) VALUES(?,?)",
          [a.id_agendamento, a.id_pacote_cliente],
        );
        await exec(
          c,
          "UPDATE PacoteCliente SET sessoes_utilizadas=sessoes_utilizadas+1 WHERE id_pacote_cliente=?",
          [a.id_pacote_cliente],
        );
      }
      for (const item of b.produtos) {
        const q = quantity(item.quantidade),
          p = await one(c, "Produto", "id_produto", item.id_produto);
        assert(
          p.ativo &&
            String(p.data_validade) >= new Date().toISOString().slice(0, 10),
          "Produto inativo ou vencido",
        );
        const u = await exec(
          c,
          "UPDATE Produto SET quantidade_estoque=quantidade_estoque-? WHERE id_produto=? AND quantidade_estoque>=?",
          [q, item.id_produto, q],
        );
        assert(u.affectedRows, "Estoque insuficiente", 409);
        await exec(
          c,
          "INSERT INTO ProdutoAplicado(id_atendimento,id_produto,nome_produto,marca,numero_lote,data_validade,quantidade) VALUES(?,?,?,?,?,?,?)",
          [
            at.id_atendimento,
            item.id_produto,
            p.nome,
            p.marca,
            p.numero_lote,
            p.data_validade,
            q,
          ],
        );
        await exec(
          c,
          "INSERT INTO MovimentacaoEstoque(id_produto,id_atendimento,tipo,quantidade,motivo,id_autor) VALUES(?,?,'saida',?,'Conclusão de atendimento',?)",
          [item.id_produto, at.id_atendimento, q, actor.id || null],
        );
      }
      await exec(
        c,
        "UPDATE Atendimento SET status='concluido',regiao_corpo_tratada=?,parametros_utilizados=?,descricao_evolucao=? WHERE id_atendimento=?",
        [
          b.regiao_corpo_tratada,
          b.parametros_utilizados ?? null,
          b.descricao_evolucao ?? null,
          at.id_atendimento,
        ],
      );
      await exec(
        c,
        "UPDATE Agendamento SET status='concluido' WHERE id_agendamento=?",
        [a.id_agendamento],
      );
      await exec(
        c,
        "INSERT INTO Comissao(id_atendimento,id_profissional,base_calculo,percentual,valor) SELECT ?,?, ?,percentual_comissao,ROUND(? * percentual_comissao / 100,2) FROM ProfissionalProcedimento WHERE id_profissional=? AND id_procedimento=?",
        [
          at.id_atendimento,
          a.id_profissional,
          a.valor_sessao,
          a.valor_sessao,
          a.id_profissional,
          a.id_procedimento,
        ],
      );
    }
  } else if (name === "pagamento-avulso") {
    const b = z
      .object({
        id_agendamento: id,
        forma_pagamento: method,
        numero_parcelas: z.coerce.number().int().min(1).max(48),
        data_vencimento: date,
      })
      .parse(input);
    const a = await one(c, "Agendamento", "id_agendamento", b.id_agendamento);
    assert(!a.id_pacote_cliente, "Agendamento utiliza pacote");
    const existing = await rows(
      c,
      "SELECT id_pagamento FROM Pagamento WHERE id_agendamento=? AND status NOT IN ('cancelado','estornado')",
      [b.id_agendamento],
    );
    assert(!existing.length, "Já existe cobrança para este agendamento", 409);
    result = {
      id_pagamento: await payment(
        c,
        { ...b, id_cliente: Number(a.id_cliente) },
        cents(a.valor_sessao),
      ),
    };
  } else if (name === "receber-parcela") {
    const b = z
      .object({ id_parcela: id, valor: z.union([z.string(), z.number()]) })
      .parse(input);
    const p = await one(c, "Parcela", "id_parcela", b.id_parcela),
      pay = await one(c, "Pagamento", "id_pagamento", Number(p.id_pagamento));
    assert(
      !["cancelado", "estornado"].includes(String(pay.status)),
      "Pagamento encerrado",
    );
    const amount = cents(b.valor);
    assert(
      amount > 0 && amount <= cents(p.valor_parcela) - cents(p.valor_recebido),
      "Valor excede saldo",
    );
    await exec(
      c,
      "UPDATE Parcela SET valor_recebido=valor_recebido+?,data_pagamento=UTC_TIMESTAMP(),status=IF(valor_recebido=valor_parcela,'paga','pendente') WHERE id_parcela=?",
      [money(amount), b.id_parcela],
    );
    await exec(
      c,
      "INSERT INTO Recebimento(id_parcela,valor,tipo,id_autor) VALUES(?,?,'recebimento',?)",
      [b.id_parcela, money(amount), actor.id || null],
    );
    const [sum] = await rows(
      c,
      "SELECT SUM(valor_recebido) recebido FROM Parcela WHERE id_pagamento=?",
      [pay.id_pagamento],
    );
    const status =
      cents(sum.recebido) === cents(pay.valor_total) ? "pago" : "parcial";
    await exec(
      c,
      "UPDATE Pagamento SET status=?,data_pagamento=UTC_TIMESTAMP() WHERE id_pagamento=?",
      [status, pay.id_pagamento],
    );
    if (pay.id_pacote_cliente)
      await exec(
        c,
        "UPDATE PacoteCliente SET status_pagamento=? WHERE id_pacote_cliente=?",
        [status, pay.id_pacote_cliente],
      );
  } else if (name === "estornar-pagamento" || name === "cancelar-pagamento") {
    const b = z
        .object({ id_pagamento: id, motivo: z.string().min(5).max(500) })
        .parse(input),
      p = await one(c, "Pagamento", "id_pagamento", b.id_pagamento);
    assert(
      !["estornado", "cancelado"].includes(String(p.status)),
      "Pagamento já encerrado",
      409,
    );
    const parts = await rows(
      c,
      "SELECT * FROM Parcela WHERE id_pagamento=? FOR UPDATE",
      [b.id_pagamento],
    );
    const received = parts.reduce((s, r) => s + cents(r.valor_recebido), 0);
    assert(
      name !== "cancelar-pagamento" || received === 0,
      "Use estorno para valores recebidos",
    );
    const paid = await rows(
      c,
      "SELECT co.id_comissao FROM Comissao co JOIN Atendimento at ON at.id_atendimento=co.id_atendimento JOIN Agendamento a ON a.id_agendamento=at.id_agendamento WHERE co.status='paga' AND (a.id_agendamento=? OR a.id_pacote_cliente=?)",
      [p.id_agendamento, p.id_pacote_cliente],
    );
    assert(
      !paid.length,
      "Existe comissão paga: concilie antes de estornar",
      409,
    );
    for (const part of parts)
      if (cents(part.valor_recebido) > 0)
        await exec(
          c,
          "INSERT INTO Recebimento(id_parcela,valor,tipo,id_autor,motivo) VALUES(?,?,'estorno',?,?)",
          [part.id_parcela, part.valor_recebido, actor.id, b.motivo],
        );
    await exec(
      c,
      "UPDATE Parcela SET valor_recebido=0,status='cancelada' WHERE id_pagamento=?",
      [b.id_pagamento],
    );
    await exec(c, "UPDATE Pagamento SET status=? WHERE id_pagamento=?", [
      name === "estornar-pagamento" ? "estornado" : "cancelado",
      b.id_pagamento,
    ]);
    await exec(
      c,
      "UPDATE Comissao co JOIN Atendimento at ON at.id_atendimento=co.id_atendimento JOIN Agendamento a ON a.id_agendamento=at.id_agendamento SET co.status='cancelada' WHERE co.status='pendente' AND (a.id_agendamento=? OR a.id_pacote_cliente=?)",
      [p.id_agendamento, p.id_pacote_cliente],
    );
    if (p.id_pacote_cliente)
      await exec(
        c,
        "UPDATE PacoteCliente SET status_pagamento='estornado' WHERE id_pacote_cliente=?",
        [p.id_pacote_cliente],
      );
  } else if (name === "movimentar-estoque") {
    const b = z
      .object({
        id_produto: id,
        tipo: z.enum(["entrada", "saida"]),
        quantidade: z.union([z.string(), z.number()]),
        motivo: z.string().min(3).max(500),
      })
      .parse(input);
    await one(c, "Produto", "id_produto", b.id_produto);
    const q = quantity(b.quantidade);
    const r = await exec(
      c,
      `UPDATE Produto SET quantidade_estoque=quantidade_estoque${b.tipo === "entrada" ? "+" : "-"}? WHERE id_produto=? ${b.tipo === "saida" ? "AND quantidade_estoque>=?" : ""}`,
      [q, b.id_produto, ...(b.tipo === "saida" ? [q] : [])],
    );
    assert(r.affectedRows, "Estoque insuficiente", 409);
    await exec(
      c,
      "INSERT INTO MovimentacaoEstoque(id_produto,tipo,quantidade,motivo,id_autor) VALUES(?,?,?,?,?)",
      [b.id_produto, b.tipo, q, b.motivo, actor.id || null],
    );
  } else if (name === "pagar-comissao") {
    const b = z.object({ id_comissao: id }).parse(input);
    const co = await one(c, "Comissao", "id_comissao", b.id_comissao);
    assert(co.status === "pendente", "Comissão não pendente");
    const eligible = await rows(
      c,
      "SELECT p.id_pagamento FROM Pagamento p JOIN Agendamento a ON (p.id_agendamento=a.id_agendamento OR p.id_pacote_cliente=a.id_pacote_cliente) JOIN Atendimento at ON at.id_agendamento=a.id_agendamento WHERE at.id_atendimento=? AND p.status='pago'",
      [co.id_atendimento],
    );
    assert(
      eligible.length,
      "Recebimento integral necessário para pagar comissão",
    );
    await exec(
      c,
      "UPDATE Comissao SET status='paga',data_pagamento=UTC_TIMESTAMP() WHERE id_comissao=?",
      [b.id_comissao],
    );
  } else assert(false, "Operação não encontrada", 404);
  await audit(c, actor.id, name, "operacoes", null);
  return result;
}
