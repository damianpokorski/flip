import { expect, test } from "@playwright/test";

test.describe("Settings — panel CRUD", () => {
	test("create, edit, and delete a panel", async ({ page }) => {
		await page.goto("/settings");

		// Create
		await page.getByTestId("add-panel-btn").click();
		await page.getByTestId("panel-title-input").fill("E2E Test Panel");
		await page.getByTestId("panel-url-input").fill("https://example.com/e2e");
		await page.getByTestId("panel-save-btn").click();

		const row = page
			.getByTestId("panel-row")
			.filter({ hasText: "E2E Test Panel" });
		await expect(row).toBeVisible();
		await expect(row.locator(".panel-meta")).toHaveText(
			"https://example.com/e2e",
		);

		// Edit — verify persistence after reload, not just in-memory state
		await row.getByTestId("edit-panel-btn").click();
		await page.getByTestId("panel-title-input").fill("E2E Test Panel (edited)");
		await page.getByTestId("panel-save-btn").click();

		await page.reload();
		const editedRow = page
			.getByTestId("panel-row")
			.filter({ hasText: "E2E Test Panel (edited)" });
		await expect(editedRow).toBeVisible();

		// Delete
		page.once("dialog", (dialog) => dialog.accept());
		await editedRow.getByTestId("delete-panel-btn").click();
		await expect(
			page.getByTestId("panel-row").filter({ hasText: "E2E Test Panel" }),
		).toHaveCount(0);
	});
});
