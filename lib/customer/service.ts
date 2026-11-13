import { z } from "zod";
import { rows, exec, lock, transaction, type Connection } from "../clinic/db";
import { operate, available } from "../clinic/operations";
import { id, date, utc, assert } from "../clinic/validation";
import type { Customer } from "./auth";
import type { Actor } from "../clinic/permissions";
import { ClinicError } from "../clinic/permissions";
import { jsonBody } from "../clinic/security";
import { bookingSelect, mapBooking } from "../server/booking-service";
import type { RowDataPacket } from "mysql2";
const actor: Actor = {
  id: 0,
  nome: "Portal",
  email: "",
  perfil: "cliente",
  id_profissional: null,
  permissions: [],
};
const portalDate = date.refine(
  (d) => Date.parse(d) <= Date.now() + 366 * 86400000,
  "Escolha uma data nos próximos 12 meses",
);
const input = z.object({
  treatmentId: id,
  date: portalDate,
  time: z.string().regex(/^([01]\d|2[0-3]):(00|30)$/),
  payment: z.enum(["Pix", "Cartão de crédito"]),
  packageId: id.nullish(),
});
async function own(c: Connection, user: number, agenda: number) {
  const [a] = await rows(
    c,
    "SELECT * FROM Agendamento WHERE id_agendamento=? AND id_cliente=? FOR UPDATE",
    [agenda, user],
  );
  assert(a, "Agendamento não encontrado", 404);
  return a;
}
async function map(c: Connection, user: number, agenda?: number) {
  const data = await rows(
    c,
    bookingSelect +
      " WHERE a.id_cliente=?" +
      (agenda ? " AND a.id_agendamento=?" : "") +
      " ORDER BY a.data_hora_inicio",
    [user, ...(agenda ? [agenda] : [])],
  );
  return data.map((r) =>
    mapBooking({
      ...r,
      data_hora_inicio: new Date(
        Date.parse(String(r.data_hora_inicio).replace(" ", "T") + "Z") -
          3 * 3600000,
      )
        .toISOString()
        .slice(0, 19)
        .replace("T", " "),
    } as RowDataPacket),
  );
}
async function config(c: Connection, procedure: number) {
  const [r] = await rows(
    c,
    "SELECT cfg.*,p.duracao_minutos FROM AgendaConfiguracao cfg JOIN Procedimento p ON p.id_procedimento=cfg.id_procedimento JOIN Profissional pr ON pr.id_profissional=cfg.id_profissional AND pr.ativo=1 WHERE cfg.id_procedimento=? AND p.ativo=1",
    [procedure],
  );
  assert(
    r,
    "A clínica ainda não disponibilizou horários para este procedimento.",
  );
  return r;
}
async function availableDays(
  c: Connection,
  user: number,
  treatment: number,
  month: string,
  excluded: number,
) {
  assert(/^\d{4}-(0[1-9]|1[0-2])$/.test(month), "Mês inválido");
  const first = `${month}-01`;
  portalDate.parse(first);
  const nextMonth = new Date(`${first}T12:00:00-03:00`);
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  const afterMonth = nextMonth.toISOString().slice(0, 10);
  const startUtc = utc(`${first}T00:00:00-03:00`);
  const endUtc = utc(`${afterMonth}T00:00:00-03:00`);
  const cfg = excluded
    ? await own(c, user, excluded)
    : await config(c, treatment);
  if (excluded)
    assert(
      Number(cfg.id_procedimento) === treatment,
      "Procedimento incompatível",
    );
  const [proc] = await rows(
    c,
    "SELECT duracao_minutos FROM Procedimento WHERE id_procedimento=? AND ativo=1",
    [treatment],
  );
  assert(proc, "Procedimento indisponível", 404);
  const availability = await rows(
    c,
    "SELECT dia_semana,hora_inicio,hora_fim FROM Disponibilidade WHERE id_profissional=? AND ativo=1 ORDER BY dia_semana,hora_inicio",
    [cfg.id_profissional],
  );
  if (!availability.length) return { dates: [] as string[] };
  const conflicts = await rows(
    c,
    `SELECT data_hora_inicio,data_hora_fim FROM Agendamento
      WHERE status IN ('pendente','confirmado') AND id_agendamento<>?
        AND data_hora_inicio<? AND data_hora_fim>?
        AND (id_cliente=? OR id_profissional=? OR id_sala=? OR (? IS NOT NULL AND id_equipamento=?))`,
    [
      excluded,
      endUtc,
      startUtc,
      user,
      cfg.id_profissional,
      cfg.id_sala,
      cfg.id_equipamento ?? null,
      cfg.id_equipamento ?? null,
    ],
  );
  const blocks = await rows(
    c,
    `SELECT inicio,fim FROM Bloqueio WHERE ativo=1 AND inicio<? AND fim>?
      AND (id_profissional=? OR id_sala=? OR id_equipamento=?)`,
    [
      endUtc,
      startUtc,
      cfg.id_profissional,
      cfg.id_sala,
      cfg.id_equipamento ?? null,
    ],
  );
  const toMillis = (value: unknown) =>
    Date.parse(String(value).replace(" ", "T") + "Z");
  const daysInMonth = new Date(
    Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0),
  ).getUTCDate();
  const dates: string[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const dateValue = `${month}-${String(day).padStart(2, "0")}`;
    const weekday = new Date(`${dateValue}T12:00:00-03:00`).getDay();
    const windows = availability.filter(
      (slot) => Number(slot.dia_semana) === weekday,
    );
    let dayAvailable = false;
    for (const window of windows) {
      const [startHour, startMinute] = String(window.hora_inicio)
        .slice(0, 5)
        .split(":")
        .map(Number);
      const [endHour, endMinute] = String(window.hora_fim)
        .slice(0, 5)
        .split(":")
        .map(Number);
      const duration = Number(proc.duracao_minutos);
      for (
        let minute = startHour * 60 + startMinute;
        minute + duration <= endHour * 60 + endMinute;
        minute += 30
      ) {
        const time = `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
        const start = utc(`${dateValue}T${time}:00-03:00`);
        if (Date.parse(start.replace(" ", "T") + "Z") <= Date.now()) continue;
        const end = new Date(
          Date.parse(start.replace(" ", "T") + "Z") + duration * 60000,
        )
          .toISOString()
          .slice(0, 19)
          .replace("T", " ");
        const startMs = toMillis(start);
        const endMs = toMillis(end);
        const occupied =
          conflicts.some(
            (entry) =>
              toMillis(entry.data_hora_inicio) < endMs &&
              toMillis(entry.data_hora_fim) > startMs,
          ) ||
          blocks.some(
            (entry) =>
              toMillis(entry.inicio) < endMs && toMillis(entry.fim) > startMs,
          );
        if (!occupied) {
          dayAvailable = true;
          break;
        }
      }
      if (dayAvailable) break;
    }
    if (dayAvailable) dates.push(dateValue);
  }
  return { dates };
}
export async function customerService(
  request: Request,
  segments: string[],
  user: Customer,
) {
  const route = segments[0],
    query = new URL(request.url).searchParams;
  return transaction(async (c) => {
    if (route === "bootstrap" && request.method === "GET") {
      const treatments = await rows(
        c,
        `SELECT p.*,pr.nome profissional,pr.id_profissional,pr.anos_experiencia,COALESCE(av.rating,0) rating,COALESCE(av.reviews,0) reviews FROM Procedimento p LEFT JOIN AgendaConfiguracao cfg ON cfg.id_procedimento=p.id_procedimento LEFT JOIN Profissional pr ON pr.id_profissional=cfg.id_profissional AND pr.ativo=1 LEFT JOIN (SELECT a.id_procedimento,AVG(v.nota) rating,COUNT(*) reviews FROM Avaliacao v JOIN Agendamento a ON a.id_agendamento=v.id_agendamento GROUP BY a.id_procedimento) av ON av.id_procedimento=p.id_procedimento WHERE p.ativo=1 ORDER BY p.id_procedimento`,
      );
      const fav = await rows(
        c,
        "SELECT id_procedimento FROM Favorito WHERE id_cliente=?",
        [user.id],
      );
      return {
        mode: "mysql",
        customer: { name: user.name },
        treatments: treatments.map((p) => ({
          id: Number(p.id_procedimento),
          name: p.nome,
          shortName: p.nome,
          category: p.categoria,
          description: p.descricao || "",
          about: p.descricao || "",
          duration: Number(p.duracao_minutos),
          price: Number(p.valor_avulso),
          rating: Number(p.rating),
          reviews: Number(p.reviews),
          image: p.imagem_url || "/images/bellapelle-facial-new.webp",
          specialistName: p.profissional || "Consulte a clínica",
          specialistId: p.id_profissional,
          experience: Number(p.anos_experiencia || 0),
        })),
        favorites: fav.map((p) => Number(p.id_procedimento)),
        bookings: await map(c, user.id),
      };
    }
    if (route === "slots" && request.method === "GET") {
      if (query.has("month")) {
        const treatment = id.parse(query.get("treatmentId"));
        const excluded = query.get("exclude")
          ? id.parse(query.get("exclude"))
          : 0;
        return availableDays(
          c,
          user.id,
          treatment,
          String(query.get("month")),
          excluded,
        );
      }
      const day = portalDate.parse(query.get("date")),
        treatment = id.parse(query.get("treatmentId"));
      const excluded = query.get("exclude")
        ? id.parse(query.get("exclude"))
        : 0;
      await lock(c);
      const cfg = excluded
        ? await own(c, user.id, excluded)
        : await config(c, treatment);
      if (excluded)
        assert(
          Number(cfg.id_procedimento) === treatment,
          "Procedimento incompatível",
        );
      const [proc] = await rows(
        c,
        "SELECT duracao_minutos FROM Procedimento WHERE id_procedimento=? AND ativo=1",
        [treatment],
      );
      assert(proc, "Procedimento indisponível", 404);
      const availability = await rows(
        c,
        "SELECT dia_semana,hora_inicio,hora_fim FROM Disponibilidade WHERE id_profissional=? AND ativo=1 ORDER BY dia_semana,hora_inicio",
        [cfg.id_profissional],
      );
      const weekday = new Date(`${day}T12:00:00-03:00`).getDay();
      const times: string[] = [];
      for (const window of availability.filter(
        (slot) => Number(slot.dia_semana) === weekday,
      )) {
        const [startHour, startMinute] = String(window.hora_inicio)
          .slice(0, 5)
          .split(":")
          .map(Number);
        const [endHour, endMinute] = String(window.hora_fim)
          .slice(0, 5)
          .split(":")
          .map(Number);
        const first = startHour * 60 + startMinute;
        const last = endHour * 60 + endMinute;
        for (
          let minute = first;
          minute + Number(proc.duracao_minutos) <= last;
          minute += 30
        ) {
          const time = `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
          const start = utc(`${day}T${time}:00-03:00`);
          if (Date.parse(start.replace(" ", "T") + "Z") <= Date.now()) continue;
          const end = new Date(
            Date.parse(start.replace(" ", "T") + "Z") +
              Number(proc.duracao_minutos) * 60000,
          )
            .toISOString()
            .slice(0, 19)
            .replace("T", " ");
          try {
            await available(
              c,
              { ...cfg, id_cliente: user.id, id_procedimento: treatment },
              start,
              end,
              excluded,
            );
            times.push(time);
          } catch (e) {
            if (!(e instanceof Error && "status" in e)) throw e;
          }
        }
      }
      return { slots: [...new Set(times)].sort() };
    }
    if (route === "favorites" && request.method === "PUT") {
      const b = z
        .object({ treatmentId: id, active: z.boolean() })
        .parse(await jsonBody(request));
      if (b.active)
        await exec(
          c,
          "INSERT IGNORE INTO Favorito(id_cliente,id_procedimento) SELECT ?,id_procedimento FROM Procedimento WHERE id_procedimento=? AND ativo=1",
          [user.id, b.treatmentId],
        );
      else
        await exec(
          c,
          "DELETE FROM Favorito WHERE id_cliente=? AND id_procedimento=?",
          [user.id, b.treatmentId],
        );
      return { ok: true };
    }
    if (
      route === "bookings" &&
      ["POST", "PATCH", "DELETE"].includes(request.method)
    ) {
      await lock(c);
      const agenda = segments[1] ? id.parse(segments[1]) : null;
      const old = agenda ? await own(c, user.id, agenda) : null;
      if (old) {
        assert(
          ["confirmado", "pendente"].includes(String(old.status)),
          "Agendamento encerrado",
          409,
        );
        assert(
          Date.parse(String(old.data_hora_inicio).replace(" ", "T") + "Z") >
            Date.now(),
          "Solicite alterações de horários passados à recepção",
          409,
        );
      }
      if (request.method === "DELETE") {
        assert(agenda, "Agendamento obrigatório");
        await operate(
          c,
          "status-agenda",
          {
            id_agendamento: agenda,
            status: "cancelado",
            motivo: "Cancelado pelo cliente no portal",
          },
          actor,
        );
        await exec(
          c,
          "INSERT INTO AuditoriaCliente(id_cliente,acao,recurso) VALUES(?,'cancelamento',?)",
          [user.id, String(agenda)],
        );
        return { ok: true };
      }
      const b = input.parse(await jsonBody(request));
      let saved: number;
      if (request.method === "PATCH") {
        assert(agenda && old, "Agendamento obrigatório");
        assert(
          Number(old.id_procedimento) === b.treatmentId,
          "Não é possível trocar o procedimento na remarcação",
        );
        await operate(
          c,
          "reagendar",
          {
            id_agendamento: agenda,
            data_hora_inicio: `${b.date}T${b.time}:00-03:00`,
            motivo: "Remarcado pelo cliente no portal",
          },
          actor,
        );
        saved = agenda;
      } else {
        const cfg = await config(c, b.treatmentId);
        const created = await operate(
          c,
          "agendar",
          {
            id_cliente: user.id,
            id_profissional: cfg.id_profissional,
            id_sala: cfg.id_sala,
            id_equipamento: cfg.id_equipamento,
            id_procedimento: b.treatmentId,
            id_pacote_cliente: b.packageId ?? null,
            data_hora_inicio: `${b.date}T${b.time}:00-03:00`,
            origem_solicitacao: "aplicativo",
          },
          actor,
        );
        saved = Number(created.id_agendamento);
        if (!b.packageId)
          await operate(
            c,
            "pagamento-avulso",
            {
              id_agendamento: saved,
              forma_pagamento: b.payment === "Pix" ? "pix" : "cartao_credito",
              numero_parcelas: 1,
              data_vencimento: b.date,
            },
            actor,
          );
      }
      await exec(
        c,
        "INSERT INTO AuditoriaCliente(id_cliente,acao,recurso) VALUES(?,?,?)",
        [user.id, agenda ? "remarcacao" : "agendamento", String(saved)],
      );
      return (await map(c, user.id, saved))[0];
    }
    if (route === "account" && request.method === "GET") {
      const [profile] = await rows(
        c,
        "SELECT nome_completo,email,telefone,endereco,preferencias FROM Cliente WHERE id_cliente=?",
        [user.id],
      );
      return {
        profile,
        packages: await rows(
          c,
          "SELECT pc.id_pacote_cliente,p.nome,p.id_procedimento,pc.data_validade,pc.sessoes_restantes,pc.sessoes_contratadas,pc.valor_contratado,pc.status_pagamento,IF(pc.data_validade>=CURRENT_DATE AND pc.sessoes_restantes>0,'ativo','inativo') plano_status FROM PacoteCliente pc JOIN Pacote p ON p.id_pacote=pc.id_pacote WHERE pc.id_cliente=?",
          [user.id],
        ),
        payments: await rows(
          c,
          `SELECT p.id_pagamento,p.forma_pagamento,p.status,p.valor_total,
                  CASE WHEN p.id_pacote_cliente IS NOT NULL THEN pc.nome
                       ELSE CONCAT('Agendamento · ',pr.nome) END AS destino,
                  pa.numero_parcela,pa.valor_parcela,pa.valor_recebido,
                  pa.valor_parcela-pa.valor_recebido AS saldo_pendente,
                  pa.data_vencimento,pa.data_pagamento,
                  (SELECT MAX(r.data) FROM Recebimento r WHERE r.id_parcela=pa.id_parcela AND r.tipo='recebimento') AS data_recebimento,
                  (SELECT r.forma_pagamento FROM Recebimento r WHERE r.id_parcela=pa.id_parcela AND r.tipo='recebimento' ORDER BY r.id_recebimento DESC LIMIT 1) AS forma_recebimento
             FROM Pagamento p JOIN Parcela pa ON pa.id_pagamento=p.id_pagamento
             LEFT JOIN PacoteCliente pcx ON pcx.id_pacote_cliente=p.id_pacote_cliente
             LEFT JOIN Pacote pc ON pc.id_pacote=pcx.id_pacote
             LEFT JOIN Agendamento a ON a.id_agendamento=p.id_agendamento
             LEFT JOIN Procedimento pr ON pr.id_procedimento=a.id_procedimento
            WHERE p.id_cliente=? ORDER BY pa.data_vencimento DESC LIMIT 200`,
          [user.id],
        ),
        requests: await rows(
          c,
          "SELECT id_pedido,tipo,status,resposta,data FROM PedidoPrivacidade WHERE id_cliente=? ORDER BY data DESC",
          [user.id],
        ),
      };
    }
    if (route === "account" && request.method === "PATCH") {
      const b = z
        .object({
          telefone: z.string().max(20).nullable(),
          endereco: z.string().max(255).nullable(),
          preferencias: z.string().max(2000).nullable(),
        })
        .strict()
        .parse(await jsonBody(request));
      await exec(
        c,
        "UPDATE Cliente SET telefone=?,endereco=?,preferencias=? WHERE id_cliente=?",
        [b.telefone, b.endereco, b.preferencias, user.id],
      );
      await exec(
        c,
        "INSERT INTO AuditoriaCliente(id_cliente,acao) VALUES(?,'perfil_atualizado')",
        [user.id],
      );
      return { ok: true };
    }
    if (route === "privacy" && request.method === "POST") {
      const b = z
        .object({
          tipo: z.enum(["acesso", "correcao", "exclusao"]),
          descricao: z.string().trim().min(5).max(2000),
        })
        .parse(await jsonBody(request));
      await exec(
        c,
        "INSERT INTO PedidoPrivacidade(id_cliente,tipo,descricao) VALUES(?,?,?)",
        [user.id, b.tipo, b.descricao],
      );
      return { ok: true };
    }
    throw new ClinicError("Rota não encontrada", 404);
  });
}
