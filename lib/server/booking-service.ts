import type {
  PoolConnection,
  RowDataPacket,
  ResultSetHeader,
} from "mysql2/promise";
import { db } from "@/lib/db";
import { bookingSchema, endTime, isPast, slots } from "@/lib/domain";
import { ApiError } from "./errors";
export const paymentToDB = (p: string) =>
  p === "Pix" ? "pix" : "cartao_credito";
export const paymentFromDB = (p: string) =>
  ({
    pix: "Pix",
    cartao_credito: "Cartão de crédito",
    cartao_debito: "Cartão de débito",
    dinheiro: "Dinheiro",
  })[p] ?? "Não definido";
export function mapBooking(r: RowDataPacket) {
  return {
    id: String(r.id_agendamento),
    treatmentId: Number(r.id_procedimento),
    date: String(r.data_hora_inicio).slice(0, 10),
    time: String(r.data_hora_inicio).slice(11, 16),
    duration: Number(r.duration),
    price: Number(r.valor_sessao),
    payment: paymentFromDB(r.forma_pagamento),
    status: (
      {
        confirmado: "confirmed",
        pendente: "pending",
        concluido: "completed",
        cancelado: "cancelled",
        nao_compareceu: "no_show",
      } as Record<string, string>
    )[r.status],
    specialistName: r.profissional,
    specialistId: Number(r.id_profissional),
    paymentStatus: r.payment_status ?? "pendente",
  };
}
export const bookingSelect = `SELECT a.*,TIMESTAMPDIFF(MINUTE,a.data_hora_inicio,a.data_hora_fim) AS duration,pr.nome AS profissional,
 (SELECT p.forma_pagamento FROM Pagamento p WHERE p.id_agendamento=a.id_agendamento ORDER BY p.id_pagamento DESC LIMIT 1) AS forma_pagamento,
 (SELECT p.status FROM Pagamento p WHERE p.id_agendamento=a.id_agendamento ORDER BY p.id_pagamento DESC LIMIT 1) AS payment_status
 FROM Agendamento a JOIN Profissional pr ON pr.id_profissional=a.id_profissional`;
