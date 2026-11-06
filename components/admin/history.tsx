"use client";
import { useEffect, useState } from "react";
import { type Api, type Row, type Resource, display, label } from "./api";
export function ClientHistory({
  id,
  api,
  resources,
}: {
  id: number;
  api: Api;
  resources: Resource[];
}) {
  const tabs = resources.filter((r) =>
    [
      "agendamentos",
      "anamneses",
      "pacotes-clientes",
      "pagamentos",
      "atendimentos",
      "faltas",
    ].includes(r.key),
  );
  const [tab, setTab] = useState(tabs[0]?.key || ""),
    [items, setItems] = useState<Row[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    if (!tab) return;
    setError("");
    api<{ items: Row[] }>(`${tab}?cliente=${id}&pageSize=100`)
      .then((d) => setItems(d.items))
      .catch((e) => setError(e.message));
  }, [tab, id, api]);
  return (
    <section>
      <h3>Histórico do cliente</h3>
      <div className="admin-actions">
        {tabs.map((t) => (
          <button
            key={t.key}
            aria-pressed={tab === t.key}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {error && <p role="alert">{error}</p>}
      {!items.length ? (
        <p>Nenhum registro neste histórico.</p>
      ) : (
        items.map((r, i) => (
          <dl className="admin-details" key={i}>
            {Object.entries(r).map(([k, v]) => (
              <div key={k}>
                <dt>{label(k)}</dt>
                <dd>{display(v, k)}</dd>
              </div>
            ))}
          </dl>
        ))
      )}
      <small>
        Até 100 registros recentes. Use o módulo correspondente para filtros e
        paginação.
      </small>
    </section>
  );
}
