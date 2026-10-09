import { test } from "node:test";
import assert from "node:assert/strict";
import { bookingSchema, endTime, treatments } from "../lib/domain";
const future = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
const valid = { treatmentId: 1, date: future, time: "11:00", payment: "Pix" };
test("calcula término atravessando a hora", () =>
  assert.equal(endTime("09:30", 45), "10:15"));
test("aceita agendamento futuro válido", () =>
  assert.equal(bookingSchema.safeParse(valid).success, true));
test("rejeita datas passadas e impossíveis", () => {
  for (const date of ["2000-01-01", "2030-02-30", "invalida"])
    assert.equal(bookingSchema.safeParse({ ...valid, date }).success, false);
});
test("rejeita horários, pagamentos e identificadores inválidos", () => {
  for (const data of [
    { time: "11:05" },
    { treatmentId: 0 },
    { payment: "dinheiro" },
  ])
    assert.equal(bookingSchema.safeParse({ ...valid, ...data }).success, false);
});
test("intervalos do catálogo não se sobrepõem entre slots consecutivos", () => {
  for (const t of treatments) assert.ok(t.duration <= 90);
});
