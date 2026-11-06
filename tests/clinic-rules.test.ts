import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cents,
  money,
  installments,
  validCPF,
  date,
  utc,
  quantity,
} from "../lib/clinic/validation";
test("parcelamento conserva centavos mesmo sem divisão exata", () => {
  const result = installments(10000, 3);
  assert.deepEqual(result, [3334, 3333, 3333]);
  assert.equal(
    result.reduce((a, b) => a + b),
    10000,
  );
});
test("moeda rejeita notação exponencial, negativos e excesso de casas", () => {
  assert.equal(cents("120.99"), 12099);
  assert.equal(money(12099), "120.99");
  for (const v of ["1e5", "-1", "1.001", "NaN"]) assert.throws(() => cents(v));
});
test("CPF valida dígitos e rejeita sequências", () => {
  assert.equal(validCPF("529.982.247-25"), true);
  assert.equal(validCPF("52998224724"), false);
  assert.equal(validCPF("11111111111"), false);
});
test("datas inválidas e horário sem fuso são rejeitados", () => {
  assert.equal(date.safeParse("2026-02-30").success, false);
  assert.equal(utc("2026-10-14T11:00:00-03:00"), "2026-10-14 14:00:00");
  assert.throws(() => utc("2026-10-14T11:00:00"));
});
test("quantidades precisam ser positivas com até três casas", () => {
  assert.equal(quantity("0.001"), "0.001");
  for (const v of ["0", "-1", "0.0001"]) assert.throws(() => quantity(v));
});
