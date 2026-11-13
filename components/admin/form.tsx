"use client";
import { useEffect, useRef, useState } from "react";
import { X, Search } from "lucide-react";
import {
  type Api,
  type Field,
  type Row,
  convert,
  display,
  localDate,
} from "./api";
export function Dialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="admin-dialog"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <header>
        <h2>{title}</h2>
        <button type="button" aria-label="Fechar" onClick={onClose}>
          <X size={20} />
        </button>
      </header>
      {children}
    </dialog>
  );
}
function Reference({
  field,
  value,
  onChange,
  api,
}: {
  field: Field;
  value: unknown;
  onChange: (v: string) => void;
  api: Api;
}) {
  const [items, setItems] = useState<Row[]>([]),
    [search, setSearch] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    let current = true;
    const timer = setTimeout(() => {
      api<{ items: Row[] }>(
        `${field.reference}?pageSize=100&search=${encodeURIComponent(search)}`,
      )
        .then((d) => {
          if (current) {
            setItems(d.items);
            setError("");
          }
        })
        .catch((e) => current && setError(e.message));
    }, 200);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [api, field.reference, search]);
  return (
    <div className="admin-reference">
      <div className="admin-inline-search">
        <Search size={14} />
        <input
          aria-label={`Pesquisar ${field.label}`}
          placeholder="Pesquisar opções…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <select
        id={field.name}
        required={field.required}
        value={String(value ?? "")}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Selecione</option>
        {items.map((row) => {
          const id =
            row[Object.keys(row).find((k) => k.startsWith("id_")) || "id"];
          return (
            <option key={String(id)} value={String(id)}>
              {String(
                row.destino ||
                  row.nome_completo ||
                  row.nome ||
                  row.cliente_nome ||
                  row.nome_cliente ||
                  row.numero_lote ||
                  `Registro ${id}`,
              )}
              {[
                row.cliente_nome && row.destino ? String(row.cliente_nome) : "",
                row.procedimento_nome ? String(row.procedimento_nome) : "",
                row.numero_parcela ? `Parcela ${row.numero_parcela}` : "",
                row.data_hora_inicio
                  ? localDate(row.data_hora_inicio).replace("T", " ")
                  : "",
                row.valor_parcela
                  ? new Intl.NumberFormat("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    }).format(Number(row.valor_parcela))
                  : "",
                row.status ? display(row.status, "status") : "",
              ]
                .filter(Boolean)
                .map((part) => ` · ${part}`)
                .join("")}{" "}
              · #{String(id)}
            </option>
          );
        })}
      </select>
      {error && <small role="alert">{error}</small>}
    </div>
  );
}
export function RecordForm({
  fields,
  initial = {},
  api,
  onSubmit,
  submitLabel = "Salvar",
  children,
}: {
  fields: Field[];
  initial?: Row;
  api: Api;
  onSubmit: (values: Row) => Promise<void>;
  submitLabel?: string;
  children?: React.ReactNode;
}) {
  const [values, setValues] = useState<Row>(() =>
      Object.fromEntries(
        fields.map((f) => [
          f.name,
          f.type === "datetime-local"
            ? localDate(initial[f.name])
            : f.type === "date"
              ? String(initial[f.name] ?? "").slice(0, 10)
              : f.type === "boolean"
                ? Boolean(initial[f.name])
                : (initial[f.name] ?? ""),
        ]),
      ),
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <form
      className="admin-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          await onSubmit(convert(fields, values));
        } catch (e) {
          setError(e instanceof Error ? e.message : "Não foi possível salvar.");
        } finally {
          setBusy(false);
        }
      }}
    >
      {fields.some((f) => f.name === "gestante_lactante") && (
        <aside className="admin-notice">
          <h3>Avaliação clínica</h3>
          <p>
            Nova avaliação preserva o histórico. Os alertas não substituem a
            avaliação profissional.
          </p>
          {[
            "gestante_lactante",
            "marcapasso",
            "proteses_metalicas",
            "uso_isotretinoina",
            "tendencia_queloide",
            "alergia_acidos_anestesicos",
            "lesoes_ativas_pele",
            "contraindicacoes",
          ]
            .filter((k) => values[k])
            .map((k) => (
              <p key={k}>Atenção: {k.replaceAll("_", " ")}</p>
            ))}
        </aside>
      )}
      <div className="admin-form-grid">
        {fields.map((f) => (
          <label
            className={f.type === "textarea" ? "span-2" : ""}
            key={f.name}
            htmlFor={f.name}
          >
            <span>
              {f.label}
              {f.required && " *"}
            </span>
            {f.reference ? (
              <Reference
                field={f}
                value={values[f.name]}
                api={api}
                onChange={(v) => setValues({ ...values, [f.name]: v })}
              />
            ) : f.options ? (
              <select
                id={f.name}
                required={f.required}
                value={String(values[f.name] ?? "")}
                onChange={(e) =>
                  setValues({ ...values, [f.name]: e.target.value })
                }
              >
                <option value="">Selecione</option>
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : f.type === "boolean" ? (
              <input
                id={f.name}
                type="checkbox"
                checked={Boolean(values[f.name])}
                onChange={(e) =>
                  setValues({ ...values, [f.name]: e.target.checked })
                }
              />
            ) : f.type === "textarea" ? (
              <textarea
                id={f.name}
                rows={3}
                required={f.required}
                value={String(values[f.name] ?? "")}
                onChange={(e) =>
                  setValues({ ...values, [f.name]: e.target.value })
                }
              />
            ) : (
              <input
                id={f.name}
                type={
                  f.type === "money" || f.type === "decimal" ? "text" : f.type
                }
                inputMode={
                  f.type === "money" || f.type === "decimal"
                    ? "decimal"
                    : undefined
                }
                required={f.required}
                value={String(values[f.name] ?? "")}
                onChange={(e) => {
                  let value = e.target.value;
                  if (f.name === "cpf")
                    value = value
                      .replace(/\D/g, "")
                      .slice(0, 11)
                      .replace(/(\d{3})(\d)/, "$1.$2")
                      .replace(/(\d{3})(\d)/, "$1.$2")
                      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
                  setValues({ ...values, [f.name]: value });
                }}
              />
            )}
          </label>
        ))}
      </div>
      {children}
      {error && (
        <div role="alert" className="admin-error">
          {error}
        </div>
      )}
      <footer>
        <small>* Campos obrigatórios. Datas no fuso de São Paulo.</small>
        <button className="admin-primary" disabled={busy}>
          {busy ? "Salvando…" : submitLabel}
        </button>
      </footer>
    </form>
  );
}
