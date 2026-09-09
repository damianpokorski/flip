import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";
import { E2E_DATA_DIR } from "./e2e/data-dir";

const webDir = fileURLToPath(new URL(".", import.meta.url));
const serverDir = `${webDir}../server`;

// Playwright starts `webServer` entries concurrently with (not after) any `globalSetup`, so
// seeding the disposable data dir out-of-band would race the server's own startup. Instead,
// the server's own command wipes + bootstraps before it ever calls `.listen()` — the `url`
// readiness check then only succeeds once that's genuinely done, no race possible.
const serverCommand = [
  `rm -rf ${E2E_DATA_DIR}`,
  "bun run ../bootstrap/src/index.ts",
  "bun run --hot src/index.ts",
].join(" && ");

export default defineConfig({
  testDir: "./e2e",
  // The disposable data dir is a single shared set of YAML files for the whole run — keep
  // specs serial so they can't race each other on the same files.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  expect: {
    toHaveScreenshot: {
      // fontconfig/freetype text rasterization differs slightly between machines (e.g. a
      // dev's desktop Linux install vs. CI's bare ubuntu-latest runner) even with identical,
      // self-hosted font files — tolerate sub-1% glyph-edge noise, not real regressions.
      maxDiffPixelRatio: 0.02,
    },
  },
  use: {
    // The server webServer entry below spawns the embedded Caddy proxy itself (it's part of
    // apps/server's own startup, not a separate process here) — routing through it, rather
    // than straight to Vite, exercises the same dev-mode path split (/api/* vs everything
    // else) that a real `bun run dev` gets, instead of testing the pre-consolidation topology.
    baseURL: "http://localhost:8080",
    trace: "retain-on-failure",
  },
  projects: [
    // The two projects run against completely different DOMs (no spine/sidebar on mobile,
    // no recents-bar/switcher on desktop) — testIgnore keeps each spec set scoped to the
    // viewport it was actually written for. showcase/ is excluded outright: it asserts on a
    // real "Xms" health reading, which never arrives here since DISABLE_HEALTH_CHECKS is set
    // below — it only runs under playwright.showcase.config.ts (bun run docs:screenshots).
    {
      name: "chromium",
      testIgnore: /mobile\/|showcase\//,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile",
      testDir: "./e2e/mobile",
      // A Chromium-based phone preset, not an iOS one — `test:e2e:install` only fetches
      // the chromium browser, and this suite is testing responsive layout/JS, not
      // engine-specific rendering, so there's nothing WebKit-only to cover here.
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: [
    {
      command: serverCommand,
      cwd: serverDir,
      // Through Caddy, not straight to Bun — only succeeds once the embedded proxy has
      // also loaded its config and is actually routing, matching the Dockerfile's
      // HEALTHCHECK reasoning (health should reflect the real entrypoint).
      url: "http://localhost:8080/api/health",
      reuseExistingServer: false,
      env: {
        DATA_DIR: E2E_DATA_DIR,
        // See apps/server/src/index.ts — keeps every service's health/latency display
        // deterministic ("down") for both functional and visual specs.
        DISABLE_HEALTH_CHECKS: "1",
      },
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      command: "bun run dev",
      cwd: webDir,
      // Vite's own direct readiness — unrelated to Caddy, but Caddy's dev-mode catch-all
      // proxies to this port, so it still needs to be up.
      url: "http://localhost:5173",
      reuseExistingServer: false,
      stdout: "pipe",
      stderr: "pipe",
    },
  ],
});
