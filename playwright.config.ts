import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  workers: 1,
  use: {
    baseURL: "http://localhost:3000",
    viewport: { width: 390, height: 844 },
    launchOptions: process.env.CHROMIUM_PATH
      ? {
          executablePath: process.env.CHROMIUM_PATH,
          args: [
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--single-process",
            "--in-process-gpu",
            "--disable-gpu",
            "--disable-software-rasterizer",
            "--no-zygote",
          ],
        }
      : {},
  },
  webServer: {
    command: "npm run dev -- --webpack",
    url: "http://localhost:3000",
    reuseExistingServer: false,
    env: { DATA_MODE: "demo" },
    timeout: 120000,
  },
});
