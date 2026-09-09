import { expect, test } from "@playwright/test";

// Through Caddy (see playwright.config.ts), not straight to Bun's own port.
const API_BASE = "http://localhost:8080/api";

test.describe("Visual — settings pages", () => {
  test("services list", async ({ page, request }) => {
    const created = await request.post(`${API_BASE}/services`, {
      data: {
        name: "Docs",
        mark: "DC",
        hue: "teal",
        host: "example.org",
        url: "https://example.org",
        ws: "default",
      },
    });
    expect(created.ok()).toBeTruthy();
    const body = await created.json();

    try {
      await page.goto("/settings/services");
      await expect(page.getByTestId("service-row").filter({ hasText: "Docs" })).toBeVisible();

      await expect(page).toHaveScreenshot("settings-services-list.png");
    } finally {
      await request.delete(`${API_BASE}/services/${body.id}`);
    }
  });

  test("workspaces board", async ({ page, request }) => {
    const workspace = await request.post(`${API_BASE}/workspaces`, {
      data: { name: "Archive", label: "AR" },
    });
    expect(workspace.ok()).toBeTruthy();
    const workspaceBody = await workspace.json();

    const service = await request.post(`${API_BASE}/services`, {
      data: {
        name: "Docs",
        mark: "DC",
        hue: "teal",
        host: "example.org",
        url: "https://example.org",
        ws: "default",
      },
    });
    expect(service.ok()).toBeTruthy();
    const serviceBody = await service.json();

    try {
      await page.goto("/settings/workspaces");
      await expect(page.getByTestId("workspace-card").filter({ hasText: "Docs" })).toBeVisible();

      await expect(page).toHaveScreenshot("settings-workspaces-board.png");
    } finally {
      await request.delete(`${API_BASE}/services/${serviceBody.id}`);
      await request.delete(`${API_BASE}/workspaces/${workspaceBody.id}`);
    }
  });

  test("add-service form", async ({ page }) => {
    await page.goto("/settings/services/add");
    await expect(page.getByTestId("service-url-input")).toBeVisible();

    await expect(page).toHaveScreenshot("settings-service-add.png");
  });

  test("edit-service form", async ({ page, request }) => {
    const created = await request.post(`${API_BASE}/services`, {
      data: {
        name: "Docs",
        mark: "DC",
        hue: "teal",
        host: "example.org",
        url: "https://example.org",
        ws: "default",
      },
    });
    expect(created.ok()).toBeTruthy();
    const body = await created.json();

    try {
      await page.goto(`/settings/services/${body.id}`);
      // The edit form loads its fields async (onMount) — wait for real data, not the
      // pre-load empty state, before screenshotting.
      await expect(page.getByTestId("service-name-input")).toHaveValue("Docs");

      await expect(page).toHaveScreenshot("settings-service-edit.png");
    } finally {
      await request.delete(`${API_BASE}/services/${body.id}`);
    }
  });

  test("config view", async ({ page }) => {
    await page.goto("/settings/config");
    // Files load async (onMount) — wait for real YAML content, not the "loading…" state.
    await expect(page.locator(".line-num").first()).toBeVisible();

    // Each file section's "saved Xm ago" text is derived from the YAML's real mtime and
    // drifts across minute boundaries between runs. Masking just that span isn't enough —
    // the header row is a flex layout with a flex:1 spacer ahead of it, so a differently
    // sized timestamp still shifts the trailing Copy button. Mask the whole header row
    // instead: its own box is full-width regardless of the text inside it.
    await expect(page).toHaveScreenshot("settings-config.png", {
      mask: [page.locator(".section-head")],
    });
  });

  test("shortcuts list", async ({ page }) => {
    await page.goto("/settings/shortcuts");
    await expect(page.locator(".shortcuts-page")).toBeVisible();

    await expect(page).toHaveScreenshot("settings-shortcuts.png");
  });
});
