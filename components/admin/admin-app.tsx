"use client";
import { useCallback, useEffect, useState } from "react";
import {
  Menu,
  LogOut,
  Plus,
  Search,
  Flower2,
  LayoutDashboard,
  CalendarDays,
  Users,
  FileText,
  ChevronRight,
  Download,
} from "lucide-react";
import {
  request,
  type Session,
  type Resource,
  type Row,
  type Api,
  display,
  label,
} from "./api";
import { PermissionEditor } from "./permissions";
import { ClientHistory } from "./history";
import { Photos } from "./photos";
import { Calendar } from "./calendar";
import { Dialog, RecordForm } from "./form";
import { OperationDialog, operationSpecs } from "./operations";
const operations: Record<string, string[]> = {
  "pacotes-clientes": ["vender-pacote"],
  agendamentos: ["agendar", "reagendar", "status-agenda"],
  atendimentos: ["iniciar-atendimento", "concluir-atendimento"],
  parcelas: ["receber-parcela"],
  pagamentos: ["pagamento-avulso", "estornar-pagamento", "cancelar-pagamento"],
  produtos: ["movimentar-estoque"],
  comissoes: ["pagar-comissao"],
  faltas: ["status-agenda"],
};
const reportNames = [
  "faturamento",
  "pagamentos",
  "comissoes",
  "atendimentos",
  "procedimentos",
  "pacotes",
  "vencimentos",
  "sessoes",
  "faltas",
  "estoque",
  "produtos",
];
function Table({ items, onEdit }: { items: Row[]; onEdit?: (r: Row) => void }) {
  if (!items.length)
    return (
      <div className="admin-empty">
        <Flower2 />
        <h3>Nenhum registro encontrado</h3>
        <p>Ajuste os filtros ou cadastre o primeiro registro.</p>
      </div>
    );
  const keys = Object.keys(items[0]);
  return (
    <div className="admin-table-wrap">
      <table>
        <thead>
          <tr>
            {keys.map((k) => (
              <th key={k}>{label(k)}</th>
            ))}
            {onEdit && <th>Ações</th>}
          </tr>
        </thead>
        <tbody>
          {items.map((r, i) => (
            <tr key={i}>
              {keys.map((k) => (
                <td key={k}>{display(r[k], k)}</td>
              ))}
              {onEdit && (
                <td>
                  <button onClick={() => onEdit(r)}>
                    Abrir <ChevronRight size={14} />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function Login({ onLogin }: { onLogin: (s: Session) => void }) {
  const [mode, setMode] = useState("login"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [resetToken, setResetToken] = useState("");
  useEffect(() => {
    const token = new URLSearchParams(location.search).get("reset");
    if (token) {
      setMode("reset");
      setResetToken(token);
      history.replaceState(null, "", "/admin");
    }
  }, []);
  return (
    <main className="admin-login">
      <section>
        <div className="admin-logo">
          <Flower2 /> BellaPelle
        </div>
        <span className="admin-eyebrow">GESTÃO DA CLÍNICA</span>
        <h1>Cuidado em cada detalhe.</h1>
        <p>
          Um espaço para organizar sua clínica e dedicar mais tempo às pessoas.
        </p>
        <div className="admin-login-decoration" aria-hidden="true">
          B
        </div>
      </section>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          const f = new FormData(e.currentTarget);
          try {
            if (mode === "login")
              onLogin(
                await request<Session>("auth/login", "POST", {
                  email: f.get("email"),
                  password: f.get("password"),
                }),
              );
            else {
              const r = await request<{ message: string }>(
                `auth/${mode}`,
                "POST",
                mode === "forgot"
                  ? { email: f.get("email") }
                  : { token: resetToken, password: f.get("password") },
              );
              setError(r.message);
            }
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Flower2 className="admin-accent" size={34} />
        <h2>
          {mode === "login"
            ? "Bem-vinda à BellaPelle"
            : mode === "forgot"
              ? "Recuperar acesso"
              : "Criar nova senha"}
        </h2>
        <p>Use suas credenciais para acessar o sistema.</p>
        {mode !== "reset" && (
          <label>
            E-mail
            <input name="email" type="email" autoComplete="username" required />
          </label>
        )}
        {mode !== "forgot" && (
          <label>
            Senha
            <input
              name="password"
              type="password"
              autoComplete={
                mode === "reset" ? "new-password" : "current-password"
              }
              minLength={mode === "reset" ? 12 : 1}
              required
            />
          </label>
        )}
        {error && (
          <p role="alert" className="admin-notice">
            {error}
          </p>
        )}
        <button className="admin-primary" disabled={busy}>
          {busy
            ? "Aguarde…"
            : mode === "login"
              ? "Entrar"
              : mode === "forgot"
                ? "Solicitar recuperação"
                : "Salvar senha"}
        </button>
        <button
          type="button"
          onClick={() => {
            setMode(mode === "login" ? "forgot" : "login");
            setError("");
          }}
        >
          {mode === "login" ? "Esqueci minha senha" : "Voltar ao login"}
        </button>
      </form>
    </main>
  );
}
export default function AdminApp() {
  const [customPermissions, setCustomPermissions] = useState<string[] | null>(
    null,
  );
  const [session, setSession] = useState<Session | null>(null),
    [ready, setReady] = useState(false),
    [resources, setResources] = useState<Resource[]>([]),
    [page, setPage] = useState("dashboard"),
    [menu, setMenu] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [revision, setRevision] = useState(0);
  const [items, setItems] = useState<Row[]>([]),
    [total, setTotal] = useState(0),
    [loading, setLoading] = useState(false),
    [search, setSearch] = useState(""),
    [current, setCurrent] = useState(1),
    [edit, setEdit] = useState<Row | null>(null),
    [operation, setOperation] = useState(""),
    [stats, setStats] = useState<Row>({}),
    [kind, setKind] = useState("faturamento"),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [sort, setSort] = useState(""),
    [direction, setDirection] = useState("desc"),
    [status, setStatus] = useState(""),
    [professionalFilter, setProfessionalFilter] = useState(""),
    [procedureFilter, setProcedureFilter] = useState("");
  const api: Api = useCallback(
    (path, method = "GET", body) =>
      request(path, method, body, session?.csrfToken),
    [session?.csrfToken],
  );
  const can = (p: string) =>
    Boolean(
      session?.user.permissions.includes("*") ||
      session?.user.permissions.includes(p),
    );
  useEffect(() => {
    request<Session>("auth/session")
      .then(setSession)
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);
  useEffect(() => {
    if (!session) return;
    api<{ resources: Resource[] }>("meta")
      .then((d) => {
        setResources(d.resources);
        if (
          !session.user.permissions.includes("*") &&
          !session.user.permissions.includes("finance:read")
        )
          setPage(d.resources[0]?.key || "clientes");
      })
      .catch((e) => setError(e.message));
  }, [session, api]);
  useEffect(() => {
    if (!session) return;
    let active = true;
    setLoading(true);
    setError("");
    const timer = setTimeout(async () => {
      try {
        const query = new URLSearchParams({
          page: String(current),
          pageSize: "20",
          search,
          ...(sort ? { sort, direction } : {}),
          ...(status ? { status } : {}),
          ...(professionalFilter ? { profissional: professionalFilter } : {}),
          ...(procedureFilter ? { procedimento: procedureFilter } : {}),
          ...(from ? { from } : {}),
          ...(to ? { to } : {}),
        });
        if (page === "dashboard") {
          const d = await api<{ totals: Row; procedimentos: Row[] }>(
            `dashboard?${query}`,
          );
          if (active) {
            setStats(d.totals);
            setItems(d.procedimentos);
          }
        } else {
          const d = await api<{ items: Row[]; total?: number }>(
            page === "reports"
              ? `reports/${kind}?${query}`
              : `${page}?${query}`,
          );
          if (active) {
            setItems(d.items);
            setTotal(d.total ?? d.items.length);
          }
        }
      } catch (e) {
        if (active) setError((e as Error).message);
      } finally {
        if (active) setLoading(false);
      }
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [
    api,
    session,
    page,
    search,
    current,
    revision,
    kind,
    from,
    to,
    sort,
    direction,
    status,
    professionalFilter,
    procedureFilter,
  ]);
  const resource = resources.find((r) => r.key === page);
  const success = () => {
    setEdit(null);
    setOperation("");
    setRevision((v) => v + 1);
    setNotice("Operação realizada com sucesso.");
  };
  const navigate = (key: string) => {
    setPage(key);
    setCurrent(1);
    setSearch("");
    setItems([]);
    setMenu(false);
    setNotice("");
    setFrom("");
    setTo("");
    setSort("");
    setStatus("");
  };
  if (!ready)
    return (
      <main className="admin-loading" role="status">
        Carregando BellaPelle…
      </main>
    );
  if (!session) return <Login onLogin={setSession} />;
  return (
    <div className="admin-shell">
      <aside className={menu ? "open" : ""}>
        <a className="admin-logo" href="/admin">
          <Flower2 />
          BellaPelle
        </a>
        <span className="admin-eyebrow">ESPAÇO DE GESTÃO</span>
        <nav aria-label="Módulos">
          {can("finance:read") && (
            <button
              className={page === "dashboard" ? "active" : ""}
              onClick={() => navigate("dashboard")}
            >
              <LayoutDashboard size={18} />
              Visão geral
            </button>
          )}
          {resources.map((r) => (
            <button
              className={page === r.key ? "active" : ""}
              key={r.key}
              onClick={() => navigate(r.key)}
            >
              {r.key === "agendamentos" ? (
                <CalendarDays size={18} />
              ) : (
                <Users size={18} />
              )}
              <span>{r.label}</span>
            </button>
          ))}
          {can("reports:read") && (
            <button onClick={() => navigate("reports")}>
              <FileText size={18} />
              Relatórios
            </button>
          )}
          {can("users:write") && (
            <button onClick={() => navigate("users")}>
              <Users size={18} />
              Usuários
            </button>
          )}
        </nav>
        <p className="admin-sidebar-foot">BellaPelle · Gestão integrada</p>
      </aside>
      <div className="admin-workspace">
        <header className="admin-topbar">
          <button
            className="admin-menu"
            aria-label="Abrir navegação"
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            <Menu />
          </button>
          <span>
            Clínica BellaPelle{" "}
            <span className="admin-muted">/ Administração</span>
          </span>
          <div className="admin-user">
            <span>
              <strong>{session.user.nome}</strong>
              <small>{session.user.perfil}</small>
            </span>
            <button
              aria-label="Sair"
              onClick={async () => {
                try {
                  await api("auth/logout", "POST");
                  setSession(null);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <LogOut size={19} />
            </button>
          </div>
        </header>
        <main className="admin-main">
          <span className="admin-eyebrow">SEU DIA, MAIS ORGANIZADO</span>
          <div className="admin-title">
            <div>
              <h1>
                {page === "dashboard"
                  ? "Visão geral"
                  : page === "reports"
                    ? "Relatórios"
                    : page === "users"
                      ? "Equipe e acessos"
                      : resource?.label}
              </h1>
              <p>
                {page === "dashboard"
                  ? "Acompanhe os resultados e os cuidados da sua clínica."
                  : "Informações integradas para uma rotina mais tranquila."}
              </p>
            </div>
            {resource?.writable && (
              <button className="admin-primary" onClick={() => setEdit({})}>
                <Plus size={17} />
                Novo registro
              </button>
            )}
            {page === "users" && (
              <button className="admin-primary" onClick={() => setEdit({})}>
                <Plus size={17} />
                Novo usuário
              </button>
            )}
          </div>
          {notice && (
            <div role="status" className="admin-notice">
              {notice}
            </div>
          )}
          <div className="admin-actions">
            {(operations[page] || [])
              .filter((n) =>
                can(
                  [
                    "vender-pacote",
                    "receber-parcela",
                    "estornar-pagamento",
                    "cancelar-pagamento",
                    "pagar-comissao",
                    "pagamento-avulso",
                  ].includes(n)
                    ? "finance:write"
                    : n === "movimentar-estoque"
                      ? "stock:write"
                      : n.includes("atendimento")
                        ? "clinical:write"
                        : "agendamentos:write",
                ),
              )
              .map((n) => (
                <button key={n} onClick={() => setOperation(n)}>
                  {operationSpecs[n]?.title || n}
                </button>
              ))}
          </div>
          {page === "agendamentos" && (
            <Calendar api={api} revision={revision} onSelect={setEdit} />
          )}
          <section className="admin-panel">
            <div className="admin-toolbar">
              {page !== "dashboard" && page !== "reports" && (
                <label className="admin-search">
                  <Search size={18} />
                  <input
                    aria-label="Pesquisar registros"
                    placeholder="Pesquisar registros…"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setCurrent(1);
                    }}
                  />
                </label>
              )}
              {resource && (
                <label>
                  Ordenar por
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                  >
                    <option value="">Mais recentes</option>
                    {resource.fields.map((f) => (
                      <option key={f.name} value={f.name}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {resource && sort && (
                <label>
                  Ordem
                  <select
                    value={direction}
                    onChange={(e) => setDirection(e.target.value)}
                  >
                    <option value="asc">Crescente</option>
                    <option value="desc">Decrescente</option>
                  </select>
                </label>
              )}
              {resource?.fields.some((f) => f.name === "status") && (
                <label>
                  Situação
                  <input
                    value={status}
                    placeholder="Ex.: confirmado"
                    onChange={(e) => {
                      setStatus(e.target.value);
                      setCurrent(1);
                    }}
                  />
                </label>
              )}
              {page === "reports" && (
                <>
                  <label>
                    Profissional (ID)
                    <input
                      type="number"
                      min="1"
                      value={professionalFilter}
                      onChange={(e) => setProfessionalFilter(e.target.value)}
                    />
                  </label>
                  <label>
                    Procedimento (ID)
                    <input
                      type="number"
                      min="1"
                      value={procedureFilter}
                      onChange={(e) => setProcedureFilter(e.target.value)}
                    />
                  </label>
                  <button onClick={() => window.print()}>
                    Imprimir / salvar PDF
                  </button>
                </>
              )}
              {page === "reports" && (
                <label>
                  Relatório
                  <select
                    value={kind}
                    onChange={(e) => setKind(e.target.value)}
                  >
                    {reportNames.map((n) => (
                      <option key={n}>{n}</option>
                    ))}
                  </select>
                </label>
              )}
              {(page === "dashboard" ||
                page === "reports" ||
                [
                  "agendamentos",
                  "atendimentos",
                  "faltas",
                  "pagamentos",
                  "movimentacoes",
                ].includes(page)) && (
                <>
                  <label>
                    De
                    <input
                      type="date"
                      value={from}
                      onChange={(e) => setFrom(e.target.value)}
                    />
                  </label>
                  <label>
                    Até
                    <input
                      type="date"
                      value={to}
                      onChange={(e) => setTo(e.target.value)}
                    />
                  </label>
                </>
              )}
              {page === "reports" && (
                <button
                  onClick={() => {
                    const keys = Object.keys(items[0] || {});
                    const cell = (v: unknown) =>
                      '"' +
                      String(v ?? "")
                        .replace(/^[=+@-]/, "'$&")
                        .replaceAll('"', '""') +
                      '"';
                    const csv =
                      "\uFEFF" +
                      [keys, ...items.map((r) => keys.map((k) => r[k]))]
                        .map((r) => r.map(cell).join(";"))
                        .join("\r\n");
                    const url = URL.createObjectURL(
                      new Blob([csv], { type: "text/csv;charset=utf-8" }),
                    );
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `bellapelle-${kind}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  <Download size={16} />
                  Exportar CSV
                </button>
              )}
            </div>
            {error ? (
              <div className="admin-error" role="alert">
                {error}
                <button onClick={() => setRevision((v) => v + 1)}>
                  Tentar novamente
                </button>
              </div>
            ) : loading ? (
              <div className="admin-loading" role="status">
                Carregando dados…
              </div>
            ) : page === "dashboard" ? (
              <>
                <div className="admin-stats">
                  {Object.entries(stats).map(([k, v]) => (
                    <article key={k}>
                      <span>{label(k)}</span>
                      <strong>{display(v, k)}</strong>
                      <small>Dados do banco da clínica</small>
                    </article>
                  ))}
                </div>
                <h2 className="admin-section-title">
                  Procedimentos realizados no período
                </h2>
                <div
                  className="admin-chart"
                  role="img"
                  aria-label="Atendimentos por procedimento"
                >
                  {items.map((r, i) => (
                    <div key={i}>
                      <span>{String(r.nome)}</span>
                      <meter
                        min={0}
                        max={Math.max(
                          1,
                          ...items.map((x) => Number(x.quantidade)),
                        )}
                        value={Number(r.quantidade)}
                      />
                      <strong>{String(r.quantidade)}</strong>
                    </div>
                  ))}
                </div>
                <Table items={items} />
              </>
            ) : (
              <>
                <Table
                  items={items}
                  onEdit={resource || page === "users" ? setEdit : undefined}
                />
                {page !== "reports" && (
                  <footer className="admin-pagination">
                    <span>
                      {total} registros · Página {current}
                    </span>
                    <button
                      disabled={current === 1}
                      onClick={() => setCurrent(current - 1)}
                    >
                      Anterior
                    </button>
                    <button
                      disabled={current * 20 >= total}
                      onClick={() => setCurrent(current + 1)}
                    >
                      Próxima
                    </button>
                  </footer>
                )}
                {page === "reports" && (
                  <p className="admin-notice">
                    Exportação limitada a 5.000 registros. Use o período para
                    restringir os resultados.
                  </p>
                )}
              </>
            )}
          </section>
        </main>
      </div>
      {edit && resource && (
        <Dialog
          title={
            edit[resource.pk]
              ? `Registro #${edit[resource.pk]}`
              : `Cadastrar ${resource.label}`
          }
          onClose={() => setEdit(null)}
        >
          {resource.writable && (!resource.appendOnly || !edit[resource.pk]) ? (
            <RecordForm
              api={api}
              fields={resource.fields}
              initial={edit}
              onSubmit={async (data) => {
                await api(
                  `${page}${edit[resource.pk] ? "/" + edit[resource.pk] : ""}`,
                  edit[resource.pk] ? "PATCH" : "POST",
                  data,
                );
                success();
              }}
            />
          ) : (
            <dl className="admin-details">
              {Object.entries(edit).map(([k, v]) => (
                <div key={k}>
                  <dt>{label(k)}</dt>
                  <dd>{display(v, k)}</dd>
                </div>
              ))}
            </dl>
          )}
          {page === "clientes" && Boolean(edit.id_cliente) && (
            <ClientHistory
              id={Number(edit.id_cliente)}
              api={api}
              resources={resources}
            />
          )}{" "}
          {page === "atendimentos" && Boolean(edit.id_atendimento) && (
            <Photos
              id={Number(edit.id_atendimento)}
              api={api}
              csrf={session.csrfToken}
              write={can("clinical:write")}
            />
          )}{" "}
          {resource.active &&
            resource.writable &&
            Boolean(edit[resource.pk]) && (
              <button
                className="admin-danger"
                onClick={async () => {
                  if (
                    !confirm("Desativar este cadastro preservando o histórico?")
                  )
                    return;
                  try {
                    await api(`${page}/${edit[resource.pk]}`, "DELETE");
                    success();
                  } catch (e) {
                    setNotice((e as Error).message);
                  }
                }}
              >
                Desativar cadastro
              </button>
            )}
        </Dialog>
      )}
      {edit && page === "users" && (
        <Dialog
          title="Usuário e permissões de perfil"
          onClose={() => setEdit(null)}
        >
          <RecordForm
            api={api}
            initial={edit}
            fields={[
              { name: "nome", label: "Nome", type: "text", required: true },
              { name: "email", label: "E-mail", type: "email", required: true },
              {
                name: "perfil",
                label: "Perfil",
                type: "select",
                required: true,
                options: [
                  "administrador",
                  "recepcao",
                  "profissional",
                  "financeiro",
                  "estoque",
                ].map((value) => ({ value, label: value })),
              },
              {
                name: "id_profissional",
                label: "Profissional vinculado",
                type: "reference",
                reference: "profissionais",
              },
              {
                name: "password",
                label: "Senha (mínimo 12 caracteres)",
                type: "password",
                required: !edit.id_usuario,
              },
              { name: "ativo", label: "Ativo", type: "boolean" },
            ]}
            onSubmit={async (data) => {
              if (!data.password) delete data.password;
              data.permissions = customPermissions;
              await api(
                `users${edit.id_usuario ? "/" + edit.id_usuario : ""}`,
                edit.id_usuario ? "PATCH" : "POST",
                data,
              );
              success();
            }}
          >
            <PermissionEditor initial={edit} onChange={setCustomPermissions} />
          </RecordForm>
        </Dialog>
      )}
      {operation && (
        <OperationDialog
          name={operation}
          api={api}
          onClose={() => setOperation("")}
          onSuccess={success}
        />
      )}
    </div>
  );
}
