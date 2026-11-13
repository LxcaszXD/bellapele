"use client";

import CustomerServices from "./customer-services";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Building2,
  Flower2,
  Heart,
  Menu,
  ShieldCheck,
  Sparkles,
  UserRound,
  UsersRound,
  X,
  Star,
} from "lucide-react";

type Procedure = {
  id: number;
  name: string;
  category: string;
  duration: number;
  price: number;
  description: string;
  image: string | null;
  professional: { id: number; name: string; specialty: string } | null;
};
type Professional = {
  id: number;
  name: string;
  specialty: string;
  image: string | null;
  experience: number;
};
type Review = {
  id: number;
  rating: number;
  comment: string;
  date: string;
  procedure: string;
  customer: string;
};
type Article = {
  id: number;
  title: string;
  summary: string;
  content: string;
  image: string | null;
  date: string | null;
};
type PublicContent = {
  procedures: Procedure[];
  professionals: Professional[];
  reviews: Review[];
  posts: Article[];
  contact: {
    phone: string;
    whatsapp: string;
    email: string;
    address: string;
    hours: string;
    cnpj: string;
    privacyPolicy: string;
  } | null;
};
type CustomerSession = { name: string; csrfToken: string };
type AccessMode = "login" | "register" | "forgot" | "reset";
type CustomerTab =
  | "Visão geral"
  | "Agendar"
  | "Meus agendamentos"
  | "Dados pessoais"
  | "Configurações"
  | "Favoritos"
  | "Privacidade";

const navLinks = [
  ["Início", "inicio"],
  ["Procedimentos", "procedimentos"],
  ["Sobre", "sobre"],
  ["Equipe", "equipe"],
  ["Depoimentos", "depoimentos"],
  ["Conteúdos", "blog"],
  ["Contato", "contato"],
] as const;
const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const safeImage = (url: string | null | undefined, fallback: string) =>
  url || fallback;
