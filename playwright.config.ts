import { defineConfig } from "@playwright/test";

// Uses a locally installed Chrome if CHROME_PATH is set, else Playwright's Chromium (`npx playwright install chromium`).
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  outputDir: "e2e-results",
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    screenshot: "only-on-failure",
    launchOptions: process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {},
    viewport: { width: 1440, height: 900 },
  },
  webServer: process.env.BASE_URL ? undefined : { command: "npm run start", url: "http://localhost:3000", reuseExistingServer: true, timeout: 120_000 },
});
