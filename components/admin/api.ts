export type Row = Record<string, unknown>;
export type Field = {
  name: string;
  label: string;
  type: string;
  required?: boolean;
  reference?: string;
  options?: { value: string; label: string }[];
};
export type Resource = {
  key: string;
  label: string;
  pk: string;
  fields: Field[];
  writable: boolean;
  readonly?: boolean;
  appendOnly?: boolean;
  active?: boolean;
  singleton?: boolean;
};
export type Actor = {
  id: number;
  nome: string;
  email: string;
  perfil: string;
  permissions: string[];
};
export type Session = { user: Actor; csrfToken: string };
export type Api = <T = Row>(
  path: string,
  method?: string,
  body?: unknown,
) => Promise<T>;
export async function request<T>(
  path: string,
  method = "GET",
  body?: unknown,
  csrf?: string,
): Promise<T> {
  const response = await fetch(`/api/clinic/${path}`, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(csrf ? { "X-CSRF-Token": csrf } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response
    .json()
    .catch(() => ({ error: "Resposta inválida do servidor." }));
  if (!response.ok)
    throw new Error(
      data.error || `Não foi possível concluir (${response.status}).`,
    );
  return data as T;
}
export const label = (key: string) =>
  key.replace(/^id_/, "").replaceAll("_", " ");
const humanStates: Record<string, string> = {
  pendente: "Pendente",
  confirmado: "Confirmado",
  concluido: "Concluído",
  cancelado: "Cancelado",
  nao_compareceu: "Não compareceu",
  parcial: "Parcialmente pago",
  pago: "Pago",
  estornado: "Estornado",
  paga: "Paga",
  cancelada: "Cancelada",
  iniciado: "Em atendimento",
  aberto: "Aberto",
  em_analise: "Em análise",
  atendido: "Atendido",
  indeferido: "Indeferido",
  recebimento: "Recebimento",
  estorno: "Estorno",
  ativa: "Ativa",
  inativa: "Inativa",
};
const booleanLabels: Record<string, [string, string]> = {
  ativo: ["Ativo", "Inativo"],
  publicado: ["Publicado", "Rascunho"],
  publicada: ["Publicada", "Não publicada"],
  consentimento_publicacao: ["Autorizado", "Não autorizado"],
  exige_registro_foto: ["Obrigatório", "Não obrigatório"],
  consumir_sessao: ["Consome sessão", "Não consome sessão"],
  sessao_consumida: ["Sessão consumida", "Sessão não consumida"],
  gestante_lactante: ["Sim", "Não"],
  marcapasso: ["Sim", "Não"],
  proteses_metalicas: ["Sim", "Não"],
  uso_isotretinoina: ["Sim", "Não"],
  tendencia_queloide: ["Sim", "Não"],
  alergia_acidos_anestesicos: ["Sim", "Não"],
  lesoes_ativas_pele: ["Sim", "Não"],
};
export function display(value: unknown, key = ""): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (booleanLabels[key] && [0, 1, "0", "1"].includes(value as number | string))
    return booleanLabels[key][Number(value) ? 0 : 1];
  if (key.includes("status") && humanStates[String(value)])
    return humanStates[String(value)];
  if (key.startsWith("forma_pagamento") || key === "forma_recebimento")
    return (
      (
        {
          pix: "PIX",
          cartao_credito: "Cartão de crédito",
          cartao_debito: "Cartão de débito",
          dinheiro: "Dinheiro",
        } as Record<string, string>
      )[String(value)] || String(value)
    );
  if (/^(valor|saldo_|base_calculo)/.test(key) && !Number.isNaN(Number(value)))
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(Number(value));
  if (typeof value === "object") return JSON.stringify(value);
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    const date = new Date(
      value.length === 10
        ? `${value}T12:00:00-03:00`
        : /(Z|[+-]\d\d:\d\d)$/.test(value)
          ? value
          : value.replace(" ", "T") + "Z",
    );
    if (!Number.isNaN(date.valueOf()))
      return date.toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        ...(value.length === 10
          ? { dateStyle: "short" }
          : { dateStyle: "short", timeStyle: "short" }),
      });
  }
  return String(value).replaceAll("_", " ");
}
export function localDate(value: unknown): string {
  if (!value) return "";
  const d = new Date(String(value));
  if (Number.isNaN(d.valueOf())) return String(value).slice(0, 16);
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(d)
    .replace(" ", "T");
}
export function convert(fields: Field[], values: Row): Row {
  const data: Row = {};
  for (const f of fields) {
    const v = values[f.name];
    if (v === "" || v === undefined) {
      if (!f.required) data[f.name] = f.type === "boolean" ? false : null;
      continue;
    }
    data[f.name] =
      f.type === "datetime-local"
        ? `${v}:00-03:00`
        : f.type === "number" || f.type === "reference"
          ? Number(v)
          : f.type === "boolean"
            ? Boolean(v)
            : f.type === "money" || f.type === "decimal"
              ? String(v).replace(",", ".")
              : v;
  }
  return data;
}
