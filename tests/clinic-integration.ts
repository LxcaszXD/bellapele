import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import mysql from "mysql2/promise";
import { dispatchClinic } from "../lib/clinic/service";
import { type Actor, rolePermissions } from "../lib/clinic/permissions";
import { db } from "../lib/db";
import { hashPassword } from "../lib/clinic/security";
async function main() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !new URL(url).pathname.endsWith("_test"))
    throw Error(
      "TEST_DATABASE_URL deve apontar para um banco isolado com sufixo _test.",
    );
  process.env.DATABASE_URL = url;
  const connection = await mysql.createConnection(url);
  const [[existing]] = await connection.query<mysql.RowDataPacket[]>(
    "SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema=DATABASE()",
  );
  assert.equal(
    Number(existing.n),
    0,
    "Use banco de testes vazio; não apagamos dados automaticamente.",
  );
  await connection.end();
  execFileSync(process.execPath, ["scripts/migrate.mjs"], {
    env: process.env,
    stdio: "inherit",
  });
  const admin: Actor = {
    id: 1,
    nome: "QA",
    email: "qa@example.test",
    perfil: "administrador",
    id_profissional: null,
    permissions: ["*"],
  };
  async function call(
    path: string,
    method = "GET",
    body?: unknown,
    actor = admin,
  ) {
    return dispatchClinic(
      new Request("http://localhost/api/clinic/" + path, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
      path.split("?")[0].split("/"),
      actor,
    ) as Promise<Record<string, unknown>>;
  }
  let count = 0;
  const pass = (name: string) => {
    count++;
    console.log("PASS", name);
  };
  try {
    await db().query(
      "INSERT INTO Usuario(nome,email,senha_hash,perfil) VALUES('QA','qa@example.test',?,'administrador')",
      [
        await hashPassword(
          process.env.TEST_ADMIN_PASSWORD ||
            randomBytes(24).toString("base64url"),
        ),
      ],
    );
    const cli = await call("clientes", "POST", {
      nome_completo: "Cliente QA",
      cpf: "52998224725",
      data_nascimento: "1990-01-01",
      email: "cliente@example.test",
    });
    const prof = await call("profissionais", "POST", {
      nome: "Profissional QA",
      especialidade: "Estética",
      email: "prof@example.test",
      data_admissao: "2020-01-01",
    });
    const proc = await call("procedimentos", "POST", {
      nome: "Procedimento QA",
      categoria: "Facial",
      duracao_minutos: 35,
      valor_avulso: "120.00",
      exige_registro_foto: false,
    });
    const sala = await call("salas", "POST", { nome: "Sala QA" });
    const eq = await call("equipamentos", "POST", {
      nome: "Equipamento QA",
      tipo: "Teste",
    });
    await call("habilitacoes", "POST", {
      ...prof,
      ...proc,
      percentual_comissao: "10.00",
    });
    pass("cadastros e habilitação persistidos");
    await assert.rejects(
      call("clientes", "POST", {
        nome_completo: "Duplicado",
        cpf: "52998224725",
        data_nascimento: "1990-01-01",
        email: "outro@example.test",
      }),
    );
    pass("CPF único");
    const reception = {
      ...admin,
      perfil: "recepcao",
      permissions: rolePermissions.recepcao,
    };
    await assert.rejects(call("anamneses", "GET", undefined, reception));
    await assert.rejects(call("pagamentos", "GET", undefined, reception));
    pass("RBAC bloqueia saúde e financeiro");
    await call("anamneses", "POST", {
      ...cli,
      ...prof,
      data_avaliacao: new Date().toISOString(),
      gestante_lactante: false,
      marcapasso: false,
      proteses_metalicas: false,
      uso_isotretinoina: false,
      tendencia_queloide: false,
    });
    const pack = await call("pacotes", "POST", {
      ...proc,
      nome: "Pacote QA",
      quantidade_sessoes: 2,
      validade_meses: 6,
      valor_total: "200.00",
    });
    const today = new Date().toISOString().slice(0, 10);
    const sale = await call("operations/vender-pacote", "POST", {
      ...cli,
      ...pack,
      numero_parcelas: 3,
      forma_pagamento: "pix",
      data_compra: today,
      data_vencimento: today,
    });
    const [parts] = await db().query<mysql.RowDataPacket[]>(
      "SELECT * FROM Parcela WHERE id_pagamento=?",
      [sale.id_pagamento],
    );
    assert.equal(
      parts.reduce((s, p) => s + Math.round(Number(p.valor_parcela) * 100), 0),
      20000,
    );
    pass("venda e parcelamento conservam valor total");
    const future = new Date(Date.now() + 86400000).toISOString();
    const booking = {
      ...cli,
      ...prof,
      ...proc,
      ...sala,
      ...eq,
      id_pacote_cliente: sale.id_pacote_cliente,
      data_hora_inicio: future,
      origem_solicitacao: "recepcao",
    };
    const concurrent = await Promise.allSettled([
      call("operations/agendar", "POST", booking),
      call("operations/agendar", "POST", booking),
    ]);
    assert.equal(concurrent.filter((r) => r.status === "fulfilled").length, 1);
    pass("concorrência de agendamento permite somente um horário");
    const booked = concurrent.find(
      (r) => r.status === "fulfilled",
    ) as PromiseFulfilledResult<Record<string, unknown>>;
    const appointment = booked.value;
    await call("operations/status-agenda", "POST", {
      ...appointment,
      status: "confirmado",
      motivo: "Confirmação QA",
    });
    await db().query(
      "UPDATE Agendamento SET data_hora_inicio=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 HOUR),data_hora_fim=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 25 MINUTE) WHERE id_agendamento=?",
      [appointment.id_agendamento],
    );
    const product = await call("produtos", "POST", {
      nome: "Produto QA",
      categoria: "Gel",
      marca: "QA",
      unidade_medida: "ml",
      numero_lote: "QA1",
      data_validade: "2035-01-01",
      valor_unitario: "10.00",
      estoque_minimo: "1",
    });
    await call("operations/movimentar-estoque", "POST", {
      ...product,
      tipo: "entrada",
      quantidade: "5",
      motivo: "Entrada QA",
    });
    const completion = {
      ...appointment,
      regiao_corpo_tratada: "Face",
      descricao_evolucao: "Registro fictício QA",
      produtos: [{ ...product, quantidade: "6" }],
    };
    await assert.rejects(
      call("operations/concluir-atendimento", "POST", completion),
    );
    const [[balance]] = await db().query<mysql.RowDataPacket[]>(
      "SELECT sessoes_utilizadas FROM PacoteCliente WHERE id_pacote_cliente=?",
      [sale.id_pacote_cliente],
    );
    assert.equal(balance.sessoes_utilizadas, 0);
    pass("estoque insuficiente desfaz consumo de sessão e atendimento");
    completion.produtos[0].quantidade = "2";
    const finished = await Promise.all([
      call("operations/concluir-atendimento", "POST", completion),
      call("operations/concluir-atendimento", "POST", completion),
    ]);
    assert.equal(finished[0].id_atendimento, finished[1].id_atendimento);
    const [[stock]] = await db().query<mysql.RowDataPacket[]>(
      "SELECT quantidade_estoque FROM Produto WHERE id_produto=?",
      [product.id_produto],
    );
    assert.equal(stock.quantidade_estoque, "3.000");
    const [[used]] = await db().query<mysql.RowDataPacket[]>(
      "SELECT sessoes_utilizadas FROM PacoteCliente WHERE id_pacote_cliente=?",
      [sale.id_pacote_cliente],
    );
    assert.equal(used.sessoes_utilizadas, 1);
    const [[commission]] = await db().query<mysql.RowDataPacket[]>(
      "SELECT * FROM Comissao",
    );
    assert.equal(commission.valor, "10.00");
    pass(
      "finalização concorrente idempotente: sessão, estoque e comissão únicos",
    );
    await assert.rejects(
      call("operations/pagar-comissao", "POST", {
        id_comissao: commission.id_comissao,
      }),
    );
    for (const p of parts)
      await call("operations/receber-parcela", "POST", {
        id_parcela: p.id_parcela,
        valor: p.valor_parcela,
      });
    await call("operations/pagar-comissao", "POST", {
      id_comissao: commission.id_comissao,
    });
    pass("comissão depende do recebimento integral");
    const dash = await call("dashboard");
    assert.equal(
      String((dash.totals as Record<string, unknown>).valor_recebido),
      "200.00",
    );
    pass("dashboard reflete recebimentos reais");
    for (const name of [
      "faturamento",
      "pagamentos",
      "comissoes",
      "atendimentos",
      "procedimentos",
      "pacotes",
      "vencimentos",
      "sessoes",
      "faltas",
      "estoque",
      "produtos",
    ])
      await call("reports/" + name);
    pass("11 relatórios consultam MySQL");
    const clinical = {
      ...admin,
      perfil: "profissional",
      id_profissional: Number(prof.id_profissional),
      permissions: rolePermissions.profissional,
    };
    const freshClient = await call("clientes", "POST", {
      nome_completo: "Vínculo QA",
      cpf: "01234567890",
      data_nascimento: "1995-02-02",
      email: "vinculo@example.test",
    });
    await assert.rejects(
      call(
        "anamneses",
        "POST",
        { ...freshClient, ...prof, data_avaliacao: new Date().toISOString() },
        clinical,
      ),
    );
    await call("vinculos", "POST", { ...freshClient, ...prof });
    await call(
      "anamneses",
      "POST",
      { ...freshClient, ...prof, data_avaliacao: new Date().toISOString() },
      clinical,
    );
    pass(
      "vínculo clínico permite avaliação inicial sem liberar outros clientes",
    );
    const sale2 = await call("operations/vender-pacote", "POST", {
      ...cli,
      ...pack,
      numero_parcelas: 1,
      forma_pagamento: "pix",
      data_compra: today,
      data_vencimento: today,
    });
    for (const consume of [false, true]) {
      await call("politica-faltas/1", "PATCH", {
        consumir_sessao: consume,
        justificativa: "Política fictícia de QA",
      });
      const a = await call("operations/agendar", "POST", {
        ...booking,
        id_pacote_cliente: sale2.id_pacote_cliente,
        data_hora_inicio: new Date(Date.now() + 4 * 86400000).toISOString(),
      });
      await db().query(
        "UPDATE Agendamento SET data_hora_inicio=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 2 HOUR),data_hora_fim=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 HOUR) WHERE id_agendamento=?",
        [a.id_agendamento],
      );
      await call("operations/status-agenda", "POST", {
        ...a,
        status: "nao_compareceu",
        motivo: "Teste política",
      });
      await assert.rejects(
        call("operations/status-agenda", "POST", {
          ...a,
          status: "nao_compareceu",
          motivo: "Repetição",
        }),
      );
      const [[balance]] = await db().query<mysql.RowDataPacket[]>(
        "SELECT sessoes_utilizadas FROM PacoteCliente WHERE id_pacote_cliente=?",
        [sale2.id_pacote_cliente],
      );
      assert.equal(balance.sessoes_utilizadas, consume ? 1 : 0);
    }
    await call("politica-faltas/1", "PATCH", {
      consumir_sessao: false,
      justificativa: "Restaurar padrão sem débito",
    });
    pass("política de faltas configurável e débito sem duplicação");
    await db().query(
      "UPDATE PacoteCliente SET data_compra='1999-01-01',data_validade='2000-01-01' WHERE id_pacote_cliente=?",
      [sale2.id_pacote_cliente],
    );
    await assert.rejects(
      call("operations/agendar", "POST", {
        ...booking,
        id_pacote_cliente: sale2.id_pacote_cliente,
        data_hora_inicio: new Date(Date.now() + 6 * 86400000).toISOString(),
      }),
    );
    await db().query(
      "UPDATE PacoteCliente SET data_validade='2035-01-01',sessoes_utilizadas=sessoes_contratadas WHERE id_pacote_cliente=?",
      [sale2.id_pacote_cliente],
    );
    await assert.rejects(
      call("operations/agendar", "POST", {
        ...booking,
        id_pacote_cliente: sale2.id_pacote_cliente,
        data_hora_inicio: new Date(Date.now() + 6 * 86400000).toISOString(),
      }),
    );
    pass("pacote vencido e sem saldo bloqueados");
    const [[part]] = await db().query<mysql.RowDataPacket[]>(
      "SELECT id_parcela FROM Parcela WHERE id_pagamento=?",
      [sale2.id_pagamento],
    );
    await call("operations/receber-parcela", "POST", {
      id_parcela: part.id_parcela,
      valor: "50.00",
    });
    const [[partial]] = await db().query<mysql.RowDataPacket[]>(
      "SELECT valor_recebido,status FROM Parcela WHERE id_parcela=?",
      [part.id_parcela],
    );
    assert.equal(partial.valor_recebido, "50.00");
    assert.equal(partial.status, "pendente");
    pass("recebimento parcial preserva pendência");
    console.log(`Integração: ${count} cenários aprovados.`);
  } finally {
    await db().end();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
