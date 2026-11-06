"use client";
import { useEffect, useState } from "react";
import { type Api, type Row, display } from "./api";
export function Calendar({
  api,
  revision,
  onSelect,
}: {
  api: Api;
  revision: number;
  onSelect: (r: Row) => void;
}) {
  const [mode, setMode] = useState("semana"),
    [date, setDate] = useState(new Date().toISOString().slice(0, 10)),
    [items, setItems] = useState<Row[]>([]),
    [error, setError] = useState(""),
    [professional, setProfessional] = useState(""),
    [room, setRoom] = useState(""),
    [procedure, setProcedure] = useState("");
  const start = new Date(date + "T12:00:00Z");
  if (mode === "mes") start.setUTCDate(1);
  if (mode === "semana")
    start.setUTCDate(start.getUTCDate() - start.getUTCDay());
  const end = new Date(start);
  end.setUTCDate(
    start.getUTCDate() +
      (mode === "mes"
        ? new Date(
            Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0),
          ).getUTCDate()
        : mode === "semana"
          ? 7
          : 1) -
      1,
  );
  const first = start.toISOString().slice(0, 10),
    last = end.toISOString().slice(0, 10);
  useEffect(() => {
    let alive = true;
    setError("");
    api<{ items: Row[]; total: number }>(
      `agendamentos?from=${first}&to=${last}&pageSize=100&sort=data_hora_inicio&direction=asc${professional ? "&profissional=" + professional : ""}${room ? "&sala=" + room : ""}${procedure ? "&procedimento=" + procedure : ""}`,
    )
      .then((d) => {
        if (alive) {
          setItems(d.items);
          if (d.total > 100)
            setError(
              "Exibindo os primeiros 100 horários. Use a visão diária para detalhar.",
            );
        }
      })
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [api, first, last, revision, professional, room, procedure]);
  const days = [];
  for (
    let d = new Date(first + "T12:00:00Z");
    d <= end;
    d.setUTCDate(d.getUTCDate() + 1)
  )
    days.push(d.toISOString().slice(0, 10));
  return (
    <section className="admin-calendar">
      <div className="admin-toolbar">
        <label>
          Data
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label>
          Visualização
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="dia">Dia</option>
            <option value="semana">Semana</option>
            <option value="mes">Mês</option>
          </select>
        </label>
        <label>
          Profissional (ID)
          <input
            type="number"
            min="1"
            value={professional}
            onChange={(e) => setProfessional(e.target.value)}
          />
        </label>
        <label>
          Sala (ID)
          <input
            type="number"
            min="1"
            value={room}
            onChange={(e) => setRoom(e.target.value)}
          />
        </label>
        <label>
          Procedimento (ID)
          <input
            type="number"
            min="1"
            value={procedure}
            onChange={(e) => setProcedure(e.target.value)}
          />
        </label>
      </div>
      {error && <p role="status">{error}</p>}
      <div className={`admin-calendar-grid ${mode}`}>
        {days.map((day) => (
          <div className="admin-calendar-day" key={day}>
            <strong>
              {new Date(day + "T12:00:00Z").toLocaleDateString("pt-BR", {
                day: "numeric",
                month: "short",
                weekday: "short",
              })}
            </strong>
            {items
              .filter(
                (r) =>
                  new Intl.DateTimeFormat("en-CA", {
                    timeZone: "America/Sao_Paulo",
                  }).format(
                    new Date(
                      String(r.data_hora_inicio).replace(" ", "T") + "Z",
                    ),
                  ) === day,
              )
              .map((r) => (
                <button
                  key={String(r.id_agendamento)}
                  onClick={() => onSelect(r)}
                >
                  <b>
                    {display(
                      String(r.data_hora_inicio).replace(" ", "T") + "Z",
                      "data_hora_inicio",
                    )}
                  </b>
                  <span>
                    {String(r.cliente_nome || `Cliente #${r.id_cliente}`)}
                  </span>
                  <small>
                    {String(r.procedimento_nome)} ·{" "}
                    {String(r.profissional_nome)}
                  </small>
                  <small>{String(r.status)}</small>
                </button>
              ))}
          </div>
        ))}
      </div>
    </section>
  );
}
