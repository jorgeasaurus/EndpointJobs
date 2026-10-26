import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: "http://127.0.0.1:3000",
    channel: "chrome",
    trace: "off"
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
    { name: "mobile", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } } }
  ],
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3000",
    url: "http://127.0.0.1:3000",
    // CI always starts this process, so the env below is applied. Locally, a
    // server already on port 3000 is reused and ignores webServer.env — stop
    // it, or start it with E2E_FIXTURES=1. Production never serves the fixture.
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      E2E_FIXTURES: "1",
      NODE_ENV: "development"
    }
  }
});
