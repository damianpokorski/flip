import { expect, test } from "@playwright/test";

// Through Caddy (see playwright.config.ts), not straight to Bun's own port.
const API_BASE = "http://localhost:8080/api";

test.describe("Visual — mobile shell", () => {
  test("switcher grid", async ({ page, request }) => {
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
      await page.goto("/");
      await expect(page.getByTestId("service-iframe").first()).toBeVisible();

      await page.getByLabel("Open switcher").click();
      await expect(page.getByTestId("mobile-switcher")).toBeVisible();

      await expect(page).toHaveScreenshot("mobile-switcher.png");
    } finally {
      await request.delete(`${API_BASE}/services/${body.id}`);
    }
  });

  test("settings entry list", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByText("Services", { exact: true })).toBeVisible();

    await expect(page).toHaveScreenshot("mobile-settings-list.png");
  });
});
