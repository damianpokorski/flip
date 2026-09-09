import { expect, test } from "@playwright/test";

// Through Caddy (see playwright.config.ts), not straight to Bun's own port.
const API_BASE = "http://localhost:8080/api";

test.describe("Visual — dashboard shell and HUD", () => {
  test("dashboard shell", async ({ page, request }) => {
    // Arrange: a second workspace with its own service, so the spine/sidebar aren't
    // showing only the single default seed service.
    const workspace = await request.post(`${API_BASE}/workspaces`, {
      data: { name: "Ops", label: "OP" },
    });
    expect(workspace.ok()).toBeTruthy();
    const workspaceBody = await workspace.json();

    const docs = await request.post(`${API_BASE}/services`, {
      data: {
        name: "Docs",
        mark: "DC",
        hue: "teal",
        host: "example.org",
        url: "https://example.org",
        ws: "default",
      },
    });
    expect(docs.ok()).toBeTruthy();
    const docsBody = await docs.json();

    const metrics = await request.post(`${API_BASE}/services`, {
      data: {
        name: "Metrics",
        mark: "MT",
        hue: "peach",
        host: "example.net",
        url: "https://example.net",
        ws: workspaceBody.id,
      },
    });
    expect(metrics.ok()).toBeTruthy();
    const metricsBody = await metrics.json();

    try {
      await page.goto("/");
      // page.goto() only waits for the load event, not client-side hydration.
      await expect(page.getByTestId("sidebar-service-row").first()).toBeVisible();

      await expect(page).toHaveScreenshot("dashboard-shell.png");
    } finally {
      await request.delete(`${API_BASE}/services/${docsBody.id}`);
      await request.delete(`${API_BASE}/services/${metricsBody.id}`);
      await request.delete(`${API_BASE}/workspaces/${workspaceBody.id}`);
    }
  });

  test("HUD overlay", async ({ page, request }) => {
    // Arrange: a second service so the HUD's tile grid isn't a single-item list.
    const created = await request.post(`${API_BASE}/services`, {
      data: {
        name: "Zephyr Dashboard",
        mark: "ZD",
        hue: "lavender",
        host: "zephyr.example.com",
        url: "https://example.com",
        ws: "default",
      },
    });
    expect(created.ok()).toBeTruthy();
    const body = await created.json();

    try {
      await page.goto("/");
      await expect(page.getByTestId("sidebar-service-row").first()).toBeVisible();

      await page.keyboard.press("`");
      await expect(page.getByTestId("hud")).toBeVisible();

      await expect(page).toHaveScreenshot("hud-overlay.png");
    } finally {
      await request.delete(`${API_BASE}/services/${body.id}`);
    }
  });
});
