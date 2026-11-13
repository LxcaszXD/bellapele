"use client";
import { useState } from "react";
import { type Api, type Field, type Row } from "./api";
import { Dialog, RecordForm } from "./form";
const field = (
  name: string,
  label: string,
  type = "text",
  required = true,
  reference?: string,
): Field => ({ name, label, type, required, reference });
const select = (name: string, label: string, values: string[]): Field => ({
  ...field(name, label, "select"),
  options: values.map((v) => ({
    value: v,
    label:
      (
        {
          pix: "PIX",
          cartao_credito: "Cartão de crédito",
          cartao_debito: "Cartão de débito",
          dinheiro: "Dinheiro",
          confirmado: "Confirmado",
          cancelado: "Cancelado",
          nao_compareceu: "Não compareceu",
        } as Record<string, string>
      )[v] || v.replaceAll("_", " "),
  })),
});
const id = (name: string, label: string, reference: string, required = true) =>
  field(name, label, "reference", required, reference);
export const operationSpecs: Record<
  string,
  { title: string; fields: Field[] }
> = {
  "pagamento-avulso": {
    title: "Cobrança avulsa",
    fields: [
      id("id_agendamento", "Agendamento", "agendamentos"),
      select("forma_pagamento", "Forma de pagamento", [
        "pix",
        "cartao_credito",
        "cartao_debito",
        "dinheiro",
      ]),
      field("numero_parcelas", "Parcelas", "number"),
      field("data_vencimento", "Primeiro vencimento", "date"),
    ],
  },
  "vender-pacote": {
    title: "Vender pacote",
    fields: [
      id("id_cliente", "Cliente", "clientes"),
      id("id_pacote", "Pacote", "pacotes"),
      field("numero_parcelas", "Número de parcelas", "number"),
      select("forma_pagamento", "Forma de pagamento", [
        "pix",
        "cartao_credito",
        "cartao_debito",
        "dinheiro",
      ]),
      field("data_compra", "Data da compra", "date"),
      field("data_vencimento", "Primeiro vencimento", "date"),
    ],
  },
  agendar: {
    title: "Novo agendamento",
    fields: [
      id("id_cliente", "Cliente", "clientes"),
      id("id_profissional", "Profissional", "profissionais"),
      id("id_procedimento", "Procedimento", "procedimentos"),
      id("id_sala", "Sala", "salas"),
      id("id_equipamento", "Equipamento", "equipamentos", false),
      id(
        "id_pacote_cliente",
        "Pacote adquirido (opcional)",
        "pacotes-clientes",
        false,
      ),
      field("data_hora_inicio", "Início", "datetime-local"),
      select("origem_solicitacao", "Origem", [
        "recepcao",
        "telefone",
        "whatsapp",
        "aplicativo",
      ]),
    ],
  },
  reagendar: {
    title: "Reagendar",
    fields: [
      id("id_agendamento", "Agendamento", "agendamentos"),
      field("data_hora_inicio", "Novo início", "datetime-local"),
      field("motivo", "Motivo", "textarea"),
    ],
  },
  "status-agenda": {
    title: "Atualizar situação da agenda",
    fields: [
      id("id_agendamento", "Agendamento", "agendamentos"),
      select("status", "Situação", [
        "confirmado",
        "cancelado",
        "nao_compareceu",
      ]),
      field("motivo", "Motivo / justificativa", "textarea"),
    ],
  },
  "iniciar-atendimento": {
    title: "Iniciar atendimento",
    fields: [id("id_agendamento", "Agendamento", "agendamentos")],
  },
  "concluir-atendimento": {
    title: "Concluir atendimento",
    fields: [
      id("id_agendamento", "Agendamento", "agendamentos"),
      field("regiao_corpo_tratada", "Região do corpo tratada"),
      field("parametros_utilizados", "Parâmetros utilizados", "textarea"),
      field("descricao_evolucao", "Evolução do tratamento", "textarea"),
    ],
  },
  "receber-parcela": {
    title: "Registrar recebimento",
    fields: [
      id("id_parcela", "Parcela", "parcelas"),
      field("valor", "Valor recebido (R$)", "money"),
      select("forma_pagamento", "Forma recebida", [
        "pix",
        "cartao_credito",
        "cartao_debito",
        "dinheiro",
      ]),
      field("data_recebimento", "Data do recebimento", "date"),
    ],
  },
  "estornar-pagamento": {
    title: "Estornar pagamento internamente",
    fields: [
      id("id_pagamento", "Pagamento", "pagamentos"),
      field("motivo", "Motivo", "textarea"),
    ],
  },
  "cancelar-pagamento": {
    title: "Cancelar pagamento",
    fields: [
      id("id_pagamento", "Pagamento", "pagamentos"),
      field("motivo", "Motivo", "textarea"),
    ],
  },
  "movimentar-estoque": {
    title: "Movimentar estoque",
    fields: [
      id("id_produto", "Produto / lote", "produtos"),
      select("tipo", "Tipo", ["entrada", "saida"]),
      field("quantidade", "Quantidade", "decimal"),
      field("motivo", "Motivo", "textarea"),
    ],
  },
  "pagar-comissao": {
    title: "Registrar pagamento de comissão",
    fields: [id("id_comissao", "Comissão", "comissoes")],
  },
};
export function OperationDialog({
  name,
  initial,
  api,
  onClose,
  onSuccess,
}: {
  name: string;
  initial?: Row;
  api: Api;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [products, setProducts] = useState<
      { id_produto: string; quantidade: string }[]
    >([]),
    [available, setAvailable] = useState<Row[]>([]),
    [error, setError] = useState("");
  const spec = operationSpecs[name];
  return (
    <Dialog title={spec.title} onClose={onClose}>
      <RecordForm
        api={api}
        fields={spec.fields}
        initial={initial}
        submitLabel="Confirmar operação"
        onSubmit={async (values) => {
          await api(`operations/${name}`, "POST", {
            ...values,
            ...(name === "concluir-atendimento"
              ? {
                  produtos: products.map((p) => ({
                    id_produto: Number(p.id_produto),
                    quantidade: p.quantidade.replace(",", "."),
                  })),
                }
              : {}),
          });
          onSuccess();
        }}
      >
        {name === "concluir-atendimento" && (
          <section className="admin-product-lines">
            <h3>Produtos utilizados</h3>
            <p>
              Informe o lote e a quantidade na unidade cadastrada. A baixa
              ocorre junto à conclusão.
            </p>
            {products.map((p, i) => (
              <div className="admin-product-line" key={i}>
                <select
                  aria-label={`Produto ${i + 1}`}
                  required
                  value={p.id_produto}
                  onChange={(e) =>
                    setProducts(
                      products.map((v, n) =>
                        n === i ? { ...v, id_produto: e.target.value } : v,
                      ),
                    )
                  }
                >
                  <option value="">Selecione produto / lote</option>
                  {available.map((r) => (
                    <option
                      key={String(r.id_produto)}
                      value={String(r.id_produto)}
                    >
                      {String(r.nome)} · lote {String(r.numero_lote)} (
                      {String(r.unidade_medida)})
                    </option>
                  ))}
                </select>
                <input
                  aria-label={`Quantidade ${i + 1}`}
                  required
                  inputMode="decimal"
                  placeholder="Quantidade"
                  value={p.quantidade}
                  onChange={(e) =>
                    setProducts(
                      products.map((v, n) =>
                        n === i ? { ...v, quantidade: e.target.value } : v,
                      ),
                    )
                  }
                />
                <button
                  type="button"
                  onClick={() =>
                    setProducts(products.filter((_, n) => n !== i))
                  }
                >
                  Remover
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={async () => {
                try {
                  const result = await api<{ items: Row[] }>(
                    "produtos?pageSize=100",
                  );
                  setAvailable(result.items);
                  setProducts([
                    ...products,
                    { id_produto: "", quantidade: "" },
                  ]);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Adicionar produto
            </button>
            {error && <p role="alert">{error}</p>}
          </section>
        )}
        {["vender-pacote", "receber-parcela", "estornar-pagamento"].includes(
          name,
        ) && (
          <p className="admin-notice">
            Controle financeiro interno. Esta operação não executa cobranças ou
            estornos em bancos e adquirentes.
          </p>
        )}
      </RecordForm>
    </Dialog>
  );
}
