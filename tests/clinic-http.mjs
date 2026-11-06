import assert from "node:assert/strict";
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3100";
if (!process.env.TEST_ADMIN_PASSWORD)
  throw Error("Configure TEST_ADMIN_PASSWORD.");
const call = (path, options = {}) =>
  fetch(base + "/api/clinic/" + path, options);
let r = await call("clientes");
assert.equal(r.status, 401);
r = await call("auth/login", {
  method: "POST",
  headers: {
    "content-type": "application/json",
    origin: "https://invalid.example",
  },
  body: JSON.stringify({
    email: "qa@example.test",
    password: process.env.TEST_ADMIN_PASSWORD,
  }),
});
assert.equal(r.status, 403);
r = await call("auth/login", {
  method: "POST",
  headers: { "content-type": "application/json", origin: base },
  body: JSON.stringify({
    email: "qa@example.test",
    password: process.env.TEST_ADMIN_PASSWORD,
  }),
});
assert.equal(r.status, 200);
const session = await r.json(),
  cookie = r.headers.get("set-cookie").split(";")[0];
assert.ok(r.headers.get("set-cookie").includes("HttpOnly"));
r = await call("clientes", { headers: { cookie } });
assert.equal(r.status, 200);
assert.ok((await r.json()).items.length);
r = await call("clientes", {
  method: "POST",
  headers: { cookie, origin: base, "content-type": "application/json" },
  body: "{}",
});
assert.equal(r.status, 403);
r = await call("auth/logout", {
  method: "POST",
  headers: { cookie, origin: base, "x-csrf-token": session.csrfToken },
});
assert.equal(r.status, 200);
r = await call("clientes", { headers: { cookie } });
assert.equal(r.status, 401);
console.log(
  "HTTP: 7 verificações aprovadas (sessão, origem, cookie, persistência, CSRF e logout).",
);
