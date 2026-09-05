import { expect, test } from "@playwright/test";

test.describe("Panel switcher — instant, no-reload toggling", () => {
	test("switching panels toggles visibility without unmounting either iframe", async ({
		page,
		request,
	}) => {
		// Arrange: seed a second panel via the API so there's something to switch between
		// (the default seed data ships with exactly one).
		const created = await request.post("http://localhost:3000/api/panels", {
			data: { title: "Second Panel", url: "https://example.org" },
		});
		expect(created.ok()).toBeTruthy();

		await page.goto("/");
		await expect(page.getByTestId("panel-tab")).toHaveCount(2);

		const iframes = page.getByTestId("panel-iframe");
		await expect(iframes).toHaveCount(2);

		const secondTab = page
			.getByTestId("panel-tab")
			.filter({ hasText: "Second Panel" });
		const panelId = await secondTab.getAttribute("data-panel-id");

		// Act
		await secondTab.click();

		// Assert: the switch is a pure visibility toggle — both iframes are still mounted
		// (never remounted/reloaded), only the active one is marked as such.
		await expect(secondTab).toHaveClass(/active/);
		const activeFrame = page.locator(
			`[data-testid="panel-iframe"][data-panel-id="${panelId}"]`,
		);
		await expect(activeFrame).toHaveClass(/active/);
		await expect(iframes).toHaveCount(2);
	});
});
