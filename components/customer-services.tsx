"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Heart, CalendarDays } from "lucide-react";
import { Booking, Treatment, dateLabel, today } from "@/lib/domain";
type Row = Record<string, string | number>;
const statusLabels: Record<Booking["status"], string> = {
  confirmed: "Confirmado",
  pending: "Pendente",
  cancelled: "Cancelado",
  completed: "Concluído",
  no_show: "Não compareceu",
};
const paymentStatusLabels: Record<string, string> = {
  pendente: "Pendente",
  parcial: "Parcialmente pago",
  pago: "Pago",
  paga: "Paga",
  cancelado: "Cancelado",
  cancelada: "Cancelada",
  estornado: "Estornado",
};
const paymentMethodLabels: Record<string, string> = {
  pix: "PIX",
  cartao_credito: "Cartão de crédito",
  cartao_debito: "Cartão de débito",
  dinheiro: "Dinheiro",
};
export default function CustomerServices({
  csrf,
  initialTab = "Agendar",
  initialTreatmentId = null,
  onClose,
  onLogout,
  onFavoritesChange,
}: {
  csrf: string;
  initialTab?:
    | "Agendar"
    | "Meus agendamentos"
    | "Minha conta"
    | "Visão geral"
    | "Dados pessoais"
    | "Configurações"
    | "Favoritos"
    | "Privacidade";
  initialTreatmentId?: number | null;
  onClose: () => void;
  onLogout: () => void;
  onFavoritesChange?: (favorites: number[]) => void;
}) {
  const [catalog, setCatalog] = useState<Treatment[]>([]),
    [bookings, setBookings] = useState<Booking[]>([]),
    [account, setAccount] = useState<{
      profile: Row;
      packages: Row[];
      payments: Row[];
      requests: Row[];
    } | null>(null),
    [favorites, setFavorites] = useState<number[]>([]),
    [selected, setSelected] = useState(
      initialTreatmentId ? String(initialTreatmentId) : "",
    ),
    [date, setDate] = useState(today()),
    [calendarMonth, setCalendarMonth] = useState(today().slice(0, 7)),
    [availableDates, setAvailableDates] = useState<string[]>([]),
    [monthLoading, setMonthLoading] = useState(false),
    [time, setTime] = useState(""),
    [slots, setSlots] = useState<string[]>([]),
    [slotsLoading, setSlotsLoading] = useState(false),
    [payment, setPayment] = useState("Pix"),
    [pack, setPack] = useState(""),
    [editing, setEditing] = useState(""),
    [message, setMessage] = useState(""),
    [messageKind, setMessageKind] = useState<"success" | "error" | "info">(
      "info",
    ),
    [busy, setBusy] = useState(false),
    [tab, setTab] = useState(initialTab),
    [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState(""),
    [canceling, setCanceling] = useState("");
  const bookingForm = useRef<HTMLFormElement>(null);
  async function api(path: string, method = "GET", body?: unknown) {
    const r = await fetch("/api/customer/" + path, {
      method,
      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const d = await r.json();
    if (!r.ok) throw Error(d.error || "Não foi possível concluir.");
    return d;
  }
  async function load() {
    setLoading(true);
    setLoadError("");
    try {
      const [data, a] = await Promise.all([api("bootstrap"), api("account")]);
      setCatalog(data.treatments);
      setBookings(data.bookings);
      setFavorites(data.favorites);
      onFavoritesChange?.(data.favorites);
      setAccount(a);
    } catch (error) {
      setLoadError((error as Error).message);
      throw error;
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load().catch(() => {});
  }, []);
  useEffect(() => {
    let active = true;
    setAvailableDates([]);
    if (!selected) {
      setMonthLoading(false);
      return;
    }
    setMonthLoading(true);
    api(
      `slots?month=${calendarMonth}&treatmentId=${selected}&exclude=${editing}`,
    )
      .then((data) => {
        if (!active) return;
        const days: string[] = data.dates || [];
        setAvailableDates(days);
        if (!days.includes(date)) {
          setDate(days[0] || `${calendarMonth}-01`);
          setTime("");
        }
      })
      .catch((error) => {
        if (active) {
          setMessageKind("error");
          setMessage(error.message);
        }
      })
      .finally(() => active && setMonthLoading(false));
    return () => {
      active = false;
    };
  }, [calendarMonth, selected, editing]);
  useEffect(() => {
    if (tab === "Agendar" && editing)
      requestAnimationFrame(() =>
        bookingForm.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        }),
      );
  }, [tab, editing]);
  useEffect(() => {
    let active = true;
    setSlots([]);
    setTime("");
    setSlotsLoading(Boolean(selected));
    if (selected)
      api(`slots?date=${date}&treatmentId=${selected}&exclude=${editing}`)
        .then((d) => {
          if (active) setSlots(d.slots);
        })
        .catch((e) => {
          if (active) {
            setMessageKind("error");
            setMessage(e.message);
          }
        })
        .finally(() => active && setSlotsLoading(false));
    else setSlotsLoading(false);
    return () => {
      active = false;
    };
  }, [date, selected, editing]);
  async function act(fn: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    setMessageKind("info");
    try {
      await fn();
    } catch (e) {
      setMessageKind("error");
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const selectedTreatment = catalog.find((t) => t.id === Number(selected));
  const calendar = useMemo(() => {
    const [year, month] = calendarMonth.split("-").map(Number);
    const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const offset = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
    return { year, month, count, offset };
  }, [calendarMonth]);
  const nextAppointment = bookings.find(
    (booking) =>
      ["confirmed", "pending"].includes(booking.status) &&
      booking.date >= today(),
  );
  const maxCalendarMonth = (() => {
    const maximum = new Date(`${today()}T12:00:00-03:00`);
    maximum.setMonth(maximum.getMonth() + 12);
    return maximum.toISOString().slice(0, 7);
  })();
  const currency = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
  return (
    <div
      className="bp-overlay bp-customer-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Meus cuidados"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <article className="bp-services" data-motion="scale">
        <button
          className="bp-dialog-close bp-modal-close"
          onClick={onClose}
          aria-label="Fechar"
        >
          <span aria-hidden="true">×</span>
        </button>
        <header className="bp-customer-title" data-motion="rise">
          <span className="bp-eyebrow">BellaPelle · área do cliente</span>
          <h2>Seus cuidados, em um só lugar.</h2>
          <p>Acompanhe seus horários, preferências e procedimentos salvos.</p>
        </header>
        <nav>
          {(
            [
              "Visão geral",
              "Agendar",
              "Meus agendamentos",
              "Dados pessoais",
              "Favoritos",
              "Privacidade",
            ] as const
          ).map((t) => (
              <button key={t} onClick={() => setTab(t)} aria-pressed={tab === t} data-motion="rise">
              {t}
            </button>
          ))}
          <button
            aria-pressed={tab === "Configurações"}
            onClick={() => setTab("Configurações")}
          >
            Configurações
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              act(async () => {
                await api("auth/logout", "POST");
                onLogout();
              })
            }
          >
            Sair
          </button>
        </nav>
        {message && (
          <p
            className={`bp-customer-feedback ${messageKind}`}
            role={messageKind === "error" ? "alert" : "status"}
          >
            {message}
          </p>
        )}
        {loading && (
          <div
            className="bp-customer-loading"
            role="status"
            aria-label="Carregando sua área do cliente"
          >
            <span className="bp-spinner" />
            <strong>Carregando sua área de cuidados…</strong>
            <div className="bp-customer-skeleton" />
          </div>
        )}
        {!loading && loadError && (
          <div className="bp-customer-load-error" role="alert">
            <p>{loadError || "Não foi possível carregar seus dados."}</p>
            <button
              className="bp-button bp-button-outline"
              onClick={() => void load().catch(() => {})}
            >
              Tentar novamente
            </button>
          </div>
        )}
        {!loading && !loadError && tab === "Agendar" && (
          <form
            ref={bookingForm}
            onSubmit={(e) => {
              e.preventDefault();
              if (!selected || !date || !time) {
                setMessageKind("error");
                setMessage(
                  "Escolha o procedimento, a data e um horário disponível.",
                );
                return;
              }
              act(async () => {
                await api(
                  editing ? "bookings/" + editing : "bookings",
                  editing ? "PATCH" : "POST",
                  {
                    treatmentId: Number(selected),
                    date,
                    time,
                    payment,
                    packageId: pack ? Number(pack) : null,
                  },
                );
                await load();
                setEditing("");
                setSelected("");
                setTime("");
                setTab("Meus agendamentos");
                setMessageKind("success");
                setMessage("Agendamento salvo.");
              });
            }}
          >
            {editing && (
              <div className="bp-reschedule-banner" role="status">
                <span className="bp-reschedule-copy">
                  <strong>Remarcando seu agendamento</strong>
                  <span>
                    {selectedTreatment?.name || "Procedimento"} ·{" "}
                    {dateLabel(date, true)}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setEditing("");
                    setSelected("");
                    setTime("");
                    setMessage("");
                  }}
                >
                  Cancelar remarcação
                </button>
              </div>
            )}
            <label>
              Procedimento
              <select
                required
                disabled={!!editing}
                value={selected}
                onChange={(e) => {
                  setSelected(e.target.value);
                  setPack("");
                }}
              >
                <option value="">Escolha o procedimento</option>
                {catalog.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} · R$ {t.price.toFixed(2)} · {t.duration} min
                  </option>
                ))}
              </select>
            </label>
            <section
              className="bp-booking-calendar"
              aria-label="Escolha uma data e horário"
              data-motion="rise"
            >
              <div className="bp-calendar-month">
                <div>
                  <CalendarDays size={18} />
                  <strong>Data e horário</strong>
                </div>
                <div className="bp-calendar-controls">
                  <button
                    type="button"
                    aria-label="Mês anterior"
                    disabled={calendarMonth <= today().slice(0, 7)}
                    onClick={() => {
                      const d = new Date(`${calendarMonth}-15T12:00:00-03:00`);
                      d.setMonth(d.getMonth() - 1);
                      setCalendarMonth(d.toISOString().slice(0, 7));
                    }}
                  >
                    <ChevronLeft size={17} />
                  </button>
                  <strong>
                    {new Intl.DateTimeFormat("pt-BR", {
                      month: "long",
                      year: "numeric",
                      timeZone: "UTC",
                    }).format(new Date(`${calendarMonth}-01T12:00:00Z`))}
                  </strong>
                  <button
                    type="button"
                    aria-label="Próximo mês"
                    disabled={calendarMonth >= maxCalendarMonth}
                    onClick={() => {
                      const d = new Date(`${calendarMonth}-15T12:00:00-03:00`);
                      d.setMonth(d.getMonth() + 1);
                      setCalendarMonth(d.toISOString().slice(0, 7));
                    }}
                  >
                    <ChevronRight size={17} />
                  </button>
                </div>
              </div>
              <div className="bp-calendar-content">
                <div
                  className="bp-calendar-days"
                  role="group"
                  aria-label="Datas disponíveis"
                >
                  {["D", "S", "T", "Q", "Q", "S", "S"].map((day, i) => (
                    <span className="weekday" key={`${day}-${i}`}>
                      {day}
                    </span>
                  ))}
                  {Array.from({ length: calendar.offset }, (_, i) => (
                    <span className="empty" key={`blank-${i}`} />
                  ))}
                  {Array.from({ length: calendar.count }, (_, i) => {
                    const day = i + 1;
                    const value = `${calendarMonth}-${String(day).padStart(2, "0")}`;
                    const enabled =
                      availableDates.includes(value) && value >= today();
                    return (
                      <button
                        type="button"
                        key={value}
                        data-motion-calendar-day
                        disabled={!enabled || monthLoading}
                        aria-pressed={date === value}
                        aria-label={`${day} ${enabled ? "com horários disponíveis" : "indisponível"}`}
                        className={`${date === value ? "selected" : ""} ${value === today() ? "today" : ""} ${enabled ? "available" : "unavailable"}`}
                        onClick={() => {
                          setDate(value);
                          setTime("");
                        }}
                      >
                        <span>{day}</span>
                        {enabled && <i aria-hidden="true" />}
                      </button>
                    );
                  })}
                </div>
                <div className="bp-calendar-slots">
                  <strong>
                    {date ? dateLabel(date, true) : "Selecione uma data"}
                  </strong>
                  {monthLoading || slotsLoading ? (
                    <p className="bp-slot-message">Buscando disponibilidade…</p>
                  ) : slots.length ? (
                    <div
                      className="bp-slot-grid"
                      role="group"
                      aria-label="Horários disponíveis"
                    >
                      {slots.map((slot) => (
                        <button
                          type="button"
                          key={slot}
                          data-motion="scale"
                          className={time === slot ? "selected" : ""}
                          aria-pressed={time === slot}
                          onClick={() => setTime(slot)}
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="bp-slot-message">
                      {selected
                        ? "Não há horários livres nesta data. Escolha outro dia marcado no calendário."
                        : "Escolha um procedimento para consultar a agenda."}
                    </p>
                  )}
                </div>
              </div>
              <p className="bp-calendar-legend">
                <i /> Datas com horários disponíveis
              </p>
            </section>
            {selected && (
              <p className="bp-booking-hint">
                {selectedTreatment?.specialistName
                  ? `Atendimento com ${selectedTreatment.specialistName}.`
                  : "A equipe será definida conforme a disponibilidade configurada pela clínica."}
                {slots.length === 0 &&
                  " Os horários são exibidos conforme a agenda ativa do profissional."}
              </p>
            )}
            {selectedTreatment && date && time && (
              <aside className="bp-booking-summary" aria-live="polite">
                <span className="bp-eyebrow">Resumo do agendamento</span>
                <strong>{selectedTreatment.name}</strong>
                <div>
                  <span>
                    {dateLabel(date, true)} · {time}
                  </span>
                  <span>{selectedTreatment.duration} minutos</span>
                  <span>{currency.format(selectedTreatment.price)}</span>
                </div>
              </aside>
            )}
            {!editing && (
              <>
                <label>
                  Pacote
                  <select
                    value={pack}
                    onChange={(e) => setPack(e.target.value)}
                  >
                    <option value="">Atendimento avulso</option>
                    {account?.packages
                      .filter(
                        (p) =>
                          Number(p.id_procedimento) === Number(selected) &&
                          Number(p.sessoes_restantes) > 0,
                      )
                      .map((p) => (
                        <option
                          key={p.id_pacote_cliente}
                          value={p.id_pacote_cliente}
                        >
                          {p.nome} · {p.sessoes_restantes} sessões
                        </option>
                      ))}
                  </select>
                </label>
                {!pack && (
                  <label>
                    Forma de pagamento
                    <select
                      value={payment}
                      onChange={(e) => setPayment(e.target.value)}
                    >
                      <option>Pix</option>
                      <option>Cartão de crédito</option>
                    </select>
                    <small>
                      Pagamento registrado para recebimento pela clínica.
                    </small>
                  </label>
                )}
              </>
            )}
            <button className="bp-button filled" disabled={busy || !time}>
              {editing ? "Salvar remarcação" : "Confirmar agendamento"}
            </button>
          </form>
        )}
        {!loading && !loadError && tab === "Visão geral" && account && (
          <div className="bp-customer-overview" data-motion="rise">
            <header className="bp-account-header" data-motion="left">
              <span aria-hidden="true">
                {String(account.profile.nome_completo || "B")
                  .slice(0, 1)
                  .toLocaleUpperCase("pt-BR")}
              </span>
              <div>
                <small>Bem-vindo(a) de volta</small>
                <h3>{account.profile.nome_completo}</h3>
                <p>{account.profile.email}</p>
              </div>
              <button
                className="bp-button bp-button-outline"
                onClick={() => setTab("Dados pessoais")}
              >
                Editar dados
              </button>
            </header>
            <div className="bp-overview-stats" data-motion="rise">
              <button onClick={() => setTab("Meus agendamentos")}>
                <strong>
                  {
                    bookings.filter((b) =>
                      ["confirmed", "pending"].includes(b.status),
                    ).length
                  }
                </strong>
                <span>Agendamentos ativos</span>
              </button>
              <button onClick={() => setTab("Favoritos")}>
                <strong>{favorites.length}</strong>
                <span>Procedimentos favoritos</span>
              </button>
              <button onClick={() => setTab("Dados pessoais")}>
                <strong>{account.packages.length}</strong>
                <span>Pacotes cadastrados</span>
              </button>
            </div>
            <section className="bp-overview-next" data-motion="rise">
              <div>
                <span className="bp-eyebrow">Seu próximo cuidado</span>
                <h3>
                  {nextAppointment
                    ? nextAppointment.treatmentName ||
                      catalog.find((t) => t.id === nextAppointment.treatmentId)
                        ?.name ||
                      "Procedimento"
                    : "Vamos planejar seu próximo cuidado?"}
                </h3>
                <p>
                  {nextAppointment
                    ? `${dateLabel(nextAppointment.date, true)} · ${nextAppointment.time}${nextAppointment.specialistName ? ` · ${nextAppointment.specialistName}` : ""}`
                    : "Consulte os horários disponíveis e escolha o melhor momento para você."}
                </p>
              </div>
              <button
                className="bp-button bp-button-primary"
                onClick={() =>
                  nextAppointment
                    ? setTab("Meus agendamentos")
                    : setTab("Agendar")
                }
              >
                {nextAppointment ? "Ver agendamento" : "Agendar procedimento"}
                <ChevronRight size={16} />
              </button>
            </section>
            <div className="bp-account-section" data-motion="rise">
              <h3>Seus pacotes</h3>
              <div className="bp-account-mini-grid">
                {account.packages.slice(0, 3).map((p) => (
                  <article
                    className="bp-account-mini-card"
                    key={p.id_pacote_cliente}
                    data-motion="scale"
                  >
                    <strong>{p.nome}</strong>
                    <span>{p.sessoes_restantes} sessões restantes</span>
                    <small>
                      Plano: {p.plano_status === "ativo" ? "Ativo" : "Inativo"}
                    </small>
                  </article>
                ))}
                {!account.packages.length && (
                  <p className="bp-account-empty">
                    Nenhum pacote cadastrado no momento.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
        {!loading && !loadError && tab === "Meus agendamentos" && (
          <div className="bp-appointments-list" data-motion="rise">
            {!bookings.length && (
              <div className="bp-customer-empty">
                Você ainda não tem agendamentos.
              </div>
            )}
            {bookings.map((b) => (
              <article className="bp-appointment-card" key={b.id} data-motion="scale">
                <div className="bp-appointment-heading">
                  <div>
                    <span className="bp-eyebrow">
                      {dateLabel(b.date, true)} · {b.time}
                    </span>
                    <h3>
                      {catalog.find((t) => t.id === b.treatmentId)?.name ||
                        "Procedimento"}
                    </h3>
                  </div>
                  <span className={`bp-booking-status ${b.status}`}>
                    {statusLabels[b.status]}
                  </span>
                </div>
                <div className="bp-appointment-facts">
                  <span>{b.duration} min</span>
                  <span>{currency.format(b.price)}</span>
                  {b.specialistName && <span>{b.specialistName}</span>}
                  {b.paymentStatus && (
                    <span>
                      Pagamento:{" "}
                      {paymentStatusLabels[b.paymentStatus] || b.paymentStatus}
                    </span>
                  )}
                </div>
                <details className="bp-appointment-details">
                  <summary>Ver detalhes do agendamento</summary>
                  <dl>
                    <div>
                      <dt>Procedimento</dt>
                      <dd>
                        {b.treatmentName ||
                          catalog.find((t) => t.id === b.treatmentId)?.name ||
                          "Procedimento"}
                      </dd>
                    </div>
                    <div>
                      <dt>Profissional</dt>
                      <dd>{b.specialistName || "A definir"}</dd>
                    </div>
                    <div>
                      <dt>Sala</dt>
                      <dd>{b.roomName || "Sala a definir"}</dd>
                    </div>
                    <div>
                      <dt>Data</dt>
                      <dd>{dateLabel(b.date, true)}</dd>
                    </div>
                    <div>
                      <dt>Horário</dt>
                      <dd>
                        {b.time}–{b.endTime || "Horário a definir"} ·{" "}
                        {b.duration} min
                      </dd>
                    </div>
                    <div>
                      <dt>Valor do atendimento</dt>
                      <dd>{currency.format(b.price)}</dd>
                    </div>
                    <div>
                      <dt>Pagamento</dt>
                      <dd>
                        {paymentStatusLabels[b.paymentStatus || "pendente"] ||
                          "Pendente"}
                      </dd>
                    </div>
                    <div>
                      <dt>Valor recebido</dt>
                      <dd>
                        {currency.format(b.amountReceived || 0)} de{" "}
                        {currency.format(b.paymentAmount || b.price)}
                      </dd>
                    </div>
                    <div>
                      <dt>Forma de pagamento</dt>
                      <dd>
                        {b.paymentMethod && b.paymentMethod !== "Não definido"
                          ? paymentMethodLabels[b.paymentMethod] ||
                            b.paymentMethod
                          : "Não informada"}
                      </dd>
                    </div>
                    {b.receiptMethod && (
                      <div>
                        <dt>Forma recebida</dt>
                        <dd>
                          {paymentMethodLabels[b.receiptMethod] ||
                            b.receiptMethod}
                        </dd>
                      </div>
                    )}
                    {b.paymentDate && (
                      <div>
                        <dt>Último recebimento</dt>
                        <dd>{dateLabel(String(b.paymentDate).slice(0, 10))}</dd>
                      </div>
                    )}
                  </dl>
                </details>
                {["confirmed", "pending"].includes(b.status) && (
                  <div className="bp-appointment-actions">
                    {canceling === b.id ? (
                      <div className="bp-cancel-inline" role="alert">
                        <span>Deseja cancelar este horário?</span>
                        <button
                          className="bp-cancel-confirm"
                          disabled={busy}
                          onClick={() =>
                            act(async () => {
                              await api("bookings/" + b.id, "DELETE");
                              setCanceling("");
                              await load();
                              setMessageKind("success");
                              setMessage("Agendamento cancelado.");
                            })
                          }
                        >
                          Sim, cancelar
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => setCanceling("")}
                        >
                          Manter agendamento
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          disabled={busy}
                          onClick={() => {
                            setCanceling("");
                            setEditing(b.id);
                            setSelected(String(b.treatmentId));
                            setDate(b.date);
                            setCalendarMonth(b.date.slice(0, 7));
                            setTime("");
                            setTab("Agendar");
                          }}
                        >
                          Remarcar
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => setCanceling(b.id)}
                        >
                          Cancelar
                        </button>
                      </>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
        {!loading &&
          !loadError &&
          (tab === "Dados pessoais" || tab === "Minha conta") &&
          account && (
            <>
              <header className="bp-account-header">
                <span aria-hidden="true">
                  {String(account.profile.nome_completo || "B")
                    .slice(0, 1)
                    .toLocaleUpperCase("pt-BR")}
                </span>
                <div>
                  <small>Minha conta BellaPelle</small>
                  <h3>{account.profile.nome_completo}</h3>
                  <p>{account.profile.email}</p>
                </div>
              </header>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const body = Object.fromEntries(
                    new FormData(e.currentTarget),
                  );
                  act(async () => {
                    await api("account", "PATCH", body);
                    await load();
                    setMessageKind("success");
                    setMessage("Dados atualizados.");
                  });
                }}
              >
                <label>
                  Telefone
                  <input
                    name="telefone"
                    type="tel"
                    autoComplete="tel"
                    defaultValue={account.profile.telefone || ""}
                  />
                </label>
                <label>
                  Endereço
                  <input
                    name="endereco"
                    autoComplete="street-address"
                    defaultValue={account.profile.endereco || ""}
                  />
                </label>
                <label>
                  Preferências de atendimento
                  <textarea
                    name="preferencias"
                    rows={3}
                    defaultValue={account.profile.preferencias || ""}
                  />
                </label>
                <button disabled={busy}>Salvar dados</button>
              </form>
              <section className="bp-account-section">
                <h3>Meus pacotes</h3>
                <div className="bp-account-mini-grid">
                  {account.packages.map((p) => (
                    <article
                      className="bp-account-mini-card"
                      key={p.id_pacote_cliente}
                    >
                      <strong>{p.nome}</strong>
                      <span>{p.sessoes_restantes} sessões restantes</span>
                      <small>
                        Válido até{" "}
                        {dateLabel(String(p.data_validade).slice(0, 10))}
                      </small>
                      <small>
                        Plano:{" "}
                        {p.plano_status === "ativo" ? "Ativo" : "Inativo"} ·
                        Pagamento:{" "}
                        {paymentStatusLabels[String(p.status_pagamento)] ||
                          "Pendente"}
                      </small>
                      <small>
                        Valor contratado:{" "}
                        {currency.format(Number(p.valor_contratado || 0))} ·{" "}
                        {p.sessoes_contratadas} sessões
                      </small>
                    </article>
                  ))}
                  {account.packages.length === 0 && (
                    <p className="bp-account-empty">
                      Você não tem pacotes ativos.
                    </p>
                  )}
                </div>
              </section>
              <section className="bp-account-section">
                <h3>Pagamentos</h3>
                <div className="bp-account-mini-grid">
                  {account.payments.map((p, i) => (
                    <article
                      className="bp-account-mini-card"
                      key={p.id_parcela ?? i}
                    >
                      <strong>
                        {String(p.destino || "Pagamento")} · parcela{" "}
                        {p.numero_parcela}
                      </strong>
                      <span>{currency.format(Number(p.valor_parcela))}</span>
                      <small>
                        {paymentStatusLabels[String(p.status)] || "Pendente"}
                        {p.data_vencimento
                          ? ` · Vencimento ${dateLabel(String(p.data_vencimento).slice(0, 10))}`
                          : ""}
                      </small>
                      <small>
                        Recebido{" "}
                        {currency.format(Number(p.valor_recebido || 0))} · saldo{" "}
                        {currency.format(Number(p.saldo_pendente || 0))}
                      </small>
                      <small>
                        {p.forma_recebimento
                          ? `Forma recebida: ${paymentMethodLabels[String(p.forma_recebimento)] || p.forma_recebimento}`
                          : `Forma prevista: ${paymentMethodLabels[String(p.forma_pagamento)] || "não informada"}`}
                      </small>
                      <small>
                        {p.data_recebimento
                          ? `Recebido em ${dateLabel(String(p.data_recebimento).slice(0, 10))}`
                          : "A confirmação do recebimento é feita pela clínica."}
                      </small>
                    </article>
                  ))}
                  {account.payments.length === 0 && (
                    <p className="bp-account-empty">
                      Nenhuma parcela registrada.
                    </p>
                  )}
                </div>
              </section>
            </>
          )}
        {!loading && !loadError && tab === "Favoritos" && (
          <div className="bp-customer-favorites" data-motion="rise">
            <div className="bp-favorites-heading">
              <div>
                <span className="bp-eyebrow">Sua lista pessoal</span>
                <h3>Procedimentos salvos</h3>
              </div>
              <span>{favorites.length} salvos</span>
            </div>
            {catalog
              .filter((t) => favorites.includes(t.id))
              .map((t) => (
                <article className="bp-favorite-card" key={t.id} data-motion="scale">
                  <img
                    src={t.image || "/images/bellapelle-facial-new.webp"}
                    alt=""
                  />
                  <div>
                    <span className="bp-eyebrow">{t.category}</span>
                    <h4>{t.name}</h4>
                    {(t.description || t.about) && (
                      <p>{t.description || t.about}</p>
                    )}
                    <small>
                      {currency.format(t.price)} · {t.duration} min
                    </small>
                    <button
                      className="bp-button bp-button-primary"
                      onClick={() => {
                        setSelected(String(t.id));
                        setTab("Agendar");
                      }}
                    >
                      Agendar procedimento
                    </button>
                  </div>
                  <button
                    className="bp-favorite-remove"
                    type="button"
                    aria-label={`Remover ${t.name} dos favoritos`}
                    disabled={busy}
                    onClick={() =>
                      act(async () => {
                        await api("favorites", "PUT", {
                          treatmentId: t.id,
                          active: false,
                        });
                        const updated = favorites.filter((id) => id !== t.id);
                        setFavorites(updated);
                        onFavoritesChange?.(updated);
                        setMessageKind("success");
                        setMessage("Removido dos favoritos.");
                      })
                    }
                  >
                    <Heart size={18} fill="currentColor" />
                  </button>
                </article>
              ))}
            {favorites.length === 0 && (
              <div className="bp-customer-empty">
                <Heart />
                <strong>Seus favoritos começam aqui</strong>
                <p>
                  Salve os procedimentos que despertarem seu interesse para
                  encontrá-los rapidamente depois.
                </p>
                <button
                  className="bp-button bp-button-outline"
                  onClick={() => setTab("Agendar")}
                >
                  Conhecer procedimentos
                </button>
              </div>
            )}
          </div>
        )}
        {!loading && !loadError && tab === "Configurações" && account && (
          <div className="bp-customer-settings">
            <span className="bp-eyebrow">Preferências e segurança</span>
            <h3>Configurações da conta</h3>
            <p>Gerencie seus dados, privacidade e acesso à conta BellaPelle.</p>
            <section>
              <div>
                <strong>Dados pessoais</strong>
                <small>
                  Atualize telefone, endereço e preferências de atendimento.
                </small>
              </div>
              <button onClick={() => setTab("Dados pessoais")}>Editar</button>
            </section>
            <section>
              <div>
                <strong>Privacidade</strong>
                <small>
                  Consulte ou envie solicitações relacionadas aos seus dados.
                </small>
              </div>
              <button onClick={() => setTab("Privacidade")}>Gerenciar</button>
            </section>
            <section>
              <div>
                <strong>Segurança da conta</strong>
                <small>{account.profile.email} · sessão autenticada</small>
              </div>
              <a href="/?acesso=login">Recuperar senha</a>
            </section>
            <button
              className="bp-settings-logout"
              disabled={busy}
              onClick={() =>
                act(async () => {
                  await api("auth/logout", "POST");
                  onLogout();
                })
              }
            >
              Sair da conta
            </button>
          </div>
        )}
        {!loading && !loadError && tab === "Privacidade" && account && (
          <div className="bp-customer-privacy">
            <h3>Solicitações de privacidade</h3>
            <p>
              Peça acesso aos seus dados, correção de informações ou registre
              uma solicitação de exclusão. A equipe responderá por aqui.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const body = Object.fromEntries(new FormData(form));
                act(async () => {
                  await api("privacy", "POST", body);
                  await load();
                  form.reset();
                  setMessageKind("success");
                  setMessage("Solicitação enviada.");
                });
              }}
            >
              <label>
                Tipo de solicitação
                <select name="tipo" required>
                  <option value="acesso">Acesso aos meus dados</option>
                  <option value="correcao">Correção de dados</option>
                  <option value="exclusao">Exclusão de dados</option>
                </select>
              </label>
              <label>
                Detalhes
                <textarea
                  name="descricao"
                  minLength={5}
                  maxLength={2000}
                  required
                />
              </label>
              <button disabled={busy}>Enviar solicitação</button>
            </form>
            {account.requests.map((r) => (
              <section key={r.id_pedido}>
                <strong>
                  {(
                    {
                      acesso: "Acesso",
                      correcao: "Correção",
                      exclusao: "Exclusão",
                    } as Record<string, string>
                  )[String(r.tipo)] || r.tipo}{" "}
                  · {r.status}
                </strong>
                <p>{r.descricao}</p>
                {r.resposta && <p>Resposta da clínica: {r.resposta}</p>}
                <small>{String(r.data).slice(0, 10)}</small>
              </section>
            ))}
          </div>
        )}
      </article>
    </div>
  );
}
