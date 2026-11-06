import { z } from "zod";
import { ApiError } from "../server/errors";
export const id = z.coerce.number().int().positive();
export function cents(value: unknown): number {
  const s = String(value);
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(s))
    throw new ApiError(422, "Valor monetário inválido");
  const [a, b = ""] = s.split(".");
  return Number(a) * 100 + Number(b.padEnd(2, "0"));
}
export function money(n: number): string {
  return `${Math.floor(n / 100)}.${String(n % 100).padStart(2, "0")}`;
}
export function installments(total: number, count: number) {
  if (!Number.isInteger(count) || count < 1 || count > 48 || total < count)
    throw new ApiError(422, "Parcelamento inválido");
  return Array.from(
    { length: count },
    (_, i) => Math.floor(total / count) + (i < total % count ? 1 : 0),
  );
}
export function validCPF(value: string) {
  const s = value.replace(/\D/g, "");
  if (!/^\d{11}$/.test(s) || /^(\d)\1{10}$/.test(s)) return false;
  for (let size = 9; size < 11; size++) {
    let sum = 0;
    for (let i = 0; i < size; i++) sum += Number(s[i]) * (size + 1 - i);
    const digit = ((sum * 10) % 11) % 10;
    if (digit !== Number(s[size])) return false;
  }
  return true;
}
export function utc(value: unknown) {
  const s = String(value);
  if (!/(Z|[+-]\d\d:\d\d)$/.test(s) || !Number.isFinite(Date.parse(s)))
    throw new ApiError(422, "Informe data/hora ISO com fuso horário");
  return new Date(s).toISOString().slice(0, 19).replace("T", " ");
}
export function quantity(value: unknown) {
  const s = String(value);
  if (!/^\d{1,8}(\.\d{1,3})?$/.test(s) || Number(s) <= 0)
    throw new ApiError(422, "Quantidade inválida");
  return s;
}
export const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      Number.isFinite(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v,
    "Data inválida",
  );
export function assert(ok: unknown, message: string, status = 422): asserts ok {
  if (!ok) throw new ApiError(status, message);
}
