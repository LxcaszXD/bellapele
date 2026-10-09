import { test, expect } from "@playwright/test";
test("fluxo mobile: busca, favorito persistente, reserva, reagendamento e cancelamento", async ({
  page,
}) => {
  async function snapshot(path: string) {
    await page.evaluate(() => document.fonts.ready);
    const height = await page.evaluate(
      () => document.documentElement.scrollHeight,
    );
    await page.setViewportSize({ width: 390, height: Math.max(844, height) });
    await page.screenshot({ path, fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
  }
  const errors: string[] = [];
  page.on("pageerror", (e) => {
    errors.push(e.message);
    console.error(e.message);
  });
  await page.goto("/");
  await expect(page.getByRole("status")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Cuide de você hoje" }),
  ).toBeVisible();
  await snapshot("docs/preview-inicio.png");
  await page
    .getByRole("button", { name: "Busque tratamentos ou especialistas" })
    .click();
  await page
    .getByRole("textbox", { name: "Buscar tratamentos" })
    .fill("hidratacao");
  await expect(page.getByText("1 resultado encontrado")).toBeVisible();
  await page
    .getByRole("button", {
      name: "Adicionar Hidratação facial premium aos favoritos",
    })
    .click();
  await page.reload();
  await expect(
    page.getByRole("button", {
      name: "Remover Hidratação facial premium dos favoritos",
    }),
  ).toBeVisible();
  await snapshot("docs/preview-busca.png");
  await page
    .getByRole("button", { name: /Hidratação facial premium Limpeza/ })
    .click();
  await expect(
    page.getByRole("button", { name: "11:00", exact: true }),
  ).toBeEnabled();
  await snapshot("docs/preview-tratamento.png");
  await page
    .getByRole("button", { name: "Agendar horário", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Confirmar agendamento", exact: true }),
  ).toBeEnabled();
  await snapshot("docs/preview-confirmacao.png");
  await page
    .getByRole("button", { name: "Confirmar agendamento", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Agendamento confirmado!" }),
  ).toBeVisible();
  await snapshot("docs/preview-sucesso.png");
  await page
    .getByRole("button", { name: "Ver meus agendamentos", exact: true })
    .click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Reagendar", exact: true }),
  ).toBeVisible();
  await snapshot("docs/preview-agendamentos.png");
  await page.getByRole("button", { name: "Reagendar", exact: true }).click();
  await page.getByRole("button", { name: "14:30", exact: true }).click();
  await page.getByRole("button", { name: "Reagendar horário" }).click();
  await page
    .getByRole("button", { name: "Confirmar agendamento", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Ver meus agendamentos", exact: true })
    .click();
  await expect(page.getByText(/· 14:30/)).toBeVisible();
  await page.getByRole("button", { name: "Ver detalhes", exact: true }).click();
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Cancelar agendamento", exact: true })
    .click();
  await page.getByRole("button", { name: "Cancelados", exact: true }).click();
  await expect(page.getByText("Cancelado", { exact: true })).toBeVisible();
  for (const width of [360, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  // Contrato da API v2: catalogo dinamico, status clinico e procedimento id > 3.
  const sample = [1, 2, 3, 4, 5].map((id) => ({
    id,
    name: id === 4 ? "Limpeza de pele" : "Procedimento " + id,
    shortName: "Procedimento " + id,
    category: "Facial",
    description: "Descrição",
    about: "Sobre o cuidado",
    duration: 60,
    price: 100,
    rating: 5,
    reviews: 1,
    image: "/images/facial-card.jpg",
    specialistName: "Paula Mendes",
    specialistId: 4,
    experience: 5,
  }));
  await page.route("**/api/bootstrap", (route) =>
    route.fulfill({
      json: {
        mode: "mysql",
        customer: { name: "Amanda Silva" },
        treatments: sample,
        favorites: [],
        bookings: [
          {
            id: "55",
            treatmentId: 4,
            date: "2026-10-03",
            time: "11:00",
            duration: 60,
            price: 100,
            payment: "Pix",
            status: "completed",
            specialistName: "Paula Mendes",
          },
        ],
      },
    }),
  );
  await page.route("**/api/slots?**", (route) =>
    route.fulfill({ json: { slots: ["09:30", "11:00", "14:30", "16:00"] } }),
  );
  await page.goto("/#screen=bookings&id=1");
  await page.reload();
  await page.getByRole("button", { name: "Concluídos", exact: true }).click();
  await expect(page.getByText("Concluído", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  const request = page.waitForRequest(
    (r) => r.url().includes("/api/slots?") && r.url().includes("treatmentId=4"),
  );
  await page
    .getByRole("heading", { name: "Limpeza de pele", exact: true })
    .click();
  await request;
  await expect(
    page.getByRole("heading", { name: "Paula Mendes", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Agendar horário", exact: true }),
  ).toBeEnabled();
  expect(errors).toEqual([]);
});
