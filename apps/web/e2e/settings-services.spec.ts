import { expect, test } from "@playwright/test";

test.describe("Settings — service CRUD", () => {
	test("create, edit, and delete a service", async ({ page }) => {
		await page.goto("/settings/services");

		// Create
		await page.getByTestId("add-service-btn").click();
		await page.getByTestId("service-url-input").fill("https://example.com/e2e");
		await page.getByTestId("service-name-input").fill("E2E Test Service");
		// A workspace is required — the save button stays disabled until one is picked.
		await page.getByTestId("service-workspace-toggle").first().click();
		await page.getByTestId("service-save-btn").click();

		await page.waitForURL("**/settings/services");
		const row = page
			.getByTestId("service-row")
			.filter({ hasText: "E2E Test Service" });
		await expect(row).toBeVisible();

		// Edit — verify persistence after reload, not just in-memory state
		await row.getByTestId("service-menu-toggle").click();
		await row.getByTestId("edit-service-btn").click();
		await page.waitForURL(/\/settings\/services\/[^/]+$/);
		await page
			.getByTestId("service-name-input")
			.fill("E2E Test Service (edited)");
		await page.getByTestId("service-save-btn").click();

		await page.waitForURL("**/settings/services");
		await page.reload();
		const editedRow = page
			.getByTestId("service-row")
			.filter({ hasText: "E2E Test Service (edited)" });
		await expect(editedRow).toBeVisible();

		// Delete
		page.once("dialog", (dialog) => dialog.accept());
		await editedRow.getByTestId("service-menu-toggle").click();
		await editedRow.getByTestId("delete-service-btn").click();
		await expect(
			page.getByTestId("service-row").filter({ hasText: "E2E Test Service" }),
		).toHaveCount(0);
	});
});
