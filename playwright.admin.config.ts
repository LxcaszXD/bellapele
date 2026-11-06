import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/admin",
  workers: 1,
  retries: 0,
  timeout: 30000,
  use: {
    baseURL: process.env.TEST_BASE_URL || "http://127.0.0.1:3100",
    headless: true,
    launchOptions: process.env.CHROMIUM_PATH
      ? {
          executablePath: process.env.CHROMIUM_PATH,
          args: [
            "--no-sandbox",
            "--single-process",
            "--disable-dev-shm-usage",
            "--in-process-gpu",
            "--disable-gpu",
            "--disable-software-rasterizer",
            "--no-zygote",
          ],
        }
      : {},
    trace: "retain-on-failure",
  },
  reporter: [["list"]],
});
