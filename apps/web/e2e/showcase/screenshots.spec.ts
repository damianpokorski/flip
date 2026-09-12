import { cpSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

// Regenerates the README's showcase images against realistic demo data. Unlike the visual
// regression suite, this run does NOT disable health checks (see playwright.showcase.config.ts)
// — the whole point is services showing a genuine, healthy "fast" status rather than the
// regression suite's deliberately permanent "down".
const API_BASE = "http://localhost:8080/api";
const OUTPUT_DIR = fileURLToPath(new URL("../../../../docs/screenshots/", import.meta.url));
// Must match playwright.showcase.config.ts's SHOWCASE_DATA_DIR — this spec runs as a local
// process alongside the already-started server, so it can seed disk content directly rather
// than through an API (there's no upload endpoint by design; local sites are volume-mounted).
const SHOWCASE_DATA_DIR = fileURLToPath(new URL("./.showcase-data/", import.meta.url));
const FIXTURES_DIR = fileURLToPath(new URL("./fixtures/", import.meta.url));

test("dashboard, HUD, and services list", async ({ page, request }) => {
  // Arrange: clear the bootstrap default ("Example service") and seed a small, realistic
  // demo fleet across two workspaces, matching the apps named in the README's own pitch.
  const existing = await request.get(`${API_BASE}/services`);
  for (const service of await existing.json()) {
    await request.delete(`${API_BASE}/services/${service.id}`);
  }

  const home = await request.post(`${API_BASE}/workspaces`, {
    data: { name: "Home", label: "HM" },
  });
  expect(home.ok()).toBeTruthy();
  const homeBody = await home.json();

  // Local sites are volume-mounted, not uploaded — seed the folder directly on disk before
  // creating the service that references it, same as an operator would.
  mkdirSync(`${SHOWCASE_DATA_DIR}sites/start`, { recursive: true });
  cpSync(`${FIXTURES_DIR}start/`, `${SHOWCASE_DATA_DIR}sites/start/`, {
    recursive: true,
  });

  const demoServices = [
    {
      name: "NAS",
      mark: "NA",
      hue: "sapphire",
      host: "nas.home.lan",
      url: "https://example.com",
      ws: "default",
    },
    {
      name: "Jellyfin",
      mark: "JF",
      hue: "peach",
      host: "jellyfin.home.lan",
      url: "https://example.org",
      ws: "default",
    },
    {
      name: "Pi-hole",
      mark: "PH",
      hue: "green",
      host: "pi.hole",
      url: "https://example.net",
      ws: homeBody.id,
    },
    {
      name: "Home Assistant",
      mark: "HA",
      hue: "teal",
      host: "ha.home.lan",
      url: "https://example.com",
      ws: homeBody.id,
    },
    {
      name: "Start",
      mark: "ST",
      hue: "blue",
      host: "start",
      url: "",
      source: "local",
      localSlug: "start",
      ws: homeBody.id,
    },
  ];
  const createdByName: Record<string, { id: string }> = {};
  for (const service of demoServices) {
    const created = await request.post(`${API_BASE}/services`, {
      data: service,
    });
    expect(created.ok()).toBeTruthy();
    createdByName[service.name] = await created.json();
  }

  // Act: load the dashboard and wait for the real health-check tick (every 5s server-side)
  // to report back over SSE, rather than the initial "down" state before the first check.
  await page.goto("/");
  await expect(page.getByTestId("sidebar-service-row")).toHaveCount(2);
  for (const row of await page.getByTestId("sidebar-service-row").all()) {
    await expect(row.getByText(/\d+ms/)).toBeVisible({ timeout: 10_000 });
  }

  // Switch to the Home workspace and open the locally-hosted "Start" page before capturing
  // dashboard.png — otherwise the default-active service is whatever's first in the default
  // workspace (NAS, whose demo url is the bare "Example Domain" placeholder), which makes
  // for a plain hero screenshot. This also doubles as the showcase for local site hosting.
  await page
    .locator(`[data-testid=spine-workspace-pill][data-workspace-id="${homeBody.id}"]`)
    .click();
  await expect(page.getByTestId("sidebar-service-row")).toHaveCount(3);
  for (const row of await page.getByTestId("sidebar-service-row").all()) {
    await expect(row.getByText(/\d+ms/)).toBeVisible({ timeout: 10_000 });
  }
  // biome-ignore lint/style/noNonNullAssertion: "Start" was just created above, above the loop
  const startId = createdByName.Start!.id;
  await page.locator(`[data-testid=sidebar-service-row][data-service-id="${startId}"]`).click();

  // Assert (loosely — this is a docs asset generator, not a regression check): capture each
  // view once its content is in the desired, settled state.
  // animations: "disabled" resolves CSS transitions (e.g. the HUD's fade-in) to their final
  // state before capturing — page.screenshot() defaults to "allow", unlike toHaveScreenshot().
  await page.screenshot({
    path: `${OUTPUT_DIR}dashboard.png`,
    animations: "disabled",
  });

  await page.keyboard.press("`");
  await expect(page.getByTestId("hud")).toBeVisible();
  await page.screenshot({
    path: `${OUTPUT_DIR}hud.png`,
    animations: "disabled",
  });
  await page.keyboard.press("`");

  await page.goto("/settings/services");
  await expect(page.getByTestId("service-row")).toHaveCount(5);
  for (const row of await page.getByTestId("service-row").all()) {
    await expect(row.getByText(/\d+ms/)).toBeVisible({ timeout: 10_000 });
  }
  await page.screenshot({
    path: `${OUTPUT_DIR}services.png`,
    animations: "disabled",
  });
});
