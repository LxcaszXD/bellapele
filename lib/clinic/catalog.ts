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
  table: string;
  pk: string;
  fields: Field[];
  permission?: string;
  readonly?: boolean;
  appendOnly?: boolean;
  active?: boolean;
  scope?: string;
  date?: string;
};
const f = (
  name: string,
  type = "text",
  required = false,
  reference?: string,
): Field => ({
  name,
  label: name.replace(/^id_/, "").replaceAll("_", " "),
  type,
  required,
  reference,
});
const ref = (n: string, r: string, required = true) =>
  f(n, "reference", required, r);
const opts = (n: string, values: string[]): Field => ({
  ...f(n, "select", true),
  options: values.map((value) => ({
    value,
    label: value.replaceAll("_", " "),
  })),
});
export const resources: Resource[] = [
  {
    key: "agenda-portal",
    label: "Agenda do portal",
    table: "AgendaConfiguracao",
    pk: "id_procedimento",
    permission: "config",
    fields: [
      ref("id_procedimento", "procedimentos"),
      ref("id_profissional", "profissionais"),
      ref("id_sala", "salas"),
      ref("id_equipamento", "equipamentos", false),
    ],
  },
  {
    key: "vinculos",
    label: "Vínculos clínicos",
    table: "VinculoClinico",
    pk: "id_vinculo",
    permission: "config",
    active: true,
    fields: [
      ref("id_cliente", "clientes"),
      ref("id_profissional", "profissionais"),
    ],
  },
  {
    key: "politica-faltas",
    label: "Política de faltas",
    table: "PoliticaFalta",
    pk: "id",
    permission: "config",
    fields: [
      f("consumir_sessao", "boolean", true),
      f("justificativa", "text", true),
    ],
  },
  {
    key: "privacidade",
    label: "Solicitações de privacidade",
    table: "PedidoPrivacidade",
    pk: "id_pedido",
    permission: "config",
    fields: [
      ref("id_cliente", "clientes"),
      opts("tipo", ["acesso", "correcao", "exclusao"]),
      f("descricao", "textarea", true),
      opts("status", ["aberto", "em_analise", "atendido", "indeferido"]),
      f("resposta", "textarea"),
    ],
  },

  {
    key: "clientes",
    label: "Clientes",
    table: "Cliente",
    pk: "id_cliente",
    active: true,
    fields: [
      f("nome_completo", "text", true),
      f("cpf", "text", true),
      f("data_nascimento", "date", true),
      f("genero"),
      f("telefone"),
      f("email", "email", true),
      f("endereco"),
      f("como_conheceu"),
      f("preferencias", "textarea"),
    ],
  },
  {
    key: "profissionais",
    label: "Profissionais",
    table: "Profissional",
    pk: "id_profissional",
    active: true,
    fields: [
      f("nome", "text", true),
      f("especialidade", "text", true),
      f("registro_profissional"),
      f("telefone"),
      f("email", "email", true),
      f("data_admissao", "date", true),
    ],
  },
  {
    key: "procedimentos",
    label: "Procedimentos",
    table: "Procedimento",
    pk: "id_procedimento",
    active: true,
    fields: [
      f("nome", "text", true),
      f("categoria", "text", true),
      f("duracao_minutos", "number", true),
      f("valor_avulso", "money", true),
      f("exige_registro_foto", "boolean"),
      f("descricao", "textarea"),
    ],
  },
  {
    key: "salas",
    label: "Salas",
    table: "Sala",
    pk: "id_sala",
    active: true,
    fields: [f("nome", "text", true), f("descricao")],
  },
  {
    key: "equipamentos",
    label: "Equipamentos",
    table: "Equipamento",
    pk: "id_equipamento",
    active: true,
    fields: [f("nome", "text", true), f("tipo", "text", true)],
  },
  {
    key: "habilitacoes",
    label: "Habilitações e percentuais",
    table: "ProfissionalProcedimento",
    pk: "id_prof_procedimento",
    active: true,
    fields: [
      ref("id_profissional", "profissionais"),
      ref("id_procedimento", "procedimentos"),
      f("percentual_comissao", "money", true),
    ],
  },
  {
    key: "disponibilidades",
    label: "Disponibilidade semanal",
    table: "Disponibilidade",
    pk: "id_disponibilidade",
    active: true,
    fields: [
      ref("id_profissional", "profissionais"),
      opts("dia_semana", ["0", "1", "2", "3", "4", "5", "6"]),
      f("hora_inicio", "time", true),
      f("hora_fim", "time", true),
    ],
  },
  {
    key: "bloqueios",
    label: "Bloqueios e manutenção",
    table: "Bloqueio",
    pk: "id_bloqueio",
    active: true,
    fields: [
      ref("id_profissional", "profissionais", false),
      ref("id_sala", "salas", false),
      ref("id_equipamento", "equipamentos", false),
      f("inicio", "datetime-local", true),
      f("fim", "datetime-local", true),
      f("motivo", "textarea", true),
    ],
  },
  {
    key: "anamneses",
    label: "Anamneses",
    table: "Anamnese",
    pk: "id_anamnese",
    permission: "clinical",
    appendOnly: true,
    date: "data_avaliacao",
    fields: [
      ref("id_cliente", "clientes"),
      ref("id_profissional", "profissionais"),
      ...[
        "gestante_lactante",
        "marcapasso",
        "proteses_metalicas",
        "uso_isotretinoina",
        "tendencia_queloide",
      ].map((n) => f(n, "boolean")),
      f("alergia_acidos_anestesicos", "textarea"),
      f("lesoes_ativas_pele", "textarea"),
      f("contraindicacoes", "textarea"),
      f("fototipo_fitzpatrick", "number"),
      f("medida_cintura", "money"),
      f("medida_quadril", "money"),
      f("medida_coxa", "money"),
      f("data_avaliacao", "datetime-local", true),
    ],
  },
  {
    key: "pacotes",
    label: "Pacotes",
    table: "Pacote",
    pk: "id_pacote",
    active: true,
    fields: [
      ref("id_procedimento", "procedimentos"),
      f("nome", "text", true),
      f("quantidade_sessoes", "number", true),
      f("validade_meses", "number", true),
      f("valor_total", "money", true),
    ],
  },
  {
    key: "pacotes-clientes",
    label: "Pacotes vendidos",
    table: "PacoteCliente",
    pk: "id_pacote_cliente",
    readonly: true,
    date: "data_compra",
    fields: [
      ref("id_cliente", "clientes"),
      ref("id_pacote", "pacotes"),
      f("data_compra", "date"),
      f("data_validade", "date"),
      f("sessoes_contratadas", "number"),
      f("sessoes_utilizadas", "number"),
      f("sessoes_restantes", "number"),
      f("valor_contratado", "money"),
      f("status_pagamento"),
    ],
  },
  {
    key: "pagamentos",
    label: "Pagamentos",
    table: "Pagamento",
    pk: "id_pagamento",
    permission: "finance",
    readonly: true,
    date: "data_pagamento",
    fields: [
      ref("id_cliente", "clientes"),
      f("id_pacote_cliente", "number"),
      f("id_agendamento", "number"),
      f("forma_pagamento"),
      f("valor_total", "money"),
      f("numero_parcelas", "number"),
      f("data_pagamento", "datetime-local"),
      f("status"),
    ],
  },
  {
    key: "parcelas",
    label: "Parcelas",
    table: "Parcela",
    pk: "id_parcela",
    permission: "finance",
    readonly: true,
    date: "data_vencimento",
    fields: [
      ref("id_pagamento", "pagamentos"),
      f("numero_parcela", "number"),
      f("valor_parcela", "money"),
      f("valor_recebido", "money"),
      f("data_vencimento", "date"),
      f("data_pagamento", "datetime-local"),
      f("status"),
    ],
  },
  {
    key: "agendamentos",
    label: "Agenda",
    table: "Agendamento",
    pk: "id_agendamento",
    readonly: true,
    date: "data_hora_inicio",
    fields: [
      ref("id_cliente", "clientes"),
      ref("id_profissional", "profissionais"),
      ref("id_procedimento", "procedimentos"),
      ref("id_sala", "salas"),
      ref("id_equipamento", "equipamentos", false),
      f("id_pacote_cliente", "number"),
      f("data_hora_inicio", "datetime-local"),
      f("data_hora_fim", "datetime-local"),
      f("status"),
      f("valor_sessao", "money"),
    ],
  },
  {
    key: "atendimentos",
    label: "Atendimentos",
    table: "Atendimento",
    pk: "id_atendimento",
    readonly: true,
    permission: "clinical",
    date: "data_atendimento",
    fields: [
      ref("id_agendamento", "agendamentos"),
      f("regiao_corpo_tratada"),
      f("parametros_utilizados", "textarea"),
      f("descricao_evolucao", "textarea"),
      f("data_atendimento", "datetime-local"),
      f("status"),
    ],
  },
  {
    key: "produtos",
    label: "Produtos e lotes",
    table: "Produto",
    pk: "id_produto",
    active: true,
    permission: "stock",
    fields: [
      f("nome", "text", true),
      f("categoria", "text", true),
      f("marca", "text", true),
      opts("unidade_medida", ["un", "ml", "g"]),
      f("numero_lote", "text", true),
      f("data_validade", "date", true),
      f("valor_unitario", "money", true),
      f("estoque_minimo", "decimal"),
    ],
  },
  {
    key: "movimentacoes",
    label: "Movimentações de estoque",
    table: "MovimentacaoEstoque",
    pk: "id_movimentacao",
    readonly: true,
    permission: "stock",
    date: "data",
    fields: [
      ref("id_produto", "produtos"),
      f("id_atendimento", "number"),
      f("tipo"),
      f("quantidade", "decimal"),
      f("data", "datetime-local"),
      f("motivo"),
    ],
  },
  {
    key: "comissoes",
    label: "Comissões",
    table: "Comissao",
    pk: "id_comissao",
    readonly: true,
    permission: "finance",
    date: "data",
    fields: [
      ref("id_profissional", "profissionais"),
      f("id_atendimento", "number"),
      f("base_calculo", "money"),
      f("percentual", "money"),
      f("valor", "money"),
      f("status"),
      f("data", "datetime-local"),
    ],
  },
  {
    key: "faltas",
    label: "Faltas, cancelamentos e remarcações",
    table: "EventoAgenda",
    pk: "id_evento",
    readonly: true,
    date: "data",
    fields: [
      ref("id_agendamento", "agendamentos"),
      f("tipo"),
      f("motivo"),
      f("data", "datetime-local"),
    ],
  },
];
export function resource(key: string) {
  return resources.find((r) => r.key === key);
}
