import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

// A separate config from playwright.config.ts, not a project within it: this run deliberately
// does NOT set DISABLE_HEALTH_CHECKS, since the whole point is demo services showing a real,
// healthy "fast" status for docs screenshots — the regression suite forces the opposite
// (permanently "down") for determinism. Runs against its own disposable data dir so it never
// collides with the e2e suite's.
const webDir = fileURLToPath(new URL(".", import.meta.url));
const serverDir = `${webDir}../server`;
const SHOWCASE_DATA_DIR = `${webDir}e2e/showcase/.showcase-data`;

const serverCommand = [
  `rm -rf ${SHOWCASE_DATA_DIR}`,
  "bun run ../bootstrap/src/index.ts",
  "bun run --hot src/index.ts",
].join(" && ");

export default defineConfig({
  testDir: "./e2e/showcase",
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: {
    // Through Caddy, matching playwright.config.ts's reasoning — same dev-mode path split.
    baseURL: "http://localhost:8080",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: serverCommand,
      cwd: serverDir,
      url: "http://localhost:8080/api/health",
      reuseExistingServer: false,
      env: {
        DATA_DIR: SHOWCASE_DATA_DIR,
      },
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      command: "bun run dev",
      cwd: webDir,
      url: "http://localhost:5173",
      reuseExistingServer: false,
      stdout: "pipe",
      stderr: "pipe",
    },
  ],
});
