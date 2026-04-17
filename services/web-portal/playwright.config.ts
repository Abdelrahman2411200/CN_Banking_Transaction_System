import { defineConfig } from "@playwright/test";

export default defineConfig({
  expect: {
    timeout: 10_000
  },
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: false,
  projects: [
    {
      name: "phase13-360",
      use: {
        viewport: { height: 800, width: 360 }
      }
    },
    {
      name: "phase13-768",
      use: {
        viewport: { height: 900, width: 768 }
      }
    },
    {
      name: "phase13-1024",
      use: {
        viewport: { height: 900, width: 1024 }
      }
    },
    {
      name: "phase13-1440",
      use: {
        viewport: { height: 900, width: 1440 }
      }
    }
  ],
  reporter: [["list"]],
  testDir: "./e2e",
  timeout: 60_000,
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
