import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PHASE2_BASE_URL ?? "http://127.0.0.1:3000";

export default defineConfig({
  testDir: ".",
  testMatch: /.*\.spec\.ts/,
  timeout: 45_000,
  expect: { timeout: 12_000 },
  fullyParallel: true,
  workers: 2,
  retries: 0,
  reporter: [
    ["line"],
    ["json", { outputFile: process.env.PHASE2_PLAYWRIGHT_JSON ?? "/tmp/phase2-playwright.json" }]
  ],
  use: {
    baseURL,
    channel: "chrome",
    trace: "off"
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } }
    },
    {
      name: "mobile",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        isMobile: true
      }
    }
  ]
});
