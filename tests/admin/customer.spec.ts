import { test, expect } from "@playwright/test";
test("cliente cadastra conta, reserva e consulta perfil em quatro larguras", async ({
  page,
}) => {
  await page.goto("/portal");
  await page.getByRole("button", { name: "Criar minha conta" }).click();
  await page.getByLabel("Nome completo", { exact: true }).fill("Cliente UI");
  await page.getByLabel("CPF", { exact: true }).fill("98765432100");
  await page.getByLabel("Data de nascimento").fill("1990-01-01");
  await page
    .getByLabel("E-mail", { exact: true })
    .fill("portal-ui@example.test");
  await page
    .getByLabel("Senha", { exact: true })
    .fill(process.env.TEST_ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Cuide de você hoje" }),
  ).toBeVisible();
  for (const width of [390, 768, 1366, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => window.scrollTo(0, 0));
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/portal-${width}.png`,
      fullPage: true,
    });
  }
  await page
    .locator(".popular-card")
    .first()
    .getByRole("button")
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Sobre o tratamento" }),
  ).toBeVisible();
  const date = new Date(Date.now() + 4 * 86400000).toISOString().slice(0, 10);
  await page.getByRole("button", { name: /Alterar data/ }).click();
  await page.getByLabel("Escolha a data").fill(date);
  await page.getByRole("button", { name: "Salvar horário" }).click();
  await expect(page.locator(".time-grid button").first()).toBeEnabled();
  await page.locator(".time-grid button").first().click();
  await page
    .getByRole("button", { name: "Agendar horário", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirmar agendamento", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Agendamento confirmado!" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Ver meus agendamentos" }).click();
  await expect(
    page.getByRole("heading", { name: "Meus agendamentos" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Minha conta", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Meus pagamentos" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Entrar", exact: true }),
  ).toBeVisible();
});
