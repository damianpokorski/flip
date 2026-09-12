import { expect, test } from "@playwright/test";

// Through Caddy (see playwright.config.ts), not straight to Bun's own port.
const API_BASE = "http://localhost:8080/api";

test.describe("Mobile shell — Rest / Switcher / Settings", () => {
	test("opening a service from the switcher grid activates it, closes the sheet, and surfaces it in the recents bar", async ({
		page,
		request,
	}) => {
		// Arrange: a distinctively-named second service to pick from the switcher grid.
		const created = await request.post(`${API_BASE}/services`, {
			data: {
				name: "Mobile Zephyr",
				mark: "MZ",
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
			await expect(page.getByTestId("service-iframe").first()).toBeVisible();

			// Act: raise the switcher (the recents bar's grid button) and pick the seeded service.
			await page.getByLabel("Open switcher").click();
			await expect(page.getByTestId("mobile-switcher")).toBeVisible();

			const card = page
				.getByTestId("mobile-switcher-card")
				.filter({ hasText: "Mobile Zephyr" });
			await expect(card).toBeVisible();
			await card.click();

			// Assert: the sheet closes, the picked service's iframe is active, and it now shows up
			// in the recents bar (session-only recency tracking, see app-state.svelte.ts).
			await expect(page.getByTestId("mobile-switcher")).toHaveCount(0);
			await expect(
				page.locator(
					`[data-testid="service-iframe"][data-service-id="${body.id}"]`,
				),
			).toHaveClass(/active/);
			await expect(
				page.locator(
					`[data-testid="recents-tile"][data-service-id="${body.id}"]`,
				),
			).toBeVisible();
		} finally {
			await request.delete(`${API_BASE}/services/${body.id}`);
		}
	});

	test("tapping the scrim dismisses the switcher without picking a service", async ({
		page,
	}) => {
		await page.goto("/");
		const activeFrame = page.locator('[data-testid="service-iframe"].active');
		await expect(activeFrame).toBeVisible();
		const activeId = await activeFrame.getAttribute("data-service-id");

		// Act: open the switcher, then tap the dimmed area above the sheet (not the sheet itself).
		await page.getByLabel("Open switcher").click();
		await expect(page.getByTestId("mobile-switcher")).toBeVisible();
		await page
			.getByTestId("switcher-scrim")
			.click({ position: { x: 20, y: 20 } });

		// Assert: dismissed, and the previously-active service is untouched.
		await expect(page.getByTestId("mobile-switcher")).toHaveCount(0);
		await expect(
			page.locator(
				`[data-testid="service-iframe"][data-service-id="${activeId}"]`,
			),
		).toHaveClass(/active/);
	});

	test("mobile settings: the entry list routes into the real settings pages, and back returns to the shell", async ({
		page,
	}) => {
		await page.goto("/");
		await expect(page.getByTestId("service-iframe").first()).toBeVisible();

		// Act: reach Settings via the switcher sheet's footer link.
		await page.getByLabel("Open switcher").click();
		await page.getByRole("link", { name: "Settings" }).click();

		// Assert: the 3-row entry list (Services / Workspaces / Config — Shortcuts is dropped,
		// Health checks/Embedding were never their own pages).
		await expect(page).toHaveURL(/\/settings$/);
		await expect(page.getByText("Services", { exact: true })).toBeVisible();
		await expect(page.getByText("Workspaces", { exact: true })).toBeVisible();
		await expect(
			page.getByText("Config as code", { exact: true }),
		).toBeVisible();

		// Act: a row pushes the same route desktop uses.
		await page.getByText("Services", { exact: true }).click();
		await expect(page).toHaveURL(/\/settings\/services$/);

		// Act: back from the entry list returns to the shell.
		await page.goto("/settings");
		await page.getByLabel("Back").click();
		await expect(page).toHaveURL(/\/$/);
	});
});
