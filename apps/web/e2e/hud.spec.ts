import { expect, test } from "@playwright/test";

// Through Caddy (see playwright.config.ts), not straight to Bun's own port.
const API_BASE = "http://localhost:8080/api";

test.describe("HUD — backtick-toggle command palette", () => {
	test("press to raise, type to filter, enter to open, and it never opens while typing in a form field", async ({
		page,
		request,
	}) => {
		// Arrange: a distinctively-named second service to search for.
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
			// Wait for the SPA to hydrate before dispatching keyboard events — a bare
			// page.goto() only waits for the load event, not client-side hydration.
			await expect(
				page.getByTestId("sidebar-service-row").first(),
			).toBeVisible();
			await expect(page.getByTestId("hud")).toHaveCount(0);

			// Act: press backtick to raise the HUD.
			await page.keyboard.press("`");
			await expect(page.getByTestId("hud")).toBeVisible();

			// Type to filter across all services.
			await page.keyboard.press("Z");
			await page.keyboard.press("e");
			await page.keyboard.press("p");
			const tile = page
				.getByTestId("hud-tile")
				.filter({ hasText: "Zephyr Dashboard" });
			await expect(tile).toBeVisible();

			// Open the highlighted result.
			await page.keyboard.press("Enter");
			await expect(page.getByTestId("hud")).toHaveCount(0);

			// Assert: the picked service is now active in the Frame.
			await expect(
				page.locator(
					`[data-testid="service-iframe"][data-service-id="${body.id}"]`,
				),
			).toHaveClass(/active/);
		} finally {
			await request.delete(`${API_BASE}/services/${body.id}`);
		}
	});

	test("does not raise the HUD while typing a literal backtick into a form field", async ({
		page,
	}) => {
		await page.goto("/settings/services/add");
		await page.getByTestId("service-url-input").click();
		await page.keyboard.press("`");
		await expect(page.getByTestId("hud")).toHaveCount(0);
	});

	test("pressing backtick again closes the HUD", async ({ page }) => {
		await page.goto("/");
		await expect(page.getByTestId("sidebar-service-row").first()).toBeVisible();

		await page.keyboard.press("`");
		await expect(page.getByTestId("hud")).toBeVisible();

		await page.keyboard.press("`");
		await expect(page.getByTestId("hud")).toHaveCount(0);
	});

	test("holding backtick and pressing its pinned digit jumps straight to that service", async ({
		page,
		request,
	}) => {
		// Arrange: a distinctively-named service pinned to digit 5.
		const created = await request.post(`${API_BASE}/services`, {
			data: {
				name: "Pinboard",
				mark: "PB",
				hue: "lavender",
				host: "pinboard.example.com",
				url: "https://example.com",
				ws: "default",
				pin: "5",
			},
		});
		expect(created.ok()).toBeTruthy();
		const body = await created.json();

		try {
			await page.goto("/");
			await expect(
				page.getByTestId("sidebar-service-row").first(),
			).toBeVisible();

			// Act: hold ` down, tap the pinned digit while it's still held, then release `.
			await page.keyboard.down("`");
			await page.keyboard.press("5");
			await page.keyboard.up("`");

			// Assert: the HUD never stays open on a stray "5" in the query, and the pinned
			// service is now active in the Frame.
			await expect(page.getByTestId("hud")).toHaveCount(0);
			await expect(
				page.locator(
					`[data-testid="service-iframe"][data-service-id="${body.id}"]`,
				),
			).toHaveClass(/active/);
		} finally {
			await request.delete(`${API_BASE}/services/${body.id}`);
		}
	});
});
