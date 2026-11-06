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
    "SELECT cfg.*,p.duracao_minutos FROM AgendaConfiguracao cfg JOIN Procedimento p ON p.id_procedimento=cfg.id_procedimento WHERE cfg.id_procedimento=? AND p.ativo=1",
    [procedure],
  );
  assert(
    r,
    "A clínica ainda não disponibilizou horários para este procedimento.",
  );
  return r;
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
        `SELECT p.*,pr.nome profissional,pr.id_profissional,pr.anos_experiencia,COALESCE(av.rating,0) rating,COALESCE(av.reviews,0) reviews FROM Procedimento p LEFT JOIN AgendaConfiguracao cfg ON cfg.id_procedimento=p.id_procedimento LEFT JOIN Profissional pr ON pr.id_profissional=cfg.id_profissional LEFT JOIN (SELECT a.id_procedimento,AVG(v.nota) rating,COUNT(*) reviews FROM Avaliacao v JOIN Agendamento a ON a.id_agendamento=v.id_agendamento GROUP BY a.id_procedimento) av ON av.id_procedimento=p.id_procedimento WHERE p.ativo=1 ORDER BY p.id_procedimento`,
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
          image: p.imagem_url || "/images/facial-card.jpg",
          specialistName: p.profissional || "Consulte a clínica",
          specialistId: p.id_profissional,
          experience: Number(p.anos_experiencia || 0),
        })),
        favorites: fav.map((p) => Number(p.id_procedimento)),
        bookings: await map(c, user.id),
      };
    }
    if (route === "slots" && request.method === "GET") {
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
        "SELECT duracao_minutos FROM Procedimento WHERE id_procedimento=?",
        [treatment],
      );
      const times: string[] = [];
      for (let minute = 8 * 60; minute <= 19 * 60; minute += 30) {
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
      return { slots: times };
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
          "SELECT pc.id_pacote_cliente,p.nome,p.id_procedimento,pc.data_validade,pc.sessoes_restantes,pc.status_pagamento FROM PacoteCliente pc JOIN Pacote p ON p.id_pacote=pc.id_pacote WHERE pc.id_cliente=?",
          [user.id],
        ),
        payments: await rows(
          c,
          "SELECT p.id_pagamento,p.forma_pagamento,p.status,pa.numero_parcela,pa.valor_parcela,pa.valor_recebido,pa.data_vencimento FROM Pagamento p JOIN Parcela pa ON pa.id_pagamento=p.id_pagamento WHERE p.id_cliente=? ORDER BY pa.data_vencimento DESC LIMIT 200",
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
