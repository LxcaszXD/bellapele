"use client";
import { useEffect, useState } from "react";
import { type Row, type Api } from "./api";
export function Photos({
  id,
  api,
  csrf,
  write,
}: {
  id: number;
  api: Api;
  csrf: string;
  write: boolean;
}) {
  const [items, setItems] = useState<Row[]>([]),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    api<{ items: Row[] }>(`photos?atendimento=${id}`)
      .then((r) => setItems(r.items))
      .catch((e) => setError(e.message));
  }, [api, id, revision]);
  return (
    <section>
      <h3>Fotografias autorizadas</h3>
      <div className="admin-photo-grid">
        {items.map((p) => (
          <a
            href={`/api/clinic/photos/${p.id_foto}`}
            target="_blank"
            rel="noreferrer"
            key={String(p.id_foto)}
          >
            <img
              src={`/api/clinic/photos/${p.id_foto}`}
              width={120}
              height={100}
              alt={`Registro clínico ${p.id_foto}`}
            />
          </a>
        ))}
      </div>
      {write && (
        <form
          className="admin-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget,
              body = new FormData(form);
            body.set("id_atendimento", String(id));
            setBusy(true);
            setError("");
            try {
              const response = await fetch("/api/clinic/photos", {
                method: "POST",
                headers: { "X-CSRF-Token": csrf },
                body,
              });
              const data = await response.json();
              if (!response.ok) throw Error(data.error);
              setRevision((v) => v + 1);
              form.reset();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Imagem (JPEG, PNG ou WebP, até 5 MB)
            <input
              type="file"
              name="file"
              accept="image/png,image/jpeg,image/webp"
              required
            />
          </label>
          <label>
            Registro do consentimento específico
            <textarea
              name="consentimento"
              minLength={10}
              maxLength={2000}
              required
            />
          </label>
          <button disabled={busy}>
            {busy ? "Enviando…" : "Registrar foto"}
          </button>
        </form>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
