"use client";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Bell,
  Check,
  ChevronRight,
  Clock,
  Diamond,
  Heart,
  Home,
  MapPin,
  Search,
  UserRound,
  X,
} from "lucide-react";
import {
  availableDate,
  Booking,
  bookingSchema,
  categories,
  dateLabel,
  endTime,
  isPast,
  money,
  slots,
  today,
  Treatment,
  treatments as initialTreatments,
} from "@/lib/domain";
type Screen =
  | "home"
  | "search"
  | "favorites"
  | "detail"
  | "checkout"
  | "success"
  | "bookings";
const storeKey = "bellapelle-demo-v1";
export default function BeautyApp() {
  const [customerName, setCustomerName] = useState("Amanda");
  const [screen, setScreen] = useState<Screen>("home");
  const [catalog, setCatalog] = useState(initialTreatments);
  const [favorites, setFavorites] = useState<number[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [mode, setMode] = useState<"loading" | "mysql" | "demo" | "error">(
    "loading",
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(1);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todos");
  const [sort, setSort] = useState("relevance");
  const [date, setDate] = useState(availableDate);
  const [time, setTime] = useState("11:00");
  const [payment, setPayment] = useState<Booking["payment"]>("Pix");
  const [available, setAvailable] = useState<string[]>(slots);
  const [tab, setTab] = useState("Próximos");
  const [editing, setEditing] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<Booking | null>(null);
  const [modal, setModal] = useState<
    "date" | "specialist" | "notifications" | Booking | null
  >(null);
  const catalogTreatment =
    catalog.find((t) => t.id === selected) ??
    catalog[0] ??
    initialTreatments[0];
  const editingBooking = bookings.find((b) => b.id === editing);
  const treatment = editingBooking
    ? {
        ...catalogTreatment,
        price: editingBooking.price,
        duration: editingBooking.duration,
        specialistName:
          editingBooking.specialistName ?? catalogTreatment.specialistName,
      }
    : catalogTreatment;
  async function api(path: string, method = "GET", body?: unknown) {
    const r = await fetch("/api/" + path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error ?? "Não foi possível concluir.");
    return data;
  }
  async function load() {
    try {
      const data = await api("bootstrap");
      setMode(data.mode);
      setCatalog(data.treatments);
      if (data.customer?.name)
        setCustomerName(data.customer.name.split(" ")[0]);
      if (data.mode === "demo") {
        try {
          const saved = JSON.parse(localStorage.getItem(storeKey) ?? "{}");
          setFavorites(Array.isArray(saved.favorites) ? saved.favorites : []);
          setBookings(Array.isArray(saved.bookings) ? saved.bookings : []);
        } catch {
          localStorage.removeItem(storeKey);
        }
      } else {
        setFavorites(data.favorites);
        setBookings(data.bookings);
      }
      setError("");
    } catch (e) {
      setMode("error");
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
    const onHash = () => {
      const p = new URLSearchParams(location.hash.slice(1));
      const s = p.get("screen") as Screen;
      if (
        [
          "home",
          "search",
          "favorites",
          "detail",
          "checkout",
          "success",
          "bookings",
        ].includes(s)
      )
        setScreen(s);
      else setScreen("home");
      const id = Number(p.get("id"));
      if (Number.isSafeInteger(id) && id > 0) setSelected(id);
    };
    onHash();
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  useEffect(() => {
    if (mode === "demo")
      localStorage.setItem(storeKey, JSON.stringify({ favorites, bookings }));
  }, [favorites, bookings, mode]);
  useEffect(() => {
    if (!["detail", "checkout"].includes(screen)) return;
    let active = true;
    setAvailable([]);
    if (mode === "mysql") {
      api(`slots?date=${date}&treatmentId=${selected}&exclude=${editing ?? ""}`)
        .then((data) => {
          if (active) setAvailable(data.slots);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    } else if (mode === "demo") {
      setAvailable(
        slots.filter(
          (s) =>
            !isPast(date, s) &&
            !bookings.some(
              (b) =>
                b.id !== editing &&
                b.date === date &&
                b.time === s &&
                b.status === "confirmed",
            ),
        ),
      );
    }
    return () => {
      active = false;
    };
  }, [date, editing, screen, mode, bookings, selected]);
  function go(next: Screen, id = selected) {
    setScreen(next);
    setSelected(id);
    location.hash = `screen=${next}&id=${id}`;
    window.scrollTo({ top: 0, behavior: "instant" });
    setError("");
  }
  function openTreatment(id: number) {
    setEditing(null);
    setDate(availableDate());
    setTime("11:00");
    go("detail", id);
  }
  async function favorite(id: number) {
    if (busy) return;
    setBusy(true);
    try {
      const active = !favorites.includes(id);
      if (mode === "mysql")
        await api("favorites", "PUT", { treatmentId: id, active });
      if (mode === "demo" || mode === "mysql")
        setFavorites((f) => (active ? [...f, id] : f.filter((n) => n !== id)));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function confirm() {
    if (busy) return;
    setError("");
    const data = { treatmentId: selected, date, time, payment };
    const validation = bookingSchema.safeParse(data);
    if (!validation.success) {
      setError(validation.error.issues[0].message);
      return;
    }
    if (!available.includes(time)) {
      setError("Selecione um horário disponível.");
      return;
    }
    setBusy(true);
    try {
      let result: Booking;
      if (mode === "mysql")
        result = await api(
          editing ? `bookings/${editing}` : "bookings",
          editing ? "PATCH" : "POST",
          data,
        );
      else if (mode === "demo")
        result = {
          ...data,
          id: editing ?? crypto.randomUUID(),
          status: "confirmed",
          price: treatment.price,
          duration: treatment.duration,
        };
      else throw new Error("Aguarde a conexão com os dados.");
      setBookings((b) => [...b.filter((x) => x.id !== result.id), result]);
      setConfirmed(result);
      setEditing(null);
      go("success");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function cancel(b: Booking) {
    setBusy(true);
    try {
      if (mode === "mysql") await api(`bookings/${b.id}`, "DELETE");
      setBookings((list) =>
        list.map((x) => (x.id === b.id ? { ...x, status: "cancelled" } : x)),
      );
      setModal(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function reschedule(b: Booking) {
    setEditing(b.id);
    setDate(b.date);
    setTime(b.time);
    setPayment(b.payment === "Pix" ? "Pix" : "Cartão de crédito");
    setModal(null);
    go("detail", b.treatmentId);
  }
  const filtered = catalog
    .filter(
      (t) =>
        (category === "Todos" ||
          t.category === category ||
          (category === "Tecnologia" && t.id === 3)) &&
        `${t.name} ${t.description}`
          .normalize("NFD")
          .replace(/\p{Diacritic}/gu, "")
          .toLowerCase()
          .includes(
            query
              .normalize("NFD")
              .replace(/\p{Diacritic}/gu, "")
              .toLowerCase(),
          ),
    )
    .sort((a, b) =>
      sort === "price"
        ? a.price - b.price
        : sort === "duration"
          ? a.duration - b.duration
          : a.id - b.id,
    );
  function heart(t: Treatment) {
    return (
      <button
        className={"heart " + (favorites.includes(t.id) ? "is-favorite" : "")}
        aria-label={`${favorites.includes(t.id) ? "Remover" : "Adicionar"} ${t.name} ${favorites.includes(t.id) ? "dos" : "aos"} favoritos`}
        aria-pressed={favorites.includes(t.id)}
        onClick={() => favorite(t.id)}
      >
        <Heart size={19} />
      </button>
    );
  }
  function summary(
    t: Treatment,
    price = t.price,
    duration = t.duration,
    name = t.specialistName ?? "Dra. Marina Alves",
  ) {
    return (
      <div className="summary flex items-center gap-3">
        <div className="avatar square">
          {name
            .replace(/^Dra?\.\s*/, "")
            .split(" ")
            .map((s) => s[0])
            .slice(0, 2)
            .join("")}
        </div>
        <div className="min-w-0 flex-1">
          <h3>{t.name}</h3>
          <p>
            {name} · {duration} min
          </p>
        </div>
        <strong className="price">R$ {price}</strong>
      </div>
    );
  }
  function listCard(t: Treatment) {
    return (
      <article className="result-card" key={t.id}>
        <button className="result-link" onClick={() => openTreatment(t.id)}>
          <img src={t.image} alt={t.name} />
          <div className="result-copy">
            <h3>{t.name}</h3>
            <p>{t.description}</p>
            <p className="rating">
              ★ {t.rating.toString().replace(".", ",")} · {t.duration} min
            </p>
            <strong className="price">R$ {t.price}</strong>
          </div>
        </button>
        {heart(t)}
      </article>
    );
  }
  useEffect(() => {
    if (!modal) return;
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setModal(null);
      if (event.key === "Tab") {
        const nodes = Array.from(
          document.querySelectorAll<HTMLElement>(
            "[role=dialog] button:not([disabled]),[role=dialog] input:not([disabled]),[role=dialog] select",
          ),
        ).filter((n) => n.offsetParent !== null);
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", keydown);
      previous?.focus();
    };
  }, [modal]);
  function inCurrentTab(b: Booking) {
    if (tab === "Cancelados")
      return b.status === "cancelled" || b.status === "no_show";
    if (tab === "Concluídos")
      return (
        b.status === "completed" ||
        (mode === "demo" &&
          b.status === "confirmed" &&
          isPast(b.date, endTime(b.time, b.duration)))
      );
    return (
      (b.status === "confirmed" || b.status === "pending") &&
      !(mode === "demo" && isPast(b.date, endTime(b.time, b.duration)))
    );
  }
  function statusLabel(b: Booking) {
    if (b.status === "completed") return "Concluído";
    if (b.status === "cancelled") return "Cancelado";
    if (b.status === "no_show") return "Não compareceu";
    if (b.status === "pending") return "Pendente";
    return mode === "demo" && isPast(b.date, endTime(b.time, b.duration))
      ? "Concluído"
      : "Confirmado";
  }
  const showNav = ["home", "favorites", "bookings"].includes(screen);
  return (
    <div className={`app screen-${screen}`}>
      <header className="wide-header">
        <button
          className="brand"
          aria-label="BellaPelle, início"
          onClick={() => go("home")}
        >
          <span className="brand-mark">
            <Diamond size={24} />
          </span>
          <span>
            BellaPelle<small>BELEZA & BEM-ESTAR</small>
          </span>
        </button>
        <nav className="wide-nav" aria-label="Navegação principal">
          {(
            [
              { s: "home", label: "Início", icon: Home },
              { s: "search", label: "Explorar", icon: Search },
              { s: "favorites", label: "Favoritos", icon: Heart },
              { s: "bookings", label: "Agendamentos", icon: Clock },
            ] as const
          ).map((n) => {
            const active =
              screen === n.s ||
              (n.s === "search" && ["detail", "checkout"].includes(screen)) ||
              (n.s === "bookings" && screen === "success");
            return (
              <button
                key={n.s}
                className={active ? "selected" : ""}
                aria-current={active ? "page" : undefined}
                onClick={() => go(n.s)}
              >
                <n.icon size={18} />
                {n.label}
              </button>
            );
          })}
        </nav>
        <button
          className="wide-profile"
          aria-label="Abrir meu perfil"
          onClick={() => go("bookings")}
        >
          <span className="avatar">
            {customerName.slice(0, 2).toUpperCase()}
          </span>
          <span>
            {customerName}
            <small>Meu perfil</small>
          </span>
        </button>
      </header>
      {error && (
        <div role="alert" className="error-banner">
          {error}
          <button aria-label="Fechar aviso" onClick={() => setError("")}>
            <X size={18} />
          </button>
          {mode === "error" && <button onClick={load}>Tentar novamente</button>}
        </div>
      )}
      {mode === "loading" && (
        <div role="status" className="loading-bar">
          Carregando seus cuidados…
        </div>
      )}
      {screen === "home" && (
        <main className="home-content">
          <div className="statusbar">9:41</div>
          <header className="home-header">
            <div>
              <p>Bom dia, {customerName}</p>
              <h1>Cuide de você hoje</h1>
            </div>
            <button
              className="icon-button shadow"
              aria-label="Notificações"
              onClick={() => setModal("notifications")}
            >
              <Bell size={19} />
            </button>
            <button
              className="avatar"
              aria-label="Meu perfil"
              onClick={() => go("bookings")}
            >
              AM
            </button>
          </header>
          <button
            className="search-field"
            onClick={() => {
              setQuery("");
              setCategory("Todos");
              go("search");
            }}
          >
            <Search size={22} />
            <span>Busque tratamentos ou especialistas</span>
          </button>
          <section className="promo">
            <div className="bubble one" />
            <div className="bubble two" />
            <h2>
              BELEZA QUE
              <br />
              COMEÇA
              <br />
              PELO SEU BEM-ESTAR
            </h2>
            <p className="promo-description">
              Seu próximo momento de cuidado começa aqui.
              <br />
              Encontre o tratamento ideal para você.
            </p>
            <button onClick={() => go("search")}>Agendar agora</button>
          </section>
          <section className="section categories-section">
            <div className="section-heading">
              <h2>Categorias</h2>
              <button
                onClick={() => {
                  setCategory("Todos");
                  go("search");
                }}
              >
                Ver todas
              </button>
            </div>
            <div className="category-grid">
              {["Facial", "Corporal", "Depilação", "Tecnologia"].map((c, i) => (
                <button
                  key={c}
                  onClick={() => {
                    setCategory(c);
                    setQuery("");
                    go("search");
                  }}
                >
                  <img
                    src={
                      [
                        "/images/especialista.jpg",
                        "/images/corporal.jpg",
                        "/images/depilacao.jpg",
                        "/images/tecnologia.jpg",
                      ][i]
                    }
                    alt=""
                  />
                  <span>{c}</span>
                </button>
              ))}
            </div>
          </section>
          <section className="section popular-section">
            <div className="section-heading">
              <h2>Mais procurados</h2>
              <button
                onClick={() => {
                  setCategory("Todos");
                  go("search");
                }}
              >
                Ver todos
              </button>
            </div>
            <div className="popular-grid">
              {catalog.slice(0, 2).map((t) => (
                <article className="popular-card" key={t.id}>
                  <button
                    onClick={() => openTreatment(t.id)}
                    className="popular-link"
                  >
                    <img src={t.image} alt={t.name} />
                    <span className="badge">Popular</span>
                    <h3>{t.shortName}</h3>
                    <p>
                      ★ {t.rating.toString().replace(".", ",")} · {t.duration}{" "}
                      min
                    </p>
                    <strong className="price">R$ {t.price}</strong>
                  </button>
                  {heart(t)}
                </article>
              ))}
            </div>
          </section>
          <section className="section specialists">
            <h2>Especialistas perto de você</h2>
            <button
              className="specialist"
              onClick={() => setModal("specialist")}
            >
              <img
                src="/images/especialista.jpg"
                alt={treatment.specialistName ?? "Dra. Marina Alves"}
              />
              <span>
                <h3>{treatment.specialistName ?? "Dra. Marina Alves"}</h3>
                <p>
                  Estética avançada ·{" "}
                  {treatment.rating.toString().replace(".", ",")} ★
                </p>
              </span>
              <MapPin className="wine" size={22} />
            </button>
          </section>
        </main>
      )}
      {(screen === "search" || screen === "favorites") && (
        <main className="search-content">
          <div className="statusbar">9:41</div>
          <header className="page-heading">
            <button aria-label="Voltar ao início" onClick={() => go("home")}>
              <ArrowLeft size={24} />
            </button>
            <h1>{screen === "search" ? "Buscar" : "Favoritos"}</h1>
          </header>
          <p className="subtitle">
            {screen === "search"
              ? "Encontre o cuidado ideal para você"
              : "Seus cuidados preferidos, em um só lugar"}
          </p>
          {screen === "search" && (
            <>
              <label className="search-field">
                <Search size={22} />
                <input
                  placeholder="Massagem, facial, depilação..."
                  aria-label="Buscar tratamentos"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {query && (
                  <button
                    aria-label="Limpar busca"
                    onClick={() => setQuery("")}
                  >
                    <X size={17} />
                  </button>
                )}
              </label>
              <div className="chips">
                {categories.map((c) => (
                  <button
                    className={category === c ? "active" : ""}
                    key={c}
                    onClick={() => setCategory(c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <div className="results-heading">
                <strong>
                  {filtered.length}{" "}
                  {filtered.length === 1
                    ? "resultado encontrado"
                    : "resultados encontrados"}
                </strong>
                <select
                  aria-label="Ordenar resultados"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                >
                  <option value="relevance">Mais relevantes</option>
                  <option value="price">Menor preço</option>
                  <option value="duration">Menor duração</option>
                </select>
              </div>
            </>
          )}
          <div className="results">
            {(screen === "favorites"
              ? catalog.filter((t) => favorites.includes(t.id))
              : filtered
            ).map(listCard)}
          </div>
          {((screen === "favorites" && !favorites.length) ||
            (screen === "search" && !filtered.length)) && (
            <div className="empty">
              <Heart />
              <h2>
                {screen === "favorites"
                  ? "Seus favoritos aparecem aqui"
                  : "Nenhum tratamento encontrado"}
              </h2>
              <p>
                {screen === "favorites"
                  ? "Toque no coração para salvar um cuidado."
                  : "Experimente outra busca ou categoria."}
              </p>
            </div>
          )}
          <section className="search-footer">
            <h2>
              {screen === "search"
                ? "Não encontrou o que procurava?"
                : "Encontre seu próximo cuidado"}
            </h2>
            <p>Explore todas as categorias e especialidades.</p>
            <button
              className="primary w-full"
              onClick={() => {
                setCategory("Todos");
                setQuery("");
                go("search");
              }}
            >
              Ver todas as categorias
            </button>
          </section>
        </main>
      )}
      {screen === "detail" && (
        <div className="detail-shell">
          <div className="hero">
            <picture>
              <source media="(min-width: 768px)" srcSet={treatment.image} />
              <img
                src={
                  treatment.id === 1 ? "/images/facial.jpg" : treatment.image
                }
                alt={treatment.name}
              />
            </picture>
            <button
              className="icon-button back"
              aria-label="Voltar"
              onClick={() => go("search")}
            >
              <ArrowLeft />
            </button>
            <div className="hero-favorite">{heart(treatment)}</div>
          </div>
          <main className="detail-content">
            <span className="badge">Popular</span>
            <h1>{treatment.name}</h1>
            <div className="detail-rating">
              <p>
                ★ {treatment.rating.toString().replace(".", ",")} ·{" "}
                {treatment.reviews} avaliações
              </p>
              <strong className="price">R$ {treatment.price}</strong>
            </div>
            <div className="facts">
              <div>
                <Clock />
                <span>{treatment.duration} min</span>
              </div>
              <div>
                <Diamond />
                <span>{treatment.category}</span>
              </div>
              <div>
                <Check />
                <span>
                  {treatment.id === 1
                    ? "Resultado imediato"
                    : "Cuidado personalizado"}
                </span>
              </div>
            </div>
            <section>
              <h2>Sobre o tratamento</h2>
              <p>{treatment.about}</p>
            </section>
            <section className="expert-section">
              <h2>Sua especialista</h2>
              <button
                className="specialist"
                onClick={() => setModal("specialist")}
              >
                <img
                  src="/images/especialista.jpg"
                  alt={treatment.specialistName ?? "Dra. Marina Alves"}
                />
                <span>
                  <h3>{treatment.specialistName ?? "Dra. Marina Alves"}</h3>
                  <p>
                    Esteticista • {treatment.experience ?? 8} anos de
                    experiência
                  </p>
                </span>
                <ChevronRight size={20} className="wine" />
              </button>
            </section>
            <section className="schedule-section">
              <h2>Horários disponíveis</h2>
              <button className="date-link" onClick={() => setModal("date")}>
                {dateLabel(date)} · Alterar data
              </button>
              <div className="time-grid">
                {slots.map((s) => (
                  <button
                    disabled={!available.includes(s)}
                    className={time === s ? "active" : ""}
                    key={s}
                    onClick={() => setTime(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
              {available.length === 0 && (
                <p className="helper">
                  Sem horários disponíveis nesta data. Escolha outra data.
                </p>
              )}
            </section>
          </main>
          <footer className="booking-bar">
            <div>
              <strong>R$ {treatment.price}</strong>
              <p>por sessão</p>
            </div>
            <button
              className="primary"
              disabled={!available.includes(time) || busy}
              onClick={() => go("checkout")}
            >
              {editing ? "Reagendar horário" : "Agendar horário"}
            </button>
          </footer>
        </div>
      )}
      {screen === "checkout" && (
        <main className="flow-content">
          <header className="flow-heading">
            <button
              className="icon-button"
              aria-label="Voltar"
              onClick={() => go("detail")}
            >
              <ArrowLeft />
            </button>
            <h1>
              {editing ? "Reagendar atendimento" : "Confirmar agendamento"}
            </h1>
          </header>
          <div className="panel checkout-service">{summary(treatment)}</div>
          <section className="checkout-date">
            <h2>Data e horário</h2>
            <div className="panel date-panel">
              <div>
                <h3>{dateLabel(date, true)}</h3>
                <p>
                  {time} – {endTime(time, treatment.duration)}
                </p>
              </div>
              <button className="pill" onClick={() => setModal("date")}>
                Alterar
              </button>
            </div>
          </section>
          <section className="checkout-payment">
            <h2>Pagamento</h2>
            <fieldset className="payments">
              <legend className="sr-only">Forma de pagamento</legend>
              {(["Pix", "Cartão de crédito"] as const).map((p) => (
                <label
                  key={p}
                  className={"panel " + (payment === p ? "chosen" : "")}
                >
                  <strong>{p}</strong>
                  <input
                    type="radio"
                    name="payment"
                    checked={payment === p}
                    onChange={() => setPayment(p)}
                  />
                </label>
              ))}
            </fieldset>
          </section>
          <div className="panel totals">
            <div>
              <span>Sessão</span>
              <span>{money(treatment.price)}</span>
            </div>
            <div>
              <span>Taxa de serviço</span>
              <span>{money(0)}</span>
            </div>
            <div className="total">
              <strong>Total</strong>
              <strong className="wine">{money(treatment.price)}</strong>
            </div>
          </div>
          <footer className="action-footer">
            <button
              className="primary w-full"
              disabled={busy || !available.includes(time)}
              onClick={confirm}
            >
              {busy ? "Confirmando…" : "Confirmar agendamento"}
            </button>
          </footer>
        </main>
      )}
      {screen === "success" && (
        <main className="success-content">
          <div className="success-symbol">
            <div>
              <Check size={32} strokeWidth={3} />
            </div>
          </div>
          <h1>Agendamento confirmado!</h1>
          <p className="success-subtitle">
            Seu horário está reservado. Chegue
            <br />
            10 minutos antes do horário.
          </p>
          {confirmed ? (
            <div className="panel receipt">
              <div className="receipt-heading">
                <div className="avatar">MA</div>
                <div>
                  <h3>
                    {catalog.find((t) => t.id === confirmed.treatmentId)?.name}
                  </h3>
                  <p>
                    {confirmed.specialistName ?? "Dra. Marina Alves"} ·
                    Esteticista
                  </p>
                </div>
              </div>
              <dl>
                <div>
                  <dt>Data</dt>
                  <dd>{dateLabel(confirmed.date)}</dd>
                </div>
                <div>
                  <dt>Horário</dt>
                  <dd>
                    {confirmed.time} –{" "}
                    {endTime(confirmed.time, confirmed.duration)}
                  </dd>
                </div>
                <div>
                  <dt>Pagamento</dt>
                  <dd>
                    {confirmed.payment} ·{" "}
                    <span className="wine">{money(confirmed.price)}</span>
                  </dd>
                </div>
              </dl>
            </div>
          ) : (
            <p>Consulte seus agendamentos para ver os detalhes.</p>
          )}
          <div className="success-actions">
            <button className="primary" onClick={() => go("bookings")}>
              Ver meus agendamentos
            </button>
            <button className="outline" onClick={() => go("home")}>
              Voltar ao início
            </button>
          </div>
        </main>
      )}
      {screen === "bookings" && (
        <main className="appointments-content">
          <p>Perfil</p>
          <h1>Meus agendamentos</h1>
          <div className="booking-tabs">
            {["Próximos", "Concluídos", "Cancelados"].map((t) => (
              <button
                key={t}
                className={tab === t ? "active" : ""}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="appointments">
            {bookings
              .filter(inCurrentTab)
              .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
              .map((b) => (
                <article className="panel appointment" key={b.id}>
                  <div className="appointment-top">
                    <span className="badge">{statusLabel(b)}</span>
                    <p>
                      {dateLabel(b.date)} · {b.time}
                    </p>
                  </div>
                  {summary(
                    catalog.find((t) => t.id === b.treatmentId)!,
                    b.price,
                    b.duration,
                    b.specialistName,
                  )}
                  <div className="appointment-actions">
                    {(b.status === "confirmed" || b.status === "pending") &&
                      !isPast(b.date, b.time) && (
                        <button
                          className="outline"
                          onClick={() => reschedule(b)}
                        >
                          Reagendar
                        </button>
                      )}
                    <button className="primary" onClick={() => setModal(b)}>
                      Ver detalhes
                    </button>
                  </div>
                </article>
              ))}
            {!bookings.some(inCurrentTab) && (
              <div className="empty">
                <Clock />
                <h2>Nenhum agendamento por aqui</h2>
                <p>Escolha um tratamento para reservar seu momento.</p>
                <button className="primary" onClick={() => go("search")}>
                  Explorar tratamentos
                </button>
              </div>
            )}
          </div>
        </main>
      )}
      {showNav && (
        <nav className="bottom-nav" aria-label="Navegação principal">
          {(
            [
              { s: "home", label: "Início", icon: Home },
              { s: "search", label: "Buscar", icon: Search },
              { s: "favorites", label: "Favoritos", icon: Heart },
              { s: "bookings", label: "Perfil", icon: UserRound },
            ] as const
          ).map((n) => (
            <button
              key={n.s}
              aria-current={screen === n.s ? "page" : undefined}
              className={screen === n.s ? "selected" : ""}
              onClick={() => go(n.s)}
            >
              <span>
                <n.icon size={23} />
              </span>
              {n.label}
            </button>
          ))}
        </nav>
      )}
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-label={
              modal === "date" ? "Alterar data e horário" : "Detalhes"
            }
            className="modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close icon-button"
              aria-label="Fechar"
              onClick={() => setModal(null)}
              autoFocus
            >
              <X />
            </button>
            {modal === "date" ? (
              <>
                <h2>Data e horário</h2>
                <label className="date-input">
                  Escolha a data
                  <input
                    type="date"
                    min={today()}
                    value={date}
                    onChange={(e) => {
                      if (e.target.value) setDate(e.target.value);
                    }}
                  />
                </label>
                <div className="time-grid">
                  {slots.map((s) => (
                    <button
                      key={s}
                      disabled={!available.includes(s)}
                      className={time === s ? "active" : ""}
                      onClick={() => setTime(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <button
                  className="primary w-full"
                  disabled={!available.includes(time)}
                  onClick={() => setModal(null)}
                >
                  Salvar horário
                </button>
              </>
            ) : modal === "specialist" ? (
              <>
                <img
                  className="expert-photo"
                  src="/images/especialista.jpg"
                  alt={treatment.specialistName ?? "Dra. Marina Alves"}
                />
                <h2>{treatment.specialistName ?? "Dra. Marina Alves"}</h2>
                <p>
                  Esteticista · {treatment.experience ?? 8} anos de experiência
                </p>
                <p>
                  Estética avançada · ★{" "}
                  {treatment.rating.toString().replace(".", ",")}
                </p>
                <p>
                  Atendimento com horário marcado. Escolha um dos tratamentos
                  disponíveis para reservar sua sessão.
                </p>
                <button
                  className="primary w-full"
                  onClick={() => {
                    setModal(null);
                    go("search");
                  }}
                >
                  Ver tratamentos
                </button>
              </>
            ) : modal === "notifications" ? (
              <>
                <h2>Notificações</h2>
                <p>
                  {
                    bookings.filter(
                      (b) =>
                        (b.status === "confirmed" || b.status === "pending") &&
                        !isPast(b.date, b.time),
                    ).length
                  }{" "}
                  agendamento(s) futuro(s) confirmado(s).
                </p>
                <button
                  className="primary w-full"
                  onClick={() => {
                    setModal(null);
                    go("bookings");
                  }}
                >
                  Ver meus agendamentos
                </button>
              </>
            ) : (
              <>
                <h2>Detalhes do agendamento</h2>
                <h3>{catalog.find((t) => t.id === modal.treatmentId)?.name}</h3>
                <p>{modal.specialistName ?? "Dra. Marina Alves"}</p>
                <p>
                  {dateLabel(modal.date, true)} · {modal.time} –{" "}
                  {endTime(modal.time, modal.duration)}
                </p>
                <p>
                  {modal.payment} · {money(modal.price)}
                </p>
                <p>Status: {statusLabel(modal)}</p>
                <p className="helper">
                  Forma de pagamento registrada. Nenhuma cobrança on-line foi
                  realizada.
                </p>
                {modal.status === "confirmed" &&
                  !isPast(modal.date, modal.time) && (
                    <>
                      <button
                        className="primary w-full"
                        onClick={() => reschedule(modal)}
                      >
                        Reagendar
                      </button>
                      <button
                        className="outline w-full"
                        disabled={busy}
                        onClick={() => {
                          if (
                            window.confirm("Deseja cancelar este agendamento?")
                          )
                            void cancel(modal);
                        }}
                      >
                        Cancelar agendamento
                      </button>
                    </>
                  )}
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
