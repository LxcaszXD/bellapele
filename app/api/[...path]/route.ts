import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { z } from "zod";
import { db } from "@/lib/db";
import { treatments } from "@/lib/domain";
import { customerId } from "@/lib/server/session";
import { ApiError } from "@/lib/server/errors";
import {
  availableSlots,
  bookingSelect,
  changeBooking,
  mapBooking,
} from "@/lib/server/booking-service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
function numeric(value: string | null, optional = false) {
  if (optional && !value) return 0;
  if (
    !value ||
    !/^\d+$/.test(value) ||
    !Number.isSafeInteger(Number(value)) ||
    Number(value) < 1
  )
    throw new ApiError(400, "Identificador inválido.");
  return Number(value);
}
async function readBody(req: Request) {
  try {
    return await req.json();
  } catch {
    throw new ApiError(400, "Envie um corpo JSON válido.");
  }
}
async function handle(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  try {
    const route = (await context.params).path.join("/");
    const supported: Record<string, string[]> = {
      bootstrap: ["GET"],
      slots: ["GET"],
      favorites: ["PUT"],
      bookings: ["POST"],
    };
    const key = /^bookings\/\d+$/.test(route) ? "bookings/id" : route;
    const methods =
      key === "bookings/id" ? ["PATCH", "DELETE"] : supported[key];
    if (!methods) throw new ApiError(404, "Rota não encontrada.");
    if (!methods.includes(req.method))
      return NextResponse.json(
        { error: "Método não permitido." },
        { status: 405, headers: { Allow: methods.join(", ") } },
      );
    if (req.method !== "GET") {
      const origin = req.headers.get("origin");
      const expected = process.env.APP_ORIGIN ?? new URL(req.url).origin;
      if (origin && origin !== expected)
        throw new ApiError(403, "Origem não permitida.");
      if (req.headers.get("sec-fetch-site") === "cross-site")
        throw new ApiError(403, "Origem não permitida.");
    }
    if (process.env.DATA_MODE === "demo") {
      if (route === "bootstrap") return json({ mode: "demo", treatments });
      throw new ApiError(
        409,
        "No modo demo, os dados são salvos pelo navegador.",
      );
    }
    const customer = await customerId(req);
    if (route === "bootstrap") {
      const [catalog] = await db().query<
        RowDataPacket[]
      >(`SELECT p.*,pr.id_profissional,pr.nome AS profissional,pr.anos_experiencia,
 (SELECT ROUND(AVG(av.nota),1) FROM Avaliacao av JOIN Agendamento a ON a.id_agendamento=av.id_agendamento WHERE a.id_procedimento=p.id_procedimento) AS rating,
 (SELECT COUNT(*) FROM Avaliacao av JOIN Agendamento a ON a.id_agendamento=av.id_agendamento WHERE a.id_procedimento=p.id_procedimento) AS reviews
 FROM Procedimento p LEFT JOIN AgendaConfiguracao c ON c.id_procedimento=p.id_procedimento LEFT JOIN Profissional pr ON pr.id_profissional=c.id_profissional ORDER BY p.id_procedimento`);
      const [favorites] = await db().execute<RowDataPacket[]>(
        "SELECT id_procedimento FROM Favorito WHERE id_cliente=?",
        [customer],
      );
      const [bookings] = await db().execute<RowDataPacket[]>(
        bookingSelect + " WHERE a.id_cliente=? ORDER BY a.data_hora_inicio",
        [customer],
      );
      const [clients] = await db().execute<RowDataPacket[]>(
        "SELECT nome_completo FROM Cliente WHERE id_cliente=?",
        [customer],
      );
      return json({
        mode: "mysql",
        customer: { name: clients[0].nome_completo },
        treatments: catalog.map((p) => ({
          id: Number(p.id_procedimento),
          name: p.nome,
          shortName: p.nome,
          category: p.categoria,
          description: p.descricao ?? "",
          about: p.descricao ?? "",
          image: p.imagem_url ?? "/images/facial-card.jpg",
          duration: Number(p.duracao_minutos),
          price: Number(p.valor_avulso),
          rating: Number(p.rating ?? 0),
          reviews: Number(p.reviews),
          specialistName: p.profissional ?? "Agenda não configurada",
          specialistId: p.id_profissional,
          experience: Number(p.anos_experiencia ?? 0),
        })),
        favorites: favorites.map((r) => r.id_procedimento),
        bookings: bookings.map(mapBooking),
      });
    }
    if (route === "slots") {
      const date = req.nextUrl.searchParams.get("date");
      if (
        !date ||
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        Number.isNaN(Date.parse(date)) ||
        new Date(date).toISOString().slice(0, 10) !== date
      )
        throw new ApiError(400, "Data inválida.");
      return json({
        slots: await availableSlots(
          customer,
          numeric(req.nextUrl.searchParams.get("treatmentId")),
          date,
          numeric(req.nextUrl.searchParams.get("exclude"), true),
        ),
      });
    }
    if (route === "favorites") {
      const parsed = z
        .object({
          treatmentId: z.number().int().positive().max(4294967295),
          active: z.boolean(),
        })
        .strict()
        .safeParse(await readBody(req));
      if (!parsed.success) throw new ApiError(400, "Favorito inválido.");
      const data = parsed.data;
      const [found] = await db().execute<RowDataPacket[]>(
        "SELECT id_procedimento FROM Procedimento WHERE id_procedimento=?",
        [data.treatmentId],
      );
      if (!found.length)
        throw new ApiError(404, "Procedimento não encontrado.");
      await db().execute(
        data.active
          ? "INSERT INTO Favorito(id_cliente,id_procedimento) VALUES (?,?) ON DUPLICATE KEY UPDATE id_cliente=id_cliente"
          : "DELETE FROM Favorito WHERE id_cliente=? AND id_procedimento=?",
        [customer, data.treatmentId],
      );
      return json({ ok: true });
    }
    const id = key === "bookings/id" ? numeric(route.split("/")[1]) : 0;
    const body = req.method === "DELETE" ? undefined : await readBody(req);
    return json(
      await changeBooking(
        customer,
        req.method as "POST" | "PATCH" | "DELETE",
        id,
        body,
      ),
      req.method === "POST" ? 201 : 200,
    );
  } catch (error) {
    if (error instanceof ApiError)
      return json({ error: error.message }, error.status);
    const code = (error as { code?: string }).code;
    if (code === "ER_LOCK_DEADLOCK" || code === "ER_LOCK_WAIT_TIMEOUT")
      return json(
        { error: "A agenda está sendo atualizada. Tente novamente." },
        409,
      );
    console.error("Falha na API BellaPelle:", code ?? "erro interno");
    return json(
      {
        error:
          "Não foi possível acessar o banco. Confira a configuração e as migrações.",
      },
      503,
    );
  }
}
export {
  handle as GET,
  handle as POST,
  handle as PUT,
  handle as PATCH,
  handle as DELETE,
};
