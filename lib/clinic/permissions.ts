export type Actor = {
  id: number;
  nome: string;
  email: string;
  perfil: string;
  id_profissional: number | null;
  permissions: string[];
};
export class ClinicError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code = "INVALID_REQUEST",
  ) {
    super(message);
  }
}
const common = [
  "clientes:read",
  "profissionais:read",
  "procedimentos:read",
  "salas:read",
  "equipamentos:read",
  "pacotes:read",
  "agendamentos:read",
];
export const rolePermissions: Record<string, string[]> = {
  administrador: ["*"],
  recepcao: [
    ...common,
    "clientes:write",
    "agendamentos:write",
    "pacotes-clientes:read",
    "faltas:read",
    "faltas:write",
    "disponibilidades:read",
    "bloqueios:read",
    "habilitacoes:read",
  ],
  profissional: [
    ...common,
    "clinical:read",
    "clinical:write",
    "anamneses:read",
    "anamneses:write",
    "atendimentos:read",
    "atendimentos:write",
    "produtos:read",
    "stock:read",
    "pacotes-clientes:read",
    "habilitacoes:read",
    "disponibilidades:read",
  ],
  financeiro: [
    "clientes:read",
    "profissionais:read",
    "procedimentos:read",
    "pacotes:read",
    "pacotes:write",
    "pacotes-clientes:read",
    "pacotes-clientes:write",
    "finance:read",
    "finance:write",
    "pagamentos:read",
    "pagamentos:write",
    "parcelas:read",
    "parcelas:write",
    "comissoes:read",
    "comissoes:write",
    "reports:read",
  ],
  estoque: [
    "stock:read",
    "stock:write",
    "produtos:read",
    "produtos:write",
    "movimentacoes:read",
    "movimentacoes:write",
  ],
};
export const validPermissions = [
  ...new Set([
    ...Object.values(rolePermissions)
      .flat()
      .filter((x) => x !== "*"),
    "users:write",
    "config:read",
    "config:write",
    ...[
      "clientes",
      "profissionais",
      "procedimentos",
      "salas",
      "equipamentos",
      "habilitacoes",
      "disponibilidades",
      "bloqueios",
      "anamneses",
      "pacotes",
      "pacotes-clientes",
      "pagamentos",
      "parcelas",
      "agendamentos",
      "atendimentos",
      "produtos",
      "movimentacoes",
      "comissoes",
      "faltas",
    ].flatMap((r) => [r + ":read", r + ":write"]),
  ]),
];
export function hasPermission(actor: Actor, permission: string) {
  return (
    actor.permissions.includes("*") || actor.permissions.includes(permission)
  );
}
export function requirePermission(actor: Actor, permission: string) {
  if (!hasPermission(actor, permission))
    throw new ClinicError("Acesso não autorizado.", 403, "FORBIDDEN");
}
