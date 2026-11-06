import test from "node:test";
import assert from "node:assert/strict";
import {
  hashPassword,
  verifyPassword,
  hashToken,
  randomToken,
  assertCsrf,
  assertOrigin,
} from "../lib/clinic/security";
import {
  requirePermission,
  rolePermissions,
  type Actor,
} from "../lib/clinic/permissions";
import { imageType } from "../lib/clinic/uploads";
test("hash scrypt com sal individual, senha correta e incorreta", async () => {
  const a = await hashPassword("Uma senha longa 123!"),
    b = await hashPassword("Uma senha longa 123!");
  assert.notEqual(a, b);
  assert.equal(await verifyPassword("Uma senha longa 123!", a), true);
  assert.equal(await verifyPassword("senha incorreta", a), false);
  await assert.rejects(hashPassword("curta"));
});
test("tokens randômicos e digest sem token original", () => {
  const a = randomToken(),
    b = randomToken();
  assert.notEqual(a, b);
  assert.equal(hashToken(a).length, 64);
  assert.notEqual(hashToken(a), a);
});
test("CSRF rejeita header ausente e token incorreto", () => {
  assert.throws(() => assertCsrf(new Request("http://localhost"), "abc"));
  assert.throws(() =>
    assertCsrf(
      new Request("http://localhost", { headers: { "x-csrf-token": "xyz" } }),
      "abc",
    ),
  );
  assertCsrf(
    new Request("http://localhost", { headers: { "x-csrf-token": "abc" } }),
    "abc",
  );
});
test("origin restrita", () => {
  process.env.APP_ORIGIN = "http://localhost:3000";
  assert.throws(() =>
    assertOrigin(
      new Request("http://localhost", {
        headers: { origin: "https://evil.example" },
      }),
    ),
  );
  assertOrigin(
    new Request("http://localhost", {
      headers: { origin: "http://localhost:3000" },
    }),
  );
});
test("recepção não acessa saúde ou financeiro", () => {
  const user: Actor = {
    id: 1,
    nome: "Teste",
    email: "test@example.test",
    perfil: "recepcao",
    id_profissional: null,
    permissions: rolePermissions.recepcao,
  };
  assert.throws(() => requirePermission(user, "clinical:read"));
  assert.throws(() => requirePermission(user, "finance:read"));
  requirePermission(user, "clientes:write");
});
test("upload rejeita SVG e conteúdo HTML", () => {
  assert.throws(() => imageType(Buffer.from('<svg onload="alert(1)">')));
  assert.throws(() => imageType(Buffer.from("<html><script>evil</script>")));
  assert.equal(
    imageType(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0])),
    "image/png",
  );
});
