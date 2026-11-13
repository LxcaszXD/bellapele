import assert from "node:assert/strict";
import test from "node:test";
import type { RowDataPacket } from "mysql2";
import { display } from "../components/admin/api";
import { mapBooking } from "../lib/server/booking-service";

test("dashboard traduz estados e booleanos sem alterar contagens", () => {
  assert.equal(display(1, "ativo"), "Ativo");
  assert.equal(display(0, "ativo"), "Inativo");
  assert.equal(display("nao_compareceu", "status"), "Não compareceu");
  assert.equal(display("parcial", "status_pagamento"), "Parcialmente pago");
  assert.equal(display(0, "quantidade"), "0");
});

test("formatador financeiro apresenta saldo como moeda brasileira", () => {
  assert.equal(display("125.50", "saldo_pendente"), "R$ 125,50");
});

test("detalhes do agendamento incluem sala, horários e dados de pagamento", () => {
  const booking = mapBooking({
    id_agendamento: 42,
    id_procedimento: 5,
    data_hora_inicio: "2026-11-12 09:00:00",
    data_hora_fim: "2026-11-12 16:00:00",
    duration: 60,
    valor_sessao: "180.00",
    forma_pagamento: "pix",
    profissional: "Camila Santos",
    id_profissional: 2,
    payment_status: "parcial",
    procedimento: "Cuidado facial",
    sala: "Sala 02",
    payment_amount: "290.00",
    amount_received: "100.00",
    payment_date: "2026-11-12 15:00:00",
    receipt_method: "dinheiro",
    status: "confirmado",
  } as unknown as RowDataPacket);

  assert.equal(booking.endTime, "13:00");
  assert.equal(booking.treatmentName, "Cuidado facial");
  assert.equal(booking.roomName, "Sala 02");
  assert.equal(booking.paymentAmount, 290);
  assert.equal(booking.amountReceived, 100);
  assert.equal(booking.receiptMethod, "Dinheiro");
});
