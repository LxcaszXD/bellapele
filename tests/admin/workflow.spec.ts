import { test, expect } from "@playwright/test";
test("login, cadastro real, agenda e logout nas quatro larguras", async ({
  page,
}) => {
  if (!process.env.TEST_ADMIN_PASSWORD)
    throw Error("Configure TEST_ADMIN_PASSWORD e prepare o banco isolado.");
  await page.goto("/admin");
  await page.getByLabel("E-mail", { exact: true }).fill("qa@example.test");
  await page
    .getByLabel("Senha", { exact: true })
    .fill(process.env.TEST_ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Visão geral", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clientes", exact: true }).click();
  await page
    .getByRole("button", { name: "Novo registro", exact: true })
    .click();
  const form = page.getByRole("dialog");
  await form.getByLabel("nome completo").fill("Cliente navegador QA");
  await form.getByLabel("cpf", { exact: false }).fill("11144477735");
  await form.getByLabel("data nascimento").fill("1995-01-15");
  await form.getByLabel("email").fill("navegador@example.test");
  await form.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByText("Operação realizada com sucesso.")).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "Cliente navegador QA", exact: true }),
  ).toBeVisible();
  for (const width of [390, 768, 1366, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.getByRole("button", { name: "Agenda", exact: true }).click();
  await expect(page.getByLabel("Visualização")).toBeVisible();
  await page.getByLabel("Visualização").selectOption("mes");
  await expect(page.locator(".admin-calendar-day")).toHaveCount(
    new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate(),
  );
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Entrar", exact: true }),
  ).toBeVisible();
});
