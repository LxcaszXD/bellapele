import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
test("layouts responsivos e fluxo completo em oito larguras", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const future = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
  await page.addInitScript(
    ({ future }) =>
      localStorage.setItem(
        "bellapelle-demo-v1",
        JSON.stringify({
          favorites: [1, 2],
          bookings: [
            {
              id: "sample-1",
              treatmentId: 1,
              date: future,
              time: "14:30",
              payment: "Pix",
              status: "confirmed",
              price: 120,
              duration: 35,
            },
            {
              id: "sample-2",
              treatmentId: 2,
              date: future,
              time: "16:00",
              payment: "Pix",
              status: "confirmed",
              price: 150,
              duration: 45,
            },
          ],
        }),
      ),
    { future },
  );
  await mkdir("docs/responsive", { recursive: true });
  for (const [width, height] of [
    [320, 812],
    [390, 844],
    [600, 960],
    [768, 1024],
    [1024, 768],
    [1366, 768],
    [1440, 1000],
    [1920, 1080],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await page.reload();
    await expect(page.getByRole("status")).toHaveCount(0);
    async function check(screen: string) {
      await page.evaluate(() => document.fonts.ready);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
        `${screen} overflow ${width}`,
      ).toBeLessThanOrEqual(width);
      if ([390, 768, 1366, 1440].includes(width))
        await page.screenshot({
          path: `docs/responsive/${width}-${screen}.png`,
          fullPage: true,
        });
    }
    await expect(
      page.getByRole("heading", { name: "Cuide de você hoje" }),
    ).toBeVisible();
    await check("inicio");
    if (width >= 768)
      await expect(
        page.getByRole("button", { name: "BellaPelle, início" }),
      ).toBeVisible();
    await page
      .getByRole("button", { name: "Busque tratamentos ou especialistas" })
      .click();
    await check("busca");
    await page
      .getByRole("heading", { name: "Hidratação facial premium", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Agendar horário", exact: true }),
    ).toBeEnabled();
    if (width >= 768) {
      const slots = await page.locator('.time-grid').boundingBox();
      const bar = await page.locator('.booking-bar').boundingBox();
      expect(bar!.y).toBeGreaterThanOrEqual(slots!.y + slots!.height);
    }
    await check("tratamento");
    await page.getByRole("button", { name: /Alterar data/ }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await check("modal");
    await page.getByRole("button", { name: "Salvar horário" }).click();
    await page
      .getByRole("button", { name: "Agendar horário", exact: true })
      .click();
    await check("confirmacao");
    await page
      .getByRole("button", { name: "Confirmar agendamento", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Agendamento confirmado!" }),
    ).toBeVisible();
    await check("sucesso");
    await page
      .getByRole("button", { name: "Ver meus agendamentos", exact: true })
      .click();
    await check("agendamentos");
    await page.getByRole("button", { name: "Favoritos", exact: true }).click();
    await check("favoritos");
  }
  expect(errors).toEqual([]);
});
