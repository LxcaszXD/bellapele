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
const reportLabels: Record<string, string> = {
  faturamento: "Faturamento",
  pagamentos: "Pagamentos",
  comissoes: "Comissões",
  atendimentos: "Atendimentos",
  procedimentos: "Procedimentos",
  pacotes: "Pacotes",
  vencimentos: "Vencimentos",
  sessoes: "Sessões",
  faltas: "Faltas",
  estoque: "Estoque",
  produtos: "Produtos",
};
function Table({
  items,
  onEdit,
  primaryKey,
}: {
  items: Row[];
  onEdit?: (r: Row) => void;
  primaryKey?: string;
}) {
  if (!items.length)
    return (
      <div className="admin-empty">
        <Flower2 />
        <h3>Nenhum registro encontrado</h3>
        <p>Ajuste os filtros ou cadastre o primeiro registro.</p>
      </div>
    );
  const keys = Object.keys(items[0]).filter((key) => {
    if (!key.startsWith("id_") || key === primaryKey) return true;
    const namedRelations: Record<string, string> = {
      id_cliente: "cliente_nome",
      id_profissional: "profissional_nome",
      id_procedimento: "procedimento_nome",
      id_sala: "sala_nome",
      id_pacote_cliente: "pacote_nome",
    };
    const namedField = namedRelations[key];
    if (namedField && items[0][namedField]) return false;
    if (
      (key === "id_agendamento" || key === "id_pacote_cliente") &&
      items[0].destino
    )
      return false;
    return true;
  });
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
                <td key={k}>
                  {k === "ativo" || k.includes("status") ? (
                    <span
                      className={`admin-state admin-state-${String(r[k] ?? "").toLocaleLowerCase("pt-BR").replaceAll("_", "-")}`}
                    >
                      {display(r[k], k)}
                    </span>
                  ) : (
                    display(r[k], k)
                  )}
                </td>
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
    [procedureFilter, setProcedureFilter] = useState(""),
    [professionalOptions, setProfessionalOptions] = useState<Row[]>([]),
    [procedureOptions, setProcedureOptions] = useState<Row[]>([]);
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
    if (page !== "reports") return;
    let active = true;
    Promise.all([
      api<{ items: Row[] }>("profissionais?pageSize=100&sort=nome&direction=asc"),
      api<{ items: Row[] }>("procedimentos?pageSize=100&sort=nome&direction=asc"),
    ])
      .then(([professionals, procedures]) => {
        if (active) {
          setProfessionalOptions(professionals.items);
          setProcedureOptions(procedures.items);
        }
      })
      .catch((e) => active && setError((e as Error).message));
    return () => { active = false; };
  }, [session, page, api]);
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
      <main className="admin-loading admin-loading-full" role="status">
        Carregando BellaPelle…
      </main>
    );
  if (!session)
    return (
      <main className="admin-login-gate">
        <img src="/images/logo-bellapelle.png" alt="BellaPelle" />
        <h1>Acesso da equipe</h1>
        <p>Entre com seu e-mail e senha pelo acesso do site. O sistema identifica automaticamente seu perfil.</p>
        <a className="admin-primary" href="/?acesso=login">Abrir login da equipe</a>
        <a href="/">Voltar ao site</a>
      </main>
    );
  return (
    <div className="admin-shell">
      <aside className={menu ? "open" : ""}>
        <a className="admin-logo" href="/admin">
          <img src="/images/logo-bellapelle.png" alt="BellaPelle" />
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
        <header className="admin-topbar" data-motion="rise">
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
        <main className="admin-main" data-motion="rise">
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
            {resource?.writable && !resource.singleton && (
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
          <section className="admin-panel" data-motion="scale">
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
                    Profissional
                    <select
                      value={professionalFilter}
                      onChange={(e) => { setProfessionalFilter(e.target.value); setCurrent(1); }}
                    >
                      <option value="">Todos os profissionais</option>
                      {professionalOptions.map((p) => <option key={String(p.id_profissional)} value={String(p.id_profissional)}>{String(p.nome)}</option>)}
                    </select>
                  </label>
                  <label>
                    Procedimento
                    <select
                      value={procedureFilter}
                      onChange={(e) => { setProcedureFilter(e.target.value); setCurrent(1); }}
                    >
                      <option value="">Todos os procedimentos</option>
                      {procedureOptions.map((p) => <option key={String(p.id_procedimento)} value={String(p.id_procedimento)}>{String(p.nome)}</option>)}
                    </select>
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
                      <option key={n} value={n}>{reportLabels[n] || n}</option>
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
                <div
                  className="admin-journey"
                  aria-label="Fluxo de atendimento"
                >
                  {[
                    ["clientes", "1 · Cliente", "Cadastro e histórico"],
                    ["anamneses", "2 · Avaliação", "Anamnese e cuidados"],
                    ["agendamentos", "3 · Agenda", "Horários e confirmação"],
                    ["atendimentos", "4 · Atendimento", "Evolução e conclusão"],
                  ]
                    .filter(([key]) => resources.some((r) => r.key === key))
                    .map(([key, title, description]) => (
                      <button key={key} onClick={() => navigate(key)}>
                        <strong>{title}</strong>
                        <small>{description}</small>
                      </button>
                    ))}
                </div>
                <div className="admin-stats" data-motion="rise">
                  {Object.entries(stats).map(([k, v]) => (
                    <article key={k} data-motion="scale">
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
                  data-motion="rise"
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
                <Table items={items} primaryKey={resource?.pk} />
              </>
            ) : (
              <>
                <Table
                  items={items}
                  onEdit={resource || page === "users" ? setEdit : undefined}
                  primaryKey={resource?.pk}
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
              {Object.entries(edit)
                .filter(([k]) => {
                  const relationName: Record<string, string> = {
                    id_cliente: "cliente_nome",
                    id_profissional: "profissional_nome",
                    id_procedimento: "procedimento_nome",
                    id_sala: "sala_nome",
                    id_pacote_cliente: "pacote_nome",
                  };
                  if (k === resource.pk || !k.startsWith("id_")) return true;
                  if (relationName[k] && edit[relationName[k]]) return false;
                  return !(
                    (k === "id_agendamento" || k === "id_pacote_cliente") &&
                    edit.destino
                  );
                })
                .map(([k, v]) => (
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
