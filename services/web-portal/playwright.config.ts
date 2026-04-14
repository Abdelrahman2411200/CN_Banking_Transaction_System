import { defineConfig } from "@playwright/test";

export default defineConfig({
  expect: {
    timeout: 10_000
  },
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: false,
  projects: [
    {
      name: "dashboard-smoke",
      use: {
        viewport: { height: 900, width: 1440 }
      }
    }
  ],
  reporter: [["list"]],
  testDir: "./e2e",
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:4175",
    trace: "retain-on-failure"
  },
  webServer: {
    command: "npm run dev -- --port 4175",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    url: "http://127.0.0.1:4175"
  }
});