export async function config(conn: PoolConnection, id: number) {
  const [rows] = await conn.execute<RowDataPacket[]>(
    `SELECT c.*,p.valor_avulso,p.duracao_minutos,pr.nome AS profissional FROM AgendaConfiguracao c JOIN Procedimento p ON p.id_procedimento=c.id_procedimento JOIN Profissional pr ON pr.id_profissional=c.id_profissional WHERE c.id_procedimento=?`,
    [id],
  );
  if (!rows.length)
    throw new ApiError(422, "Procedimento sem agenda configurada.");
  return rows[0];
}
async function owned(conn: PoolConnection, id: number, bookingId: number) {
  const [rows] = await conn.execute<RowDataPacket[]>(
    bookingSelect + " WHERE a.id_agendamento=? AND a.id_cliente=? FOR UPDATE",
    [bookingId, id],
  );
  if (!rows.length) throw new ApiError(404, "Agendamento não encontrado.");
  return rows[0];
}
function mutable(r: RowDataPacket) {
  if (
    !["confirmado", "pendente"].includes(r.status) ||
    isPast(
      String(r.data_hora_inicio).slice(0, 10),
      String(r.data_hora_inicio).slice(11, 16),
    )
  )
    throw new ApiError(409, "Este agendamento não pode ser alterado.");
  if (r.id_pacote_cliente !== null)
    throw new ApiError(
      422,
      "Alterações de sessões de pacote devem ser feitas pela recepção.",
    );
}
export async function conflicts(
  conn: PoolConnection,
  customer: number,
  c: RowDataPacket,
  start: string,
  end: string,
  exclude: number,
  locking = false,
) {
  const [rows] = await conn.execute<RowDataPacket[]>(
    `SELECT id_agendamento FROM Agendamento WHERE status IN ('confirmado','pendente','concluido') AND id_agendamento<>? AND data_hora_inicio<? AND data_hora_fim>? AND (id_cliente=? OR id_profissional=? OR id_sala=? OR (? IS NOT NULL AND id_equipamento=?))${locking ? " FOR UPDATE" : ""}`,
    [
      exclude,
      end,
      start,
      customer,
      c.id_profissional,
      c.id_sala,
      c.id_equipamento,
      c.id_equipamento,
    ],
  );
  return rows.length > 0;
}
export async function availableSlots(
  customer: number,
  treatment: number,
  date: string,
  exclude: number,
) {
  const conn = await db().getConnection();
  try {
    let c = await config(conn, treatment);
    let duration = Number(c.duracao_minutos);
    if (exclude) {
      const existing = await owned(conn, customer, exclude);
      mutable(existing);
      if (existing.id_procedimento !== treatment)
        throw new ApiError(400, "Procedimento diferente do agendamento.");
      c = existing;
      duration = Number(existing.duration);
    }
    const available: string[] = [];
    for (const time of slots) {
      const end = endTime(time, duration);
      if (end >= "24:00") continue;
      if (
        !isPast(date, time) &&
        !(await conflicts(
          conn,
          customer,
          c,
          `${date} ${time}:00`,
          `${date} ${end}:00`,
          exclude,
        ))
      )
        available.push(time);
    }
    return available;
  } finally {
    conn.release();
  }
}
export async function changeBooking(
  customer: number,
  method: "POST" | "PATCH" | "DELETE",
  bookingId: number,
  body?: unknown,
) {
  const parsed = method === "DELETE" ? null : bookingSchema.safeParse(body);
  if (parsed && !parsed.success)
    throw new ApiError(400, parsed.error.issues[0].message);
  const data = parsed?.success ? parsed.data : null;
  const conn = await db().getConnection();
  try {
    await conn.beginTransaction();
    // Uma fila transacional global: todas as mutacoes desta API seguem a mesma ordem.
    // Evita dupla reserva de qualquer sala, cliente, profissional ou equipamento.
    const [guard] = await conn.query<RowDataPacket[]>(
      "SELECT id FROM ControleAgenda WHERE id=1 FOR UPDATE",
    );
    if (!guard.length)
      throw new ApiError(503, "Execute a migração 002-api.sql.");
    const existing = bookingId
      ? await owned(conn, customer, bookingId)
      : undefined;
    if (existing) mutable(existing);
    if (method === "DELETE") {
      const [paid] = await conn.execute<RowDataPacket[]>(
        "SELECT id_pagamento FROM Pagamento WHERE id_agendamento=? AND status IN ('pago','parcial','estornado') FOR UPDATE",
        [bookingId],
      );
      if (paid.length)
        throw new ApiError(
          409,
          "Pagamento financeiro já registrado. Solicite cancelamento à recepção.",
        );
      await conn.execute(
        "UPDATE Agendamento SET status='cancelado' WHERE id_agendamento=?",
        [bookingId],
      );
      await conn.execute(
        "UPDATE Parcela pa JOIN Pagamento p ON p.id_pagamento=pa.id_pagamento SET pa.status='cancelada' WHERE p.id_agendamento=? AND pa.status='pendente'",
        [bookingId],
      );
      await conn.execute(
        "UPDATE Pagamento SET status='cancelado' WHERE id_agendamento=? AND status='pendente'",
        [bookingId],
      );
      await conn.commit();
      return { ok: true };
    }
    if (!data) throw new ApiError(400, "Dados ausentes.");
    if (existing && existing.id_procedimento !== data.treatmentId)
      throw new ApiError(400, "O tratamento não pode ser alterado.");
    const c = existing ?? (await config(conn, data.treatmentId));
    const duration = existing
      ? Number(existing.duration)
      : Number(c.duracao_minutos);
    const price = existing
      ? Number(existing.valor_sessao)
      : Number(c.valor_avulso);
    const end = endTime(data.time, duration);
    if (end >= "24:00")
      throw new ApiError(422, "Duração incompatível com este dia.");
    const startSQL = `${data.date} ${data.time}:00`,
      endSQL = `${data.date} ${end}:00`;
    if (await conflicts(conn, customer, c, startSQL, endSQL, bookingId, true))
      throw new ApiError(
        409,
        "Horário indisponível para o cliente, profissional ou recurso. Escolha outro.",
      );
    let id = bookingId;
    if (existing) {
      const [payments] = await conn.execute<RowDataPacket[]>(
        "SELECT * FROM Pagamento WHERE id_agendamento=? FOR UPDATE",
        [id],
      );
      if (payments.length !== 1)
        throw new ApiError(
          409,
          "A cobrança precisa ser conferida pela recepção antes do reagendamento.",
        );
      if (payments.some((p) => !["pendente"].includes(p.status)))
        throw new ApiError(
          409,
          "Alterações com pagamento financeiro registrado devem ser feitas pela recepção.",
        );
      await conn.execute(
        "UPDATE Agendamento SET data_hora_inicio=?,data_hora_fim=? WHERE id_agendamento=?",
        [startSQL, endSQL, id],
      );
      await conn.execute(
        'UPDATE Pagamento SET forma_pagamento=? WHERE id_agendamento=? AND status="pendente"',
        [paymentToDB(data.payment), id],
      );
      await conn.execute(
        'UPDATE Parcela pa JOIN Pagamento p ON p.id_pagamento=pa.id_pagamento SET pa.data_vencimento=? WHERE p.id_agendamento=? AND pa.status="pendente"',
        [data.date, id],
      );
    } else {
      const [insert] = await conn.execute<ResultSetHeader>(
        `INSERT INTO Agendamento(id_cliente,id_profissional,id_sala,id_equipamento,id_procedimento,data_hora_inicio,data_hora_fim,status,origem_solicitacao,valor_sessao) VALUES (?,?,?,?,?,?,?,'confirmado','aplicativo',?)`,
        [
          customer,
          c.id_profissional,
          c.id_sala,
          c.id_equipamento,
          data.treatmentId,
          startSQL,
          endSQL,
          price,
        ],
      );
      id = insert.insertId;
      const [payment] = await conn.execute<ResultSetHeader>(
        `INSERT INTO Pagamento(id_cliente,id_agendamento,forma_pagamento,valor_total,numero_parcelas,status) VALUES (?,?,?,?,1,'pendente')`,
        [customer, id, paymentToDB(data.payment), price],
      );
      await conn.execute(
        "INSERT INTO Parcela(id_pagamento,numero_parcela,valor_parcela,data_vencimento,status) VALUES (?,1,?,?,'pendente')",
        [payment.insertId, price, data.date],
      );
    }
    const [rows] = await conn.execute<RowDataPacket[]>(
      bookingSelect + " WHERE a.id_agendamento=?",
      [id],
    );
    await conn.commit();
    return mapBooking(rows[0]);
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}
