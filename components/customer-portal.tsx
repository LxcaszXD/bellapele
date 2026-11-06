"use client";
import { useEffect, useState } from "react";
import { Flower2, LogOut, UserRound, ArrowLeft } from "lucide-react";
import BeautyApp from "./beauty-app";
import { display, type Row } from "./admin/api";
type Customer = { name: string; email: string; csrfToken: string };
export default function CustomerPortal() {
  const [user, setUser] = useState<Customer | null>(null),
    [loading, setLoading] = useState(true),
    [mode, setMode] = useState("login"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [token, setToken] = useState(""),
    [account, setAccount] = useState<{
      profile: Row;
      packages: Row[];
      payments: Row[];
      requests: Row[];
    } | null>(null);
  async function call(path: string, method = "GET", body?: unknown) {
    const r = await fetch("/api/customer/" + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(user ? { "X-CSRF-Token": user.csrfToken } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await r.json();
    if (!r.ok) throw Error(data.error);
    return data;
  }
  async function refresh() {
    try {
      setUser(await call("auth/session"));
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    const reset = new URLSearchParams(location.search).get("reset");
    if (reset) {
      setToken(reset);
      setMode("reset");
      history.replaceState(null, "", "/portal");
    }
    void refresh();
  }, []);
  if (loading)
    return (
      <main className="portal-auth" role="status">
        Carregando…
      </main>
    );
  if (!user)
    return (
      <main className="portal-auth">
        <div className="portal-auth-brand">
          <Flower2 size={40} />
          <span>BellaPelle</span>
          <p>Seu momento de cuidado começa aqui.</p>
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            const body = Object.fromEntries(new FormData(e.currentTarget));
            try {
              if (mode === "reset") {
                const data = await call("auth/reset", "POST", {
                  ...body,
                  token,
                });
                setMode("login");
                setError(data.message);
              } else if (mode === "forgot") {
                setError((await call("auth/forgot", "POST", body)).message);
              } else {
                await call(`auth/${mode}`, "POST", body);
                await refresh();
                setMode("login");
              }
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <h1>
            {mode === "register"
              ? "Crie sua conta"
              : mode === "forgot"
                ? "Recuperar ou ativar acesso"
                : mode === "reset"
                  ? "Definir nova senha"
                  : "Bem-vinda de volta"}
          </h1>
          <p>
            {mode === "register"
              ? "Se você já é cliente da clínica, use Recuperar / ativar acesso."
              : "Entre para agendar seus cuidados e acompanhar suas sessões."}
          </p>
          {mode === "register" && (
            <>
              <label>
                Nome completo
                <input
                  name="nome_completo"
                  autoComplete="name"
                  required
                  minLength={3}
                />
              </label>
              <label>
                CPF
                <input name="cpf" inputMode="numeric" required maxLength={14} />
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
          {mode !== "reset" && (
            <label>
              E-mail
              <input name="email" type="email" autoComplete="email" required />
            </label>
          )}
          {mode !== "forgot" && (
            <label>
              Senha
              <input
                name="password"
                aria-label="Senha"
                type="password"
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                minLength={mode === "login" ? 1 : 12}
                required
              />
              {mode !== "login" && <small>Use pelo menos 12 caracteres.</small>}
            </label>
          )}
          {error && (
            <p role="alert" className="portal-message">
              {error}
            </p>
          )}
          <button className="portal-button" disabled={busy}>
            {busy
              ? "Aguarde…"
              : mode === "register"
                ? "Criar conta"
                : mode === "forgot"
                  ? "Solicitar acesso"
                  : mode === "reset"
                    ? "Salvar senha"
                    : "Entrar"}
          </button>
          <div className="portal-auth-links">
            {mode === "login" ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setMode("register");
                    setError("");
                  }}
                >
                  Criar minha conta
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("forgot");
                    setError("");
                  }}
                >
                  Recuperar / ativar acesso
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setError("");
                }}
              >
                Voltar ao login
              </button>
            )}
          </div>
          <a href="/admin">Acesso da equipe</a>
        </form>
      </main>
    );
  return (
    <>
      <div className="portal-account-bar">
        <button
          onClick={async () => {
            setError("");
            try {
              setAccount(await call("account"));
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <UserRound size={16} />
          Minha conta
        </button>
        <button
          onClick={async () => {
            try {
              await call("auth/logout", "POST");
              setUser(null);
              setAccount(null);
              setMode("login");
              setError("");
              history.replaceState(null, "", "/portal");
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <LogOut size={16} />
          Sair
        </button>
      </div>
      {error && (
        <p role="alert" className="portal-message">
          {error}
        </p>
      )}
      {account ? (
        <main className="portal-account">
          <button onClick={() => setAccount(null)}>
            <ArrowLeft size={16} />
            Voltar aos tratamentos
          </button>
          <h1>Minha conta</h1>
          <p>
            {user.name} · {user.email}
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await call(
                  "account",
                  "PATCH",
                  Object.fromEntries(new FormData(e.currentTarget)),
                );
                setError("Dados atualizados.");
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            {["telefone", "endereco", "preferencias"].map((k) => (
              <label key={k}>
                {k === "endereco"
                  ? "Endereço"
                  : k === "preferencias"
                    ? "Preferências"
                    : "Telefone"}
                <input
                  name={k}
                  defaultValue={String(account.profile[k] || "")}
                />
              </label>
            ))}
            <button className="portal-button">Salvar dados</button>
          </form>
          {(
            [
              ["Meus pacotes", account.packages],
              ["Meus pagamentos", account.payments],
              ["Minhas solicitações", account.requests],
            ] as [string, Row[]][]
          ).map(([title, items]) => (
            <section key={title}>
              <h2>{title}</h2>
              {items.length ? (
                items.map((r, i) => (
                  <article key={i}>
                    {Object.entries(r).map(([k, v]) => (
                      <p key={k}>
                        <strong>{k.replaceAll("_", " ")}: </strong>
                        {display(v, k)}
                      </p>
                    ))}
                  </article>
                ))
              ) : (
                <p>Nenhum registro encontrado.</p>
              )}
            </section>
          ))}
          <section>
            <h2>Privacidade e meus dados</h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await call(
                    "privacy",
                    "POST",
                    Object.fromEntries(new FormData(e.currentTarget)),
                  );
                  setAccount(await call("account"));
                  setError("Solicitação registrada para análise da clínica.");
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <label>
                Solicitação
                <select name="tipo">
                  <option value="acesso">Acesso aos meus dados</option>
                  <option value="correcao">Correção de dados</option>
                  <option value="exclusao">Exclusão de dados</option>
                </select>
              </label>
              <label>
                Detalhes
                <textarea
                  name="descricao"
                  required
                  minLength={5}
                  maxLength={2000}
                />
              </label>
              <button>Enviar solicitação</button>
            </form>
          </section>
        </main>
      ) : (
        <BeautyApp csrfToken={user.csrfToken} />
      )}
    </>
  );
}
