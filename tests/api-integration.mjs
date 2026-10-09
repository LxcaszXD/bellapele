// Execute SOMENTE em banco de desenvolvimento, com o servidor MySQL da API ativo.
// Cria reservas de teste e as cancela ao terminar (mantem historico, nao apaga linhas).
import assert from "node:assert/strict";
const base = process.env.TEST_API_URL ?? "http://localhost:3000";
let cookie = "";
const created = [];
async function call(path, method = "GET", body) {
  const r = await fetch(base + "/api/" + path, {
    method,
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const value = r.headers.get("set-cookie");
  if (value) cookie = value.split(";")[0];
  return { status: r.status, data: await r.json() };
}
try {
  const initial = await call("bootstrap");
  assert.equal(initial.status, 200);
  assert.equal(
    initial.data.mode,
    "mysql",
    "Este teste requer MySQL, não o modo demo.",
  );
  const treatment = initial.data.treatments.find((t) => t.specialistId);
  assert.ok(treatment, "Configure uma agenda.");
  let day, available;
  for (let offset = 30; offset < 50; offset++) {
    day = new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
    const response = await call(
      `slots?date=${day}&treatmentId=${treatment.id}`,
    );
    assert.equal(response.status, 200);
    available = response.data.slots;
    if (available.length >= 2) break;
  }
  assert.ok(available.length >= 2, "Duas vagas são necessárias para o teste.");
  const payload = {
    treatmentId: treatment.id,
    date: day,
    time: available[0],
    payment: "Pix",
    price: 0,
  };
  const results = await Promise.all([
    call("bookings", "POST", payload),
    call("bookings", "POST", payload),
  ]);
  for (const r of results) if (r.status === 201) created.push(r.data.id);
  assert.deepEqual(
    results.map((r) => r.status).sort(),
    [201, 409],
    "Apenas uma reserva concorrente deve ser aceita.",
  );
  const booking = results.find((r) => r.status === 201).data;
  assert.equal(
    booking.price,
    treatment.price,
    "Preço do cliente deve ser ignorado.",
  );
  assert.equal(booking.paymentStatus, "pendente");
  const changed = await call("bookings/" + booking.id, "PATCH", {
    ...payload,
    time: available[1],
    payment: "Cartão de crédito",
  });
  assert.equal(changed.status, 200);
  assert.equal(changed.data.time, available[1]);
  const reloaded = await call("bootstrap");
  assert.ok(
    reloaded.data.bookings.some(
      (b) => b.id === booking.id && b.time === available[1],
    ),
  );
  const invalid = await call("bookings", "POST", {
    ...payload,
    date: "2000-01-01",
  });
  assert.equal(invalid.status, 400);
  const invalidId = await call("slots?date=" + day + "&treatmentId=999999");
  assert.equal(invalidId.status, 422);
  const cancelled = await call("bookings/" + booking.id, "DELETE");
  assert.equal(cancelled.status, 200);
  const final = await call("bootstrap");
  assert.equal(
    final.data.bookings.find((b) => b.id === booking.id).status,
    "cancelled",
  );
  console.log(
    "API MySQL: persistência, concorrência, preço, validação, reagendamento e cancelamento aprovados.",
  );
} finally {
  for (const id of created)
    await call("bookings/" + id, "DELETE").catch(() => {});
}
