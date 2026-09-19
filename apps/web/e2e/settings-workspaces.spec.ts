import { expect, test } from "@playwright/test";

// Through Caddy (see playwright.config.ts), not straight to Bun's own port.
const API_BASE = "http://localhost:8080/api";

test.describe("Settings — workspaces board drag-and-drop", () => {
	test("dragging a service card into another column reassigns its workspace", async ({
		page,
		request,
	}) => {
		// Arrange: a second workspace and a service seeded into the default one.
		const workspace = await request.post(`${API_BASE}/workspaces`, {
			data: { name: "Archive", label: "AR" },
		});
		expect(workspace.ok()).toBeTruthy();
		const workspaceBody = await workspace.json();

		const service = await request.post(`${API_BASE}/services`, {
			data: {
				name: "Draggable Service",
				mark: "DR",
				hue: "teal",
				host: "example.io",
				url: "https://example.io",
				ws: "default",
			},
		});
		expect(service.ok()).toBeTruthy();
		const serviceBody = await service.json();

		try {
			await page.goto("/settings/workspaces");
			const card = page.getByTestId("workspace-card").filter({
				hasText: "Draggable Service",
			});
			await expect(card).toBeVisible();

			const destinationZone = page.locator(
				`[data-testid="workspace-column"][data-workspace-id="${workspaceBody.id}"]`,
			);

			const sourceBox = await card.boundingBox();
			const destBox = await destinationZone.boundingBox();
			if (!sourceBox || !destBox) throw new Error("missing bounding box");

			// Act: a manual pointer-drag sequence — svelte-dnd-action drives dragging via
			// mouse events on the item itself, not native HTML5 DnD, so Playwright's
			// dragTo() (which dispatches native dragstart/drop events) doesn't trigger it.
			await page.mouse.move(
				sourceBox.x + sourceBox.width / 2,
				sourceBox.y + sourceBox.height / 2,
			);
			await page.mouse.down();
			await page.mouse.move(
				destBox.x + destBox.width / 2,
				destBox.y + destBox.height / 2,
				{ steps: 10 },
			);
			await page.mouse.move(
				destBox.x + destBox.width / 2,
				destBox.y + destBox.height / 2 + 1,
				{ steps: 2 },
			);
			await page.mouse.up();

			// Assert: the card visually landed in the destination column...
			await expect(
				destinationZone.getByTestId("workspace-card").filter({
					hasText: "Draggable Service",
				}),
			).toBeVisible();

			// ...and the drag actually persisted server-side (the real regression check).
			await expect(async () => {
				const res = await request.get(`${API_BASE}/services/${serviceBody.id}`);
				const body = await res.json();
				expect(body.ws).toBe(workspaceBody.id);
			}).toPass();
		} finally {
			await request.delete(`${API_BASE}/services/${serviceBody.id}`);
			await request.delete(`${API_BASE}/workspaces/${workspaceBody.id}`);
		}
	});

	test("dragging a service card within its column reorders it, without changing its workspace", async ({
		page,
		request,
	}) => {
		// Arrange: two services seeded into the same (default) workspace, back to back.
		const first = await request.post(`${API_BASE}/services`, {
			data: {
				name: "Reorder First",
				mark: "R1",
				hue: "teal",
				host: "reorder-first.io",
				url: "https://reorder-first.io",
				ws: "default",
			},
		});
		expect(first.ok()).toBeTruthy();
		const firstBody = await first.json();

		const second = await request.post(`${API_BASE}/services`, {
			data: {
				name: "Reorder Second",
				mark: "R2",
				hue: "teal",
				host: "reorder-second.io",
				url: "https://reorder-second.io",
				ws: "default",
			},
		});
		expect(second.ok()).toBeTruthy();
		const secondBody = await second.json();

		try {
			await page.goto("/settings/workspaces");
			const firstCard = page.locator(
				`[data-testid="workspace-card"][data-service-id="${firstBody.id}"]`,
			);
			const secondCard = page.locator(
				`[data-testid="workspace-card"][data-service-id="${secondBody.id}"]`,
			);
			await expect(firstCard).toBeVisible();
			await expect(secondCard).toBeVisible();

			// Act: drag the card seeded second up above the one seeded first.
			const sourceBox = await secondCard.boundingBox();
			const destBox = await firstCard.boundingBox();
			if (!sourceBox || !destBox) throw new Error("missing bounding box");

			await page.mouse.move(
				sourceBox.x + sourceBox.width / 2,
				sourceBox.y + sourceBox.height / 2,
			);
			await page.mouse.down();
			await page.mouse.move(destBox.x + destBox.width / 2, destBox.y + 2, {
				steps: 10,
			});
			await page.mouse.move(destBox.x + destBox.width / 2, destBox.y + 1, {
				steps: 2,
			});
			await page.mouse.up();

			// Assert: the reorder persisted server-side — the second-seeded service now sorts
			// before the first-seeded one — and neither service's workspace changed.
			await expect(async () => {
				const res = await request.get(`${API_BASE}/services`);
				const services = (await res.json()) as { id: string; ws: string }[];
				const firstIndex = services.findIndex((s) => s.id === firstBody.id);
				const secondIndex = services.findIndex((s) => s.id === secondBody.id);
				expect(secondIndex).toBeLessThan(firstIndex);
			}).toPass();

			const firstAfter = await request.get(
				`${API_BASE}/services/${firstBody.id}`,
			);
			expect((await firstAfter.json()).ws).toBe("default");
			const secondAfter = await request.get(
				`${API_BASE}/services/${secondBody.id}`,
			);
			expect((await secondAfter.json()).ws).toBe("default");
		} finally {
			await request.delete(`${API_BASE}/services/${firstBody.id}`);
			await request.delete(`${API_BASE}/services/${secondBody.id}`);
		}
	});
});
