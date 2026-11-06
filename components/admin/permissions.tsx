"use client";
import { useState, useEffect } from "react";
import { validPermissions, rolePermissions } from "@/lib/clinic/permissions";
import type { Row } from "./api";
export function PermissionEditor({
  initial,
  onChange,
}: {
  initial: Row;
  onChange: (p: string[] | null) => void;
}) {
  const parsed =
    typeof initial.permissoes === "string"
      ? JSON.parse(initial.permissoes)
      : initial.permissoes;
  const [custom, setCustom] = useState(Array.isArray(parsed)),
    [selected, setSelected] = useState<string[]>(
      Array.isArray(parsed)
        ? parsed
        : rolePermissions[String(initial.perfil)]?.filter((p) => p !== "*") ||
            [],
    );
  useEffect(
    () => onChange(custom ? selected : null),
    [custom, selected, onChange],
  );
  return (
    <fieldset>
      <legend>Permissões de acesso</legend>
      <label>
        <input
          type="checkbox"
          checked={custom}
          onChange={(e) => setCustom(e.target.checked)}
        />
        Personalizar permissões (substitui o perfil, exceto administrador)
      </label>
      {custom && (
        <div className="admin-permissions">
          {validPermissions.map((p) => (
            <label key={p}>
              <input
                type="checkbox"
                checked={selected.includes(p)}
                onChange={(e) =>
                  setSelected(
                    e.target.checked
                      ? [...selected, p]
                      : selected.filter((x) => x !== p),
                  )
                }
              />
              {p}
            </label>
          ))}
        </div>
      )}
      <p>
        O escopo clínico do profissional continua restrito aos seus clientes.
      </p>
    </fieldset>
  );
}
