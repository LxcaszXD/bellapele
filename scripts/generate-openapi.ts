import { writeFileSync } from "node:fs";
import { resources } from "../lib/clinic/catalog";
const paths: Record<string, unknown> = {};
const response = {
  200: { description: "Operação concluída" },
  401: { description: "Sessão ausente ou expirada" },
  403: { description: "Permissão, origem ou CSRF inválidos" },
  409: { description: "Conflito de negócio" },
  422: { description: "Dados inválidos" },
};
for (const r of resources) {
  const properties = Object.fromEntries(
    r.fields.map((f) => [
      f.name,
      {
        type:
          f.type === "boolean"
            ? "boolean"
            : ["reference", "number"].includes(f.type)
              ? "integer"
              : "string",
        description: f.label,
        ...(f.options ? { enum: f.options.map((o) => o.value) } : {}),
      },
    ]),
  );
  const body = {
    required: true,
    content: {
      "application/json": {
        schema: {
          type: "object",
          properties,
          required: r.fields.filter((f) => f.required).map((f) => f.name),
        },
      },
    },
  };
  paths["/" + r.key] = {
    get: {
      summary: "Listar " + r.label,
      parameters: [
        "page",
        "pageSize",
        "search",
        "sort",
        "direction",
        "cliente",
        "profissional",
        "procedimento",
        "status",
        "from",
        "to",
      ].map((name) => ({ name, in: "query", schema: { type: "string" } })),
      responses: response,
    },
    ...(!r.readonly
      ? {
          post: {
            summary: "Cadastrar " + r.label,
            requestBody: body,
            responses: response,
          },
        }
      : {}),
  };
  paths["/" + r.key + "/{id}"] = {
    parameters: [
      { name: "id", in: "path", required: true, schema: { type: "integer" } },
    ],
    get: { summary: "Consultar " + r.label, responses: response },
    ...(!r.readonly && !r.appendOnly
      ? {
          patch: {
            summary: "Editar " + r.label,
            requestBody: body,
            responses: response,
          },
        }
      : {}),
    ...(r.active
      ? {
          delete: {
            summary: "Desativar preservando histórico",
            responses: response,
          },
        }
      : {}),
  };
}
for (const name of [
  "vender-pacote",
  "agendar",
  "reagendar",
  "status-agenda",
  "iniciar-atendimento",
  "concluir-atendimento",
  "pagamento-avulso",
  "receber-parcela",
  "estornar-pagamento",
  "cancelar-pagamento",
  "movimentar-estoque",
  "pagar-comissao",
])
  paths["/operations/" + name] = {
    post: {
      summary: name,
      description:
        "Contrato dos campos em docs/CONTRATO-API.md. Operação transacional.",
      requestBody: {
        required: true,
        content: { "application/json": { schema: { type: "object" } } },
      },
      responses: response,
    },
  };
for (const name of ["login", "logout", "forgot", "reset"])
  paths["/auth/" + name] = { post: { summary: name, responses: response } };
paths["/auth/session"] = {
  get: { summary: "Sessão e token CSRF", responses: response },
};
paths["/dashboard"] = {
  get: { summary: "Indicadores reais", responses: response },
};
paths["/meta"] = {
  get: { summary: "Catálogo autorizado de recursos", responses: response },
};
paths["/reports/{kind}"] = {
  get: {
    summary: "Relatório filtrado por from/to",
    parameters: [
      { name: "kind", in: "path", required: true, schema: { type: "string" } },
    ],
    responses: response,
  },
};
writeFileSync(
  "docs/openapi.json",
  JSON.stringify(
    {
      openapi: "3.1.0",
      info: {
        title: "BellaPelle API",
        version: "5.0.0",
        description:
          "Cookies de sessão. Mutações exigem Origin e X-CSRF-Token. Financeiro interno sem cobrança externa.",
      },
      servers: [{ url: "/api/clinic" }],
      security: [{ session: [] }],
      components: {
        securitySchemes: {
          session: { type: "apiKey", in: "cookie", name: "bellapelle_staff" },
        },
      },
      paths,
    },
    null,
    2,
  ) + "\n",
);