const fallbackProcedureImage = (category: string) => {
  const value = category.toLocaleLowerCase("pt-BR");
  if (/facial|peeling|manchas/.test(value))
    return "/images/bellapelle-facial-new.webp";
  if (/corporal|massagem|laser/.test(value))
    return "/images/bellapelle-body-new.webp";
  if (/tecnologia|equipamento/.test(value))
    return "/images/bellapelle-body-new.webp";
  return "/images/bellapelle-editorial-new.webp";
};
const professionalPortraits = [
  "/images/bellapelle-team-new.webp",
  "/images/bellapelle-team2-new.webp",
  "/images/bellapelle-team3-new.webp",
];

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuClosing, setMenuClosing] = useState(false);
  const menuCloseTimer = useRef<number | null>(null);
  const [headerScrolled, setHeaderScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState("inicio");
  const [content, setContent] = useState<PublicContent>({
    procedures: [],
    professionals: [],
    reviews: [],
    posts: [],
    contact: null,
  });
  const [contentLoading, setContentLoading] = useState(true);
  const [contentError, setContentError] = useState("");
  const [category, setCategory] = useState("Todos");
  const [selectedProcedure, setSelectedProcedure] = useState<number | null>(
    null,
  );
  const [article, setArticle] = useState<number | null>(null);
  const [access, setAccess] = useState(false);
  const [accessMode, setAccessMode] = useState<AccessMode>("login");
  const [resetToken, setResetToken] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [customer, setCustomer] = useState<CustomerSession | null>(null);
  const [services, setServices] = useState(false);
  const [servicesTab, setServicesTab] = useState<CustomerTab>("Visão geral");
  const [initialTreatment, setInitialTreatment] = useState<number | null>(null);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [favorites, setFavorites] = useState<number[]>([]);
  const [pendingFavorite, setPendingFavorite] = useState<number | null>(null);
  const [favoriteBusyId, setFavoriteBusyId] = useState<number | null>(null);
  const [favoriteFeedback, setFavoriteFeedback] = useState("");

  function openMobileMenu() {
    if (menuCloseTimer.current !== null) {
      window.clearTimeout(menuCloseTimer.current);
      menuCloseTimer.current = null;
    }
    setMenuClosing(false);
    setMenuOpen(true);
  }

  function closeMobileMenu() {
    if (!menuOpen) return;
    setMenuOpen(false);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setMenuClosing(false);
      return;
    }
    setMenuClosing(true);
    if (menuCloseTimer.current !== null) {
      window.clearTimeout(menuCloseTimer.current);
    }
    menuCloseTimer.current = window.setTimeout(() => {
      setMenuClosing(false);
      menuCloseTimer.current = null;
    }, 240);
  }

  useEffect(
    () => () => {
      if (menuCloseTimer.current !== null) {
        window.clearTimeout(menuCloseTimer.current);
      }
    },
    [],
  );

  async function loadPublicContent() {
    setContentLoading(true);
    setContentError("");
    try {
      const response = await fetch("/api/public", { cache: "no-store" });
      if (!response.ok)
        throw new Error("Não foi possível carregar o conteúdo.");
      setContent(await response.json());
    } catch (error) {
      setContentError((error as Error).message);
    } finally {
      setContentLoading(false);
    }
  }

  useEffect(() => {
    void loadPublicContent();
    const params = new URLSearchParams(window.location.search);
    const token = params.get("reset");
    if (token) {
      setResetToken(token);
      setAccessMode("reset");
      setAccess(true);
      window.history.replaceState(null, "", "/");
    } else if (params.get("acesso") === "login") {
      setAccessMode("login");
      setAccess(true);
      window.history.replaceState(null, "", "/");
    }
    fetch("/api/customer/auth/session")
      .then((response) => (response.ok ? response.json() : null))
      .then(async (session) => {
        if (session?.name) {
          setCustomer({ name: session.name, csrfToken: session.csrfToken });
          const bootstrap = await fetch("/api/customer/bootstrap", {
            cache: "no-store",
          });
          if (bootstrap.ok) {
            const data = await bootstrap.json();
            setFavorites(data.favorites || []);
          }
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const updateHeader = () => setHeaderScrolled(window.scrollY > 24);
    updateHeader();
    window.addEventListener("scroll", updateHeader, { passive: true });
    return () => window.removeEventListener("scroll", updateHeader);
  }, []);

  useEffect(() => {
    const sections = navLinks
      .map(([, id]) => document.getElementById(id))
      .filter(Boolean) as HTMLElement[];
    if (!sections.length) return;

    let frame = 0;
    const updateActiveSection = () => {
      frame = 0;
      const headerBottom =
        document.querySelector<HTMLElement>(".bp-header")?.getBoundingClientRect()
          .bottom ?? 82;
      const activationLine = headerBottom + 24;
      let current = sections[0];

      for (const section of sections) {
        if (section.getBoundingClientRect().top <= activationLine) {
          current = section;
        } else {
          break;
        }
      }
      setActiveSection(current.id);
    };
    const scheduleUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(updateActiveSection);
    };

    updateActiveSection();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate, { passive: true });
    return () => {
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (
      !access &&
      selectedProcedure === null &&
      article === null &&
      !privacyOpen
    )
      return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAccess(false);
        setSelectedProcedure(null);
        setArticle(null);
        setPrivacyOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [access, selectedProcedure, article, privacyOpen]);

  const categories = useMemo(
    () => [
      "Todos",
      ...Array.from(
        new Set(
          content.procedures
            .map((procedure) => procedure.category)
            .filter(Boolean),
        ),
      ),
    ],
    [content.procedures],
  );
  const visibleProcedures = useMemo(
    () =>
      category === "Todos"
        ? content.procedures
        : content.procedures.filter(
            (procedure) => procedure.category === category,
          ),
    [category, content.procedures],
  );
  const currentProcedure =
    content.procedures.find(
      (procedure) => procedure.id === selectedProcedure,
    ) ?? null;
  const currentArticle =
    content.posts.find((post) => post.id === article) ?? null;

  function openAccess(tab: CustomerTab, treatmentId: number | null = null) {
    setServicesTab(tab);
    setInitialTreatment(treatmentId);
    if (customer) {
      setServices(true);
      return;
    }
    setAccessMode("login");
    setLoginError("");
    setAccess(true);
  }

  function bookingClick(
    event: React.MouseEvent,
    treatmentId: number | null = null,
  ) {
    event.preventDefault();
    openAccess("Agendar", treatmentId);
  }

  async function saveFavorite(id: number, active: boolean, csrf: string) {
    const response = await fetch("/api/customer/favorites", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": csrf,
      },
      body: JSON.stringify({ treatmentId: id, active }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok)
      throw Error(data.error || "Não foi possível atualizar os favoritos.");
  }

  async function toggleFavorite(id: number) {
    if (!customer) {
      setPendingFavorite(id);
      openAccess("Visão geral");
      return;
    }
    const adding = !favorites.includes(id);
    setFavoriteBusyId(id);
    setFavoriteFeedback("");
    try {
      await saveFavorite(id, adding, customer.csrfToken);
      setFavorites((current) =>
        adding
          ? current.includes(id)
            ? current
            : [...current, id]
          : current.filter((favorite) => favorite !== id),
      );
      setFavoriteFeedback(
        adding
          ? "Procedimento salvo nos favoritos."
          : "Procedimento removido dos favoritos.",
      );
    } catch (error) {
      setFavoriteFeedback((error as Error).message);
    } finally {
      setFavoriteBusyId(null);
    }
  }

  async function activateCustomer(session: {
    name: string;
    csrfToken: string;
  }) {
    const nextCustomer = { name: session.name, csrfToken: session.csrfToken };
    setCustomer(nextCustomer);
    setAccess(false);
    try {
      const bootstrapResponse = await fetch("/api/customer/bootstrap", {
        cache: "no-store",
      });
      if (!bootstrapResponse.ok)
        throw Error("Não foi possível carregar os seus favoritos.");
      const bootstrap = await bootstrapResponse.json();
      let saved: number[] = bootstrap.favorites || [];
      if (pendingFavorite !== null) {
        await saveFavorite(pendingFavorite, true, nextCustomer.csrfToken);
        saved = saved.includes(pendingFavorite)
          ? saved
          : [...saved, pendingFavorite];
        setFavoriteFeedback("Procedimento salvo nos favoritos.");
        setPendingFavorite(null);
      } else {
        setServices(true);
      }
      setFavorites(saved);
    } catch (error) {
      setFavoriteFeedback((error as Error).message);
      setServices(false);
    }
  }

  async function submitAccess(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setLoginError("");
    const body = Object.fromEntries(new FormData(event.currentTarget));
    try {
      if (accessMode === "register") {
        if (String(body.password) !== String(body.confirm_password))
          throw Error("As senhas não coincidem.");
        const response = await fetch("/api/customer/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok)
          throw Error(data.error || "Não foi possível criar a conta.");
        const session = await fetch("/api/customer/auth/session").then(
          (result) => result.json(),
        );
        await activateCustomer(session);
        return;
      }
      if (accessMode === "forgot") {
        await Promise.all(
          ["/api/customer/auth/forgot", "/api/clinic/auth/forgot"].map((url) =>
            fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            }),
          ),
        );
        setLoginError(
          "Se o e-mail estiver cadastrado, você receberá as instruções para redefinir sua senha.",
        );
        return;
      }
      if (accessMode === "reset") {
        const payload = { ...body, token: resetToken };
        let response = await fetch("/api/customer/auth/reset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!response.ok)
          response = await fetch("/api/clinic/auth/reset", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
        const data = await response.json().catch(() => ({}));
        if (!response.ok)
          throw Error(
            data.error ||
              "O link expirou ou não é válido. Solicite uma nova redefinição.",
          );
        setAccessMode("login");
        setLoginError("Senha redefinida. Entre com sua nova senha.");
        return;
      }
      let response = await fetch("/api/customer/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (response.ok) {
        const session = await fetch("/api/customer/auth/session").then(
          (result) => result.json(),
        );
        await activateCustomer(session);
        return;
      }
      if (response.status === 428) {
        setRegisterEmail(String(body.email || ""));
        setAccessMode("register");
        setLoginError(
          "Encontramos seu cadastro. Confirme seus dados para criar sua senha.",
        );
        return;
      }
      response = await fetch("/api/clinic/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (response.ok) {
        window.location.assign("/admin");
        return;
      }
      const data = await response.json().catch(() => ({}));
      throw Error(data.error || "E-mail ou senha inválidos.");
    } catch (error) {
      setLoginError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const assignedPortraits = (() => {
    const used = new Set<string>();
    return content.professionals.map((person, index) => {
      if (person.image && !used.has(person.image)) {
        used.add(person.image);
        return person.image;
      }
      const portrait = professionalPortraits.find((image) => !used.has(image));
      const chosen =
        portrait || professionalPortraits[index % professionalPortraits.length];
      used.add(chosen);
      return chosen;
    });
  })();
  return (
    <main className="bp">
      <header
        className={`bp-header${headerScrolled ? " scrolled" : ""}`}
        data-motion="rise"
        onKeyDown={(event) => {
          if (event.key === "Escape" && menuOpen) {
            closeMobileMenu();
            document.querySelector<HTMLButtonElement>(".bp-menu")?.focus();
          }
        }}
      >
        <div className="bp-header-inner">
          <a
            className="bp-brand"
            href="#inicio"
            aria-label="BellaPelle — início"
            data-motion="scale"
          >
            <img
              src="/images/logo-bellapelle.png"
              alt="BellaPelle"
              width="1448"
              height="1086"
            />
          </a>
          <button
            className="bp-menu"
            aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={menuOpen}
            aria-controls="bp-primary-navigation"
            onClick={() => (menuOpen ? closeMobileMenu() : openMobileMenu())}
            data-motion="right"
          >
            {menuOpen ? <X /> : <Menu />}
          </button>
          <nav
            id="bp-primary-navigation"
            className={`bp-nav${menuClosing ? " closing" : menuOpen ? " open" : ""}`}
            aria-label="Navegação principal"
          >
            {navLinks.map(([label, id]) => (
              <a
                key={id}
                className={activeSection === id ? "active" : ""}
                href={`#${id}`}
                aria-current={activeSection === id ? "location" : undefined}
                onClick={closeMobileMenu}
                data-motion="stagger"
                data-motion-group="navbar-links"
              >
                {label}
              </a>
            ))}
            <button
              className="bp-nav-mobile-login"
              data-motion="stagger"
              data-motion-group="navbar-links"
              onClick={() => {
                closeMobileMenu();
                openAccess("Visão geral");
              }}
            >
              <UserRound size={17} /> Acessar minha conta
            </button>
          </nav>
          <div className="bp-header-actions" data-motion="right">
            <button
              className="bp-login"
              onClick={() => {
                closeMobileMenu();
                openAccess("Visão geral");
              }}
              aria-label={customer ? "Abrir minha conta" : "Entrar"}
            >
              <UserRound size={17} />
              <span>{customer ? customer.name.split(" ")[0] : "Entrar"}</span>
            </button>
            <button
              className="bp-button bp-button-primary bp-header-booking"
              onClick={(event) => {
                closeMobileMenu();
                bookingClick(event);
              }}
            >
              <span>Agendar</span>
              <ArrowUpRight size={16} />
            </button>
          </div>
        </div>
        {(menuOpen || menuClosing) && (
          <button
            className="bp-menu-backdrop"
            aria-label="Fechar menu"
            onClick={closeMobileMenu}
          />
        )}
      </header>

      <section id="inicio" className="bp-hero" aria-labelledby="hero-title">
        <div className="bp-container bp-hero-grid">
          <div className="bp-hero-copy" data-motion="left">
            <span className="bp-eyebrow">
              <span /> Beleza, saúde e autoestima
            </span>
            <h1 id="hero-title">
              O cuidado que sua pele <em>merece.</em>
            </h1>
            <p>
              Procedimentos estéticos personalizados, conduzidos com atenção,
              segurança e respeito à sua individualidade.
            </p>
            <div className="bp-hero-actions">
              <button
                className="bp-button bp-button-primary"
                onClick={(event) => bookingClick(event)}
              >
                Agendar consulta <ArrowUpRight size={17} />
              </button>
              <a className="bp-button bp-button-light" href="#procedimentos">
                Explorar procedimentos <ArrowDownRight size={16} />
              </a>
            </div>
            <div className="bp-hero-proof">
              <div>
                <strong>
                  {contentLoading
                    ? "—"
                    : content.procedures.length.toString().padStart(2, "0")}
                </strong>
                <span>
                  procedimentos
                  <br />
                  disponíveis
                </span>
              </div>
              <div>
                <strong>
                  {contentLoading
                    ? "—"
                    : content.professionals.length.toString().padStart(2, "0")}
                </strong>
                <span>
                  profissionais
                  <br />
                  na equipe
                </span>
              </div>
              <span className="bp-proof-note">
                <ShieldCheck size={16} /> Atendimento com avaliação profissional
              </span>
            </div>
          </div>
        </div>
      </section>

      <section
        className="bp-trust-strip bp-container"
        aria-label="Diferenciais"
        data-motion="rise"
      >
        <div>
          <span className="bp-trust-icon">
            <Sparkles />
          </span>
          <div>
            <strong>Planos personalizados</strong>
            <small>Para seus objetivos e necessidades</small>
          </div>
        </div>
        <div>
          <span className="bp-trust-icon">
            <ShieldCheck />
          </span>
          <div>
            <strong>Cuidado responsável</strong>
            <small>Orientação profissional em cada etapa</small>
          </div>
        </div>
        <div>
          <span className="bp-trust-icon">
            <Heart />
          </span>
          <div>
            <strong>Atendimento acolhedor</strong>
            <small>Respeito e atenção em cada visita</small>
          </div>
        </div>
      </section>

      <section id="procedimentos" className="bp-section bp-procedures-section" data-motion="rise">
        <div className="bp-container">
          <div className="bp-section-heading bp-section-heading-split">
            <div>
              <span className="bp-eyebrow">Cuidado sob medida</span>
              <h2>
                Encontre o procedimento <em>ideal para você.</em>
              </h2>
            </div>
            <p>
              Conheça os procedimentos ativos da clínica e escolha o cuidado que
              faz sentido para o seu momento.
            </p>
          </div>
          {content.procedures.length > 0 && (
            <div
              className="bp-category-list"
              role="group"
              aria-label="Filtrar procedimentos por categoria"
            >
              {categories.map((item) => (
                <button
                  key={item}
                  className={category === item ? "active" : ""}
                  onClick={() => setCategory(item)}
                  aria-pressed={category === item}
                >
                  {item}
                </button>
              ))}
            </div>
          )}
          {favoriteFeedback && (
            <p className="bp-favorite-feedback" role="status">
              {favoriteFeedback}
            </p>
          )}
          {contentLoading ? (
            <div
              className="bp-procedure-grid"
              aria-label="Carregando procedimentos"
            >
              {[0, 1, 2].map((key) => (
                <div className="bp-skeleton-card" key={key} />
              ))}
            </div>
          ) : contentError ? (
            <div className="bp-state-card">
              <p>{contentError}</p>
              <button
                className="bp-button bp-button-outline"
                onClick={() => void loadPublicContent()}
              >
                Tentar novamente <ArrowRight size={15} />
              </button>
            </div>
          ) : visibleProcedures.length === 0 ? (
            <div className="bp-state-card">
              <Flower2 />
              <h3>
                {category === "Todos"
                  ? "Estamos preparando o catálogo"
                  : "Nenhum procedimento nesta categoria"}
              </h3>
              <p>
                {category === "Todos"
                  ? "Assim que a clínica publicar os procedimentos, eles aparecerão aqui."
                  : "Escolha outra categoria para conhecer os procedimentos disponíveis."}
              </p>
              {category !== "Todos" && (
                <button
                  className="bp-button bp-button-outline"
                  onClick={() => setCategory("Todos")}
                >
                  Ver todas as categorias
                </button>
              )}
              {category === "Todos" && (
                <button
                  className="bp-button bp-button-primary"
                  onClick={() => openAccess("Agendar")}
                >
                  Agendar uma avaliação <ArrowUpRight size={15} />
                </button>
              )}
            </div>
          ) : (
            <div className="bp-procedure-grid">
              {visibleProcedures.map((procedure) => (
                <article className="bp-procedure-card" key={procedure.id} data-motion="scale">
                  <button
                    className="bp-procedure-photo"
                    onClick={() => setSelectedProcedure(procedure.id)}
                    aria-label={`Ver detalhes de ${procedure.name}`}
                  >
                    <img
                      src={safeImage(
                        procedure.image,
                        fallbackProcedureImage(procedure.category),
                      )}
                      alt={procedure.name}
                      width="640"
                      height="430"
                      loading="lazy"
                    />
                    <span className="bp-card-category">
                      {procedure.category}
                    </span>
                    <span className="bp-card-open">
                      <ArrowUpRight size={17} />
                    </span>
                  </button>
                  <button
                    type="button"
                    className="bp-favorite-toggle"
                    data-motion-heart
                    aria-label={`${favorites.includes(procedure.id) ? "Remover" : "Adicionar"} ${procedure.name} ${favorites.includes(procedure.id) ? "dos" : "aos"} favoritos`}
                    aria-pressed={favorites.includes(procedure.id)}
                    disabled={favoriteBusyId === procedure.id}
                    onClick={() => void toggleFavorite(procedure.id)}
                  >
                    <Heart
                      size={18}
                      fill={
                        favorites.includes(procedure.id)
                          ? "currentColor"
                          : "none"
                      }
                    />
                  </button>
                  <div className="bp-procedure-info">
                    <div className="bp-procedure-title">
                      <h3>{procedure.name}</h3>
                      <span>{money.format(procedure.price)}</span>
                    </div>
                    <p>
                      {procedure.description ||
                        "Conheça os detalhes durante uma avaliação com a equipe."}
                    </p>
                    <div className="bp-card-meta">
                      <span>
                        <Clock3 size={15} /> {procedure.duration} min
                      </span>
                      {procedure.professional && (
                        <span>
                          <UsersRound size={15} /> {procedure.professional.name}
                        </span>
                      )}
                    </div>
                    <div className="bp-card-actions">
                      <button
                        className="bp-card-detail"
                        onClick={() => setSelectedProcedure(procedure.id)}
                      >
                        Detalhes
                      </button>
                      <button
                        className="bp-card-book"
                        onClick={(event) => bookingClick(event, procedure.id)}
                      >
                        Agendar <ArrowRight size={15} />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
          {content.procedures.length > 0 && (
            <div className="bp-catalog-footer">
              <span>
                Exibindo {visibleProcedures.length} de{" "}
                {content.procedures.length} procedimentos
              </span>
              <button onClick={() => openAccess("Agendar")}>
                Agendar uma avaliação <ArrowRight size={16} />
              </button>
            </div>
          )}
        </div>
      </section>

      <section id="sobre" className="bp-section bp-about-section" data-motion="rise">
        <div className="bp-container bp-about-grid">
          <div className="bp-about-image">
            <img
              src="/images/bellapelle-clinic-new.webp"
              alt="Interior acolhedor da clínica BellaPelle"
              width="1000"
              height="700"
              loading="lazy"
            />
          </div>
          <div className="bp-about-copy">
            <span className="bp-eyebrow">Sobre a BellaPelle</span>
            <h2>
              Estética com propósito. <em>Cuidado de verdade.</em>
            </h2>
            <p>
              Acreditamos que o cuidado começa pela escuta. Por isso, cada
              jornada é conduzida com atenção às suas necessidades e orientação
              profissional.
            </p>
            <div className="bp-about-points">
              <span>
                <Check size={16} /> Avaliação individual
              </span>
              <span>
                <Check size={16} /> Plano de cuidado claro
              </span>
              <span>
                <Check size={16} /> Acompanhamento atencioso
              </span>
            </div>
            <a className="bp-text-link" href="#equipe">
              Conheça nossa equipe <ArrowRight size={16} />
            </a>
          </div>
        </div>
      </section>

      <section id="equipe" className="bp-section bp-team-section" data-motion="rise">
        <div className="bp-container">
          <div className="bp-section-heading bp-section-heading-split">
            <div>
              <span className="bp-eyebrow">Nossa equipe</span>
              <h2>
                Profissionais que acompanham <em>sua jornada.</em>
              </h2>
            </div>
            <p>
              Conheça os profissionais ativos e habilitados para atender você.
            </p>
          </div>
          {contentLoading ? (
            <div className="bp-team-grid">
              {[0, 1, 2].map((key) => (
                <div
                  className="bp-skeleton-card bp-skeleton-person"
                  key={key}
                />
              ))}
            </div>
          ) : content.professionals.length === 0 ? (
            <div className="bp-state-card bp-state-compact">
              <UsersRound />
              <p>
                {contentError ||
                  "A equipe será apresentada assim que os cadastros forem publicados."}
              </p>
            </div>
          ) : (
            <div className="bp-team-grid">
              {content.professionals.map((person, index) => (
                <article className="bp-professional-card" key={person.id} data-motion="scale">
                  <div className="bp-professional-photo">
                    <img
                      src={assignedPortraits[index]}
                      alt={person.name}
                      width="600"
                      height="680"
                      loading="lazy"
                      onError={(event) => {
                        event.currentTarget.src =
                          professionalPortraits[
                            index % professionalPortraits.length
                          ];
                      }}
                    />
                    <span>0{index + 1}</span>
                  </div>
                  <div className="bp-professional-copy">
                    <span className="bp-professional-label">
                      Especialista BellaPelle
                    </span>
                    <h3>{person.name}</h3>
                    <p>{person.specialty}</p>
                    {person.experience > 0 && (
                      <small>{person.experience} anos de experiência</small>
                    )}
                    <button
                      onClick={(event) => bookingClick(event)}
                      aria-label={`Agendar com ${person.name}`}
                    >
                      Agendar com a equipe <ArrowUpRight size={16} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <section id="depoimentos" className="bp-section bp-review-section" data-motion="rise">
        <div className="bp-container">
          <div className="bp-review-heading">
            <div>
              <span className="bp-eyebrow">Experiências compartilhadas</span>
              <h2>
                O que nossos clientes <em>dizem.</em>
              </h2>
            </div>
            <div className="bp-rating-summary">
              {contentLoading ? (
                <span>Carregando avaliações…</span>
              ) : content.reviews.length > 0 ? (
                <>
                  <strong>
                    <Star fill="currentColor" />{" "}
                    {(
                      content.reviews.reduce(
                        (sum, review) => sum + review.rating,
                        0,
                      ) / content.reviews.length || 0
                    ).toFixed(1)}
                  </strong>
                  <span>{content.reviews.length} avaliações publicadas</span>
                </>
              ) : (
                <span>Avaliações de clientes</span>
              )}
            </div>
          </div>
          {contentLoading ? (
            <div className="bp-review-grid">
              {[0, 1, 2].map((key) => (
                <div
                  className="bp-skeleton-card bp-skeleton-review"
                  key={key}
                />
              ))}
            </div>
          ) : content.reviews.length === 0 ? (
            <div className="bp-state-card bp-state-compact">
              <Heart />
              <p>
                {contentError ||
                  "Ainda não há depoimentos autorizados para publicação."}
              </p>
            </div>
          ) : (
            <div className="bp-review-grid">
              {content.reviews.slice(0, 6).map((review) => (
                <article className="bp-review-card" key={review.id}>
                  <div
                    className="bp-review-stars"
                    aria-label={`${review.rating} de 5 estrelas`}
                  >
                    {Array.from({ length: 5 }, (_, index) => (
                      <Star
                        key={index}
                        size={15}
                        fill={index < review.rating ? "currentColor" : "none"}
                      />
                    ))}
                  </div>
                  <blockquote>“{review.comment}”</blockquote>
                  <div className="bp-review-byline">
                    <span className="bp-review-avatar" aria-hidden="true">
                      {review.customer.slice(0, 1)}
                    </span>
                    <div>
                      <strong>{review.customer}</strong>
                      <small>{review.procedure}</small>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="bp-promo-cta" data-motion="rise">
        <div className="bp-container bp-promo-inner">
          <span className="bp-promo-symbol">
            <Flower2 />
          </span>
          <div>
            <span className="bp-eyebrow">Seu próximo passo</span>
            <h2>
              Um momento de cuidado <em>começa com você.</em>
            </h2>
            <p>
              Agende uma avaliação e encontre o cuidado ideal para a sua
              jornada.
            </p>
          </div>
          <button
            className="bp-button bp-button-primary"
            onClick={(event) => bookingClick(event)}
          >
            Agendar consulta <ArrowUpRight size={16} />
          </button>
        </div>
      </section>

      <section id="blog" className="bp-section bp-blog-section" data-motion="rise">
        <div className="bp-container">
          <div className="bp-section-heading bp-section-heading-split">
            <div>
              <span className="bp-eyebrow">Caderno BellaPelle</span>
              <h2>
                Conteúdos para cuidar <em>de você.</em>
              </h2>
            </div>
            <p>Artigos e informações publicados pela equipe.</p>
          </div>
          {contentLoading ? (
            <div className="bp-blog-grid">
              {[0, 1, 2].map((key) => (
                <div className="bp-skeleton-card bp-skeleton-post" key={key} />
              ))}
            </div>
          ) : content.posts.length === 0 ? (
            <div className="bp-state-card bp-state-compact">
              <Flower2 />
              <p>
                {contentError ||
                  "Novos conteúdos serão exibidos aqui quando forem publicados."}
              </p>
            </div>
          ) : (
            <div className="bp-blog-grid">
              {content.posts.map((post) => (
                <article className="bp-post-card" key={post.id} data-motion="scale">
                  <button
                    className="bp-post-image"
                    onClick={() => setArticle(post.id)}
                    aria-label={`Ler ${post.title}`}
                  >
                    <img
                      src={safeImage(
                        post.image,
                        "/images/bellapelle-editorial-new.webp",
                      )}
                      alt=""
                      width="720"
                      height="460"
                      loading="lazy"
                    />
                    <span>
                      <ArrowUpRight size={18} />
                    </span>
                  </button>
                  <div className="bp-post-copy">
                    <div className="bp-post-meta">
                      <span>Artigo</span>
                      {post.date && (
                        <time dateTime={post.date}>
                          {new Intl.DateTimeFormat("pt-BR", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          }).format(new Date(post.date))}
                        </time>
                      )}
                    </div>
                    <h3>{post.title}</h3>
                    <p>{post.summary}</p>
                    <button
                      className="bp-text-link"
                      onClick={() => setArticle(post.id)}
                    >
                      Continuar lendo <ArrowRight size={15} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <section id="contato" className="bp-contact-section" data-motion="rise">
        <div className="bp-container">
          <div className="bp-contact-card">
            <div className="bp-contact-copy">
              <span className="bp-eyebrow">Vamos conversar?</span>
              <h2>
                Comece com uma avaliação.
              </h2>
              <p>
                Agende seu horário ou fale com a clínica pelos canais abaixo.
              </p>
            </div>
            <div className="bp-contact-action">
              <span className="bp-contact-icon" aria-hidden="true">
                <CalendarDays />
              </span>
              <button
                className="bp-button bp-button-light"
                onClick={(event) => bookingClick(event)}
              >
                <span>Encontrar um horário</span>
                <ArrowUpRight size={16} aria-hidden="true" />
              </button>
            </div>
          </div>
          <div className="bp-contact-details">
            {content.contact?.phone && (
              <a
                className="bp-contact-item"
                href={`tel:${content.contact.phone.replace(/[^+\d]/g, "")}`}
              >
                <Phone />
                <span>
                  <small>Telefone</small>
                  <strong>{content.contact.phone}</strong>
                </span>
              </a>
            )}
            {content.contact?.whatsapp && (
              <a
                className="bp-contact-item"
                href={`https://wa.me/${content.contact.whatsapp.replace(/\D/g, "")}`}
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircle />
                <span>
                  <small>WhatsApp</small>
                  <strong>{content.contact.whatsapp}</strong>
                </span>
              </a>
            )}
            {content.contact?.email && (
              <a
                className="bp-contact-item"
                href={`mailto:${content.contact.email}`}
              >
                <Mail />
                <span>
                  <small>E-mail</small>
                  <strong>{content.contact.email}</strong>
                </span>
              </a>
            )}
            {content.contact?.address && (
              <a
                className="bp-contact-item"
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(content.contact.address)}`}
                target="_blank"
                rel="noreferrer"
              >
                <MapPin />
                <span>
                  <small>Endereço</small>
                  <strong>{content.contact.address}</strong>
                </span>
              </a>
            )}
            {content.contact?.hours && (
              <div className="bp-contact-item">
                <Clock3 />
                <span>
                  <small>Horário de atendimento</small>
                  <strong>{content.contact.hours}</strong>
                </span>
              </div>
            )}
            {content.contact?.cnpj && (
              <div className="bp-contact-item">
                <Building2 />
                <span>
                  <small>CNPJ</small>
                  <strong>{content.contact.cnpj}</strong>
                </span>
              </div>
            )}
            {!contentLoading &&
              !contentError &&
              ![
                content.contact?.phone,
                content.contact?.whatsapp,
                content.contact?.email,
                content.contact?.address,
                content.contact?.hours,
              ].some(Boolean) && (
                <p className="bp-contact-empty">
                  Os canais oficiais da clínica serão exibidos aqui assim que
                  forem cadastrados pela administração.
                </p>
              )}
          </div>
        </div>
      </section>

      <section className="bp-faq-section" data-motion="rise">
        <div className="bp-container bp-faq-layout">
          <div>
            <span className="bp-eyebrow">Perguntas frequentes</span>
            <h2>
              Informação clara para <em>começar.</em>
            </h2>
            <p>
              Não encontrou sua resposta? Fale com a equipe ao iniciar seu
              agendamento.
            </p>
            <button
              className="bp-text-link"
              onClick={(event) => bookingClick(event)}
            >
              Fale com a equipe <ArrowRight size={15} />
            </button>
          </div>
          <div className="bp-faq-list">
            {[
              [
                "Como escolho o procedimento?",
                "Conheça os procedimentos e converse com a equipe para entender as opções adequadas aos seus objetivos.",
              ],
              [
                "Preciso criar uma conta para navegar?",
                "Não. O site é público. A conta é solicitada ao agendar ou acessar seus dados pessoais.",
              ],
              [
                "Como vejo os horários disponíveis?",
                "Entre ou crie sua conta, escolha um procedimento e consulte os horários reais disponibilizados pela clínica.",
              ],
              [
                "Posso salvar um procedimento?",
                "Sim. Entre na sua conta e use a área Favoritos para salvar e consultar procedimentos.",
              ],
            ].map(([question, answer]) => (
              <details key={question}>
                <summary>
                  {question}
                  <ChevronDown size={17} />
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <footer className="bp-footer" data-motion="rise">
        <div className="bp-container">
          <div className="bp-footer-main">
            <div className="bp-footer-brand">
              <a href="#inicio">
                <img
                  src="/images/logo-bellapelle.png"
                  alt="BellaPelle"
                  width="1448"
                  height="1086"
                />
              </a>
              <p>Seu espaço de cuidado, beleza e bem-estar.</p>
            </div>
            <div className="bp-footer-nav">
              <strong>Explore</strong>
              {navLinks.slice(1).map(([label, id]) => (
                <a key={id} href={`#${id}`}>
                  {label}
                </a>
              ))}
            </div>
            <div className="bp-footer-account">
              <strong>Atendimento</strong>
              <p>Agende uma avaliação e veja a disponibilidade atualizada.</p>
              <button
                className="bp-button bp-button-primary"
                onClick={(event) => bookingClick(event)}
              >
                Agendar consulta <ArrowUpRight size={16} />
              </button>
            </div>
            <div className="bp-footer-contact">
              <strong>Fale com a clínica</strong>
              {content.contact?.phone && (
                <a href={`tel:${content.contact.phone.replace(/[^+\d]/g, "")}`}>
                  {content.contact.phone}
                </a>
              )}
              {content.contact?.whatsapp && (
                <a
                  href={`https://wa.me/${content.contact.whatsapp.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  WhatsApp · {content.contact.whatsapp}
                </a>
              )}
              {content.contact?.email && (
                <a href={`mailto:${content.contact.email}`}>
                  {content.contact.email}
                </a>
              )}
              {content.contact?.address && (
                <span>{content.contact.address}</span>
              )}
              {content.contact?.hours && <span>{content.contact.hours}</span>}
              {!content.contact?.phone &&
                !content.contact?.whatsapp &&
                !content.contact?.email &&
                !content.contact?.address &&
                !content.contact?.hours && (
                  <span>Contatos serão cadastrados pela clínica.</span>
                )}
            </div>
          </div>
          <div className="bp-footer-bottom">
            <span>
              © {new Date().getFullYear()} BellaPelle. Todos os direitos
              reservados.
            </span>
            <a href="/admin">Acesso da equipe</a>
            {content.contact?.cnpj && <span>CNPJ {content.contact.cnpj}</span>}
            <button
              className="bp-footer-policy"
              onClick={() => setPrivacyOpen(true)}
            >
              Privacidade e dados
            </button>
            <a href="#inicio">Voltar ao início ↑</a>
          </div>
        </div>
      </footer>

      {privacyOpen && (
        <div
          className="bp-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPrivacyOpen(false);
          }}
        >
          <section
            className="bp-privacy-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="privacy-title"
          >
            <button
              className="bp-dialog-close"
              onClick={() => setPrivacyOpen(false)}
              aria-label="Fechar política de privacidade"
            >
              <X />
            </button>
            <span className="bp-eyebrow">BellaPelle · Privacidade</span>
            <h2 id="privacy-title">Privacidade e dados pessoais</h2>
            {content.contact?.privacyPolicy ? (
              <div className="bp-privacy-copy">
                {content.contact.privacyPolicy
                  .split(/\n{2,}/)
                  .map((paragraph, index) => (
                    <p key={index}>{paragraph}</p>
                  ))}
              </div>
            ) : (
              <div className="bp-privacy-copy">
                <p>
                  Para oferecer cadastro, agendamentos e atendimento, a clínica
                  utiliza os dados que você informa, como nome, contato e
                  informações necessárias para organizar seus cuidados. Dados de
                  saúde fornecidos em avaliações são tratados no contexto do
                  atendimento e não são exibidos no site público.
                </p>
                <p>
                  Você pode consultar, corrigir ou solicitar a exclusão de dados
                  pela área <strong>Privacidade</strong> da sua conta. A equipe
                  analisa e responde à solicitação pelo sistema.
                </p>
                <p>
                  Esta informação geral não substitui a política completa da
                  clínica. A administração pode cadastrar o texto oficial e os
                  canais do controlador no painel.
                </p>
              </div>
            )}
            {content.contact?.email && (
              <p className="bp-privacy-contact">
                Contato:{" "}
                <a href={`mailto:${content.contact.email}`}>
                  {content.contact.email}
                </a>
              </p>
            )}
            <button
              className="bp-button bp-button-primary"
              onClick={() => {
                setPrivacyOpen(false);
                openAccess("Privacidade");
              }}
            >
              Acessar meus dados <ArrowRight size={16} />
            </button>
          </section>
        </div>
      )}

      {access && (
        <div
          className="bp-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setAccess(false);
          }}
        >
          <section
            className="bp-auth-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-title"
          >
            <button
              className="bp-dialog-close"
              onClick={() => setAccess(false)}
              aria-label="Fechar"
            >
              <X />
            </button>
            <div className="bp-auth-aside">
              <img
                src="/images/logo-bellapelle.png"
                alt="BellaPelle"
                width="1448"
                height="1086"
              />
              <span className="bp-eyebrow">Bem-vinda(o) à BellaPelle</span>
              <h2>
                Seu cuidado começa com <em>uma conversa.</em>
              </h2>
              <p>
                Use seus dados para acessar sua área. O sistema identifica
                automaticamente o perfil de cliente ou equipe.
              </p>
              <div className="bp-auth-trust">
                <ShieldCheck size={18} /> Seus dados são protegidos
              </div>
            </div>
            <div className="bp-auth-form-area">
              <span className="bp-eyebrow">
                {accessMode === "register"
                  ? "Criar conta"
                  : accessMode === "forgot"
                    ? "Recuperar acesso"
                    : accessMode === "reset"
                      ? "Nova senha"
                      : "Acesso BellaPelle"}
              </span>
              <h2 id="auth-title">
                {accessMode === "register"
                  ? "Vamos começar"
                  : accessMode === "forgot"
                    ? "Recupere sua senha"
                    : accessMode === "reset"
                      ? "Defina uma nova senha"
                      : "Entre na sua conta"}
              </h2>
              <p>
                {accessMode === "login"
                  ? "Informe seu e-mail e senha para continuar."
                  : accessMode === "register"
                    ? "Crie sua conta para agendar e acompanhar seu cuidado."
                    : accessMode === "forgot"
                      ? "Enviaremos as instruções para o e-mail cadastrado."
                      : "Escolha uma nova senha segura."}
              </p>
              <form onSubmit={submitAccess}>
                {accessMode === "register" && (
                  <>
                    <label>
                      Nome completo
                      <input
                        name="nome_completo"
                        autoComplete="name"
                        minLength={3}
                        required
                      />
                    </label>
                    <label>
                      CPF
                      <input
                        name="cpf"
                        inputMode="numeric"
                        maxLength={14}
                        required
                        onChange={(event) => {
                          const input = event.currentTarget;
                          input.value = input.value
                            .replace(/\D/g, "")
                            .slice(0, 11)
                            .replace(/(\d{3})(\d)/, "$1.$2")
                            .replace(/(\d{3})(\d)/, "$1.$2")
                            .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
                        }}
                      />
                    </label>
                    <label>
                      Data de nascimento
                      <input name="data_nascimento" type="date" required />
                    </label>
                    <label>
                      Telefone
                      <input name="telefone" type="tel" autoComplete="tel" />
                    </label>
                  </>
                )}
                {accessMode !== "reset" && (
                  <label>
                    E-mail
                    <input
                      name="email"
                      type="email"
                      autoComplete="email"
                      defaultValue={
                        accessMode === "register" ? registerEmail : undefined
                      }
                      required
                    />
                  </label>
                )}
                {accessMode !== "forgot" && (
                  <label>
                    {accessMode === "register" ? "Crie uma senha" : "Senha"}
                    <input
                      name="password"
                      type="password"
                      autoComplete={
                        accessMode === "login"
                          ? "current-password"
                          : "new-password"
                      }
                      minLength={accessMode === "login" ? 1 : 12}
                      required
                    />
                    {accessMode !== "login" && (
                      <small>Use pelo menos 12 caracteres.</small>
                    )}
                  </label>
                )}
                {accessMode === "register" && (
                  <label>
                    Confirme a senha
                    <input
                      name="confirm_password"
                      type="password"
                      autoComplete="new-password"
                      minLength={12}
                      required
                    />
                  </label>
                )}
                {loginError && (
                  <p className="bp-login-error" role="alert">
                    {loginError}
                  </p>
                )}
                <button
                  className="bp-button bp-button-primary bp-submit"
                  type="submit"
                  disabled={busy}
                >
                  {busy
                    ? "Aguarde…"
                    : accessMode === "register"
                      ? "Criar minha conta"
                      : accessMode === "forgot"
                        ? "Enviar instruções"
                        : accessMode === "reset"
                          ? "Salvar nova senha"
                          : "Entrar"}
                  <ArrowRight size={16} />
                </button>
              </form>
              <div className="bp-auth-links">
                {accessMode === "login" ? (
                  <>
                    <button
                      onClick={() => {
                        setAccessMode("register");
                        setRegisterEmail("");
                        setLoginError("");
                      }}
                    >
                      Criar minha conta
                    </button>
                    <button
                      onClick={() => {
                        setAccessMode("forgot");
                        setLoginError("");
                      }}
                    >
                      Esqueci minha senha
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      setAccessMode("login");
                      setLoginError("");
                    }}
                  >
                    Voltar para entrar
                  </button>
                )}
              </div>
            </div>
          </section>
        </div>
      )}

      {currentProcedure && (
        <div
          className="bp-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget)
              setSelectedProcedure(null);
          }}
        >
          <section
            className="bp-detail-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="procedure-title"
          >
            <button
              className="bp-dialog-close"
              onClick={() => setSelectedProcedure(null)}
              aria-label="Fechar detalhes"
            >
              <X />
            </button>
            <img
              src={safeImage(
                currentProcedure.image,
                fallbackProcedureImage(currentProcedure.category),
              )}
              alt={currentProcedure.name}
              width="720"
              height="480"
            />
            <button
              type="button"
              className="bp-detail-favorite"
              data-motion-heart
              aria-label={`${favorites.includes(currentProcedure.id) ? "Remover" : "Adicionar"} ${currentProcedure.name} ${favorites.includes(currentProcedure.id) ? "dos" : "aos"} favoritos`}
              aria-pressed={favorites.includes(currentProcedure.id)}
              disabled={favoriteBusyId === currentProcedure.id}
              onClick={() => void toggleFavorite(currentProcedure.id)}
            >
              <Heart
                size={19}
                fill={
                  favorites.includes(currentProcedure.id)
                    ? "currentColor"
                    : "none"
                }
              />
            </button>
            <div className="bp-detail-copy">
              <span className="bp-eyebrow">{currentProcedure.category}</span>
              <h2 id="procedure-title">{currentProcedure.name}</h2>
              <p>
                {currentProcedure.description ||
                  "Converse com nossa equipe para conhecer a indicação, os cuidados e as etapas deste procedimento."}
              </p>
              <div className="bp-detail-facts">
                <span>
                  <Clock3 size={16} /> {currentProcedure.duration} minutos
                </span>
                <strong>{money.format(currentProcedure.price)}</strong>
                {currentProcedure.professional && (
                  <span>
                    <UsersRound size={16} />{" "}
                    {currentProcedure.professional.name}
                  </span>
                )}
              </div>
              <button
                className="bp-button bp-button-primary"
                onClick={(event) => {
                  setSelectedProcedure(null);
                  bookingClick(event, currentProcedure.id);
                }}
              >
                Agendar este procedimento <ArrowUpRight size={16} />
              </button>
            </div>
          </section>
        </div>
      )}

      {currentArticle && (
        <div
          className="bp-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setArticle(null);
          }}
        >
          <article
            className="bp-article-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="article-title"
          >
            <button
              className="bp-dialog-close"
              onClick={() => setArticle(null)}
              aria-label="Fechar artigo"
            >
              <X />
            </button>
            <img
              src={safeImage(
                currentArticle.image,
                "/images/bellapelle-editorial-new.webp",
              )}
              alt=""
              width="900"
              height="500"
            />
            <div>
              <span className="bp-eyebrow">Conteúdo BellaPelle</span>
              <h2 id="article-title">{currentArticle.title}</h2>
              <p className="bp-article-summary">{currentArticle.summary}</p>
              <div className="bp-article-body">
                {currentArticle.content
                  .split(/\n{2,}/)
                  .map((paragraph, index) => (
                    <p key={index}>{paragraph}</p>
                  ))}
              </div>
              <button
                className="bp-button bp-button-primary"
                onClick={(event) => {
                  setArticle(null);
                  bookingClick(event);
                }}
              >
                Agendar uma avaliação <ArrowUpRight size={16} />
              </button>
            </div>
          </article>
        </div>
      )}

      {services && customer && (
        <CustomerServices
          csrf={customer.csrfToken}
          initialTab={servicesTab}
          initialTreatmentId={initialTreatment}
          onFavoritesChange={setFavorites}
          onClose={() => setServices(false)}
          onLogout={() => {
            setCustomer(null);
            setFavorites([]);
            setServices(false);
          }}
        />
      )}
    </main>
  );
}
