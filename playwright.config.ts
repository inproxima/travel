import { defineConfig, devices } from "@playwright/test";

// Click-through tests of every mode against a production build in sample-data
// mode (no keys, no credits). First time: npx playwright install chromium
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  fullyParallel: false,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:3200", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npx next build && npx next start -p 3200",
    url: "http://localhost:3200/api/status",
    reuseExistingServer: false,
    timeout: 240_000,
    env: { MOCK_MODE: "1", DATA_DIR: ".data/e2e", NEXT_TELEMETRY_DISABLED: "1", NODE_OPTIONS: "--disable-warning=ExperimentalWarning" },
  },
});
