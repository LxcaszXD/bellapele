import { randomBytes } from "node:crypto";
import { writeFile, access } from "node:fs/promises";
for (const name of [".env", ".env.local"]) {
  try {
    await access(name);
    throw Error(
      name + " já existe; configuração preservada. Edite manualmente.",
    );
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
}
const secret = () => randomBytes(24).toString("base64url");
const password = secret();
const adminPassword = secret();
const demoPassword = secret();
const shared = `MYSQL_DATABASE=bellapelle_modelo\nMYSQL_USER=bellapelle\nMYSQL_PASSWORD=${password}\nMYSQL_ROOT_PASSWORD=${secret()}\nADMIN_EMAIL=admin@example.test\nADMIN_NAME=Administração BellaPelle\nADMIN_PASSWORD=${adminPassword}\nDEMO_PASSWORD=${demoPassword}\nAPP_ORIGIN=http://localhost:3000\nCOOKIE_SECURE=false\nDATA_MODE=mysql\nENABLE_LOCAL_DEMO_AUTH=false\nENABLE_LEGACY_PORTAL=false\nPRIVATE_UPLOAD_DIR=/app/private/uploads\n`;
await writeFile(".env", shared, { mode: 0o600, flag: "wx" });
await writeFile(
  ".env.local",
  shared.replace(
    "PRIVATE_UPLOAD_DIR=/app/private/uploads",
    "PRIVATE_UPLOAD_DIR=./private/uploads",
  ) +
    `DATABASE_URL=mysql://bellapelle:${password}@127.0.0.1:3306/bellapelle_modelo\n`,
  { mode: 0o600, flag: "wx" },
);
console.log(
  "Configuração gerada. ADMIN_EMAIL=admin@example.test. Senhas locais estão em .env e .env.local. Troque o e-mail antes de criar o administrador e não publique esses arquivos.",
);
