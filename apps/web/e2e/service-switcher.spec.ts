import { expect, test } from "@playwright/test";

// Through Caddy (see playwright.config.ts), not straight to Bun's own port.
const API_BASE = "http://localhost:8080/api";

test.describe("Service switcher — instant, no-reload toggling", () => {
	test("switching services within a workspace toggles visibility without unmounting either iframe", async ({
		page,
		request,
	}) => {
		await page.goto("/");
		// page.goto() only waits for the load event, not client-side hydration — wait for the
		// initial data fetch to render before snapshotting a baseline count, or rowsBefore can
		// race to 0 instead of the true pre-hydration baseline (see hud.spec.ts for the same guard).
		await expect(page.getByTestId("sidebar-service-row").first()).toBeVisible();
		const rowsBefore = await page.getByTestId("sidebar-service-row").count();
		const iframesBefore = await page.getByTestId("service-iframe").count();

		// Arrange: seed a second service in the default workspace.
		const created = await request.post(`${API_BASE}/services`, {
			data: {
				name: "Second Service",
				mark: "SC",
				hue: "green",
				host: "example.org",
				url: "https://example.org",
				ws: "default",
			},
		});
		expect(created.ok()).toBeTruthy();
		const body = await created.json();

		try {
			await page.reload();
			await expect(page.getByTestId("sidebar-service-row")).toHaveCount(
				rowsBefore + 1,
			);

			const iframes = page.getByTestId("service-iframe");
			await expect(iframes).toHaveCount(iframesBefore + 1);

			const secondRow = page
				.getByTestId("sidebar-service-row")
				.filter({ hasText: "Second Service" });

			// Act
			await secondRow.click();

			// Assert: both iframes remain mounted; only the active one is visually on top.
			const activeFrame = page.locator(
				`[data-testid="service-iframe"][data-service-id="${body.id}"]`,
			);
			await expect(activeFrame).toHaveClass(/active/);
			await expect(iframes).toHaveCount(iframesBefore + 1);
		} finally {
			await request.delete(`${API_BASE}/services/${body.id}`);
		}
	});

	test("switching workspaces via the spine never unmounts another workspace's iframe", async ({
		page,
		request,
	}) => {
		// Arrange: a second workspace with its own service.
		const workspace = await request.post(`${API_BASE}/workspaces`, {
			data: { name: "Ops", label: "OP" },
		});
		expect(workspace.ok()).toBeTruthy();
		const workspaceBody = await workspace.json();

		const service = await request.post(`${API_BASE}/services`, {
			data: {
				name: "Ops Service",
				mark: "OP",
				hue: "peach",
				host: "example.net",
				url: "https://example.net",
				ws: workspaceBody.id,
			},
		});
		expect(service.ok()).toBeTruthy();
		const serviceBody = await service.json();

		try {
			await page.goto("/");
			// Every non-hidden, embeddable service is mounted up front regardless of which
			// workspace is active — the Ops Service's iframe already exists before we ever
			// switch to its workspace.
			const opsFrame = page.locator(
				`[data-testid="service-iframe"][data-service-id="${serviceBody.id}"]`,
			);
			await expect(opsFrame).toHaveCount(1);
			const iframeCountBefore = await page
				.getByTestId("service-iframe")
				.count();

			// Act: switch to the new workspace via its spine pill.
			await page
				.locator(
					`[data-testid="spine-workspace-pill"][data-workspace-id="${workspaceBody.id}"]`,
				)
				.click();

			// Assert: switching workspaces never mounts/unmounts any iframe — the Ops Service's
			// iframe was already there and simply becomes the active one.
			await expect(page.getByTestId("service-iframe")).toHaveCount(
				iframeCountBefore,
			);
			await expect(opsFrame).toHaveClass(/active/);
			await expect(
				page
					.getByTestId("sidebar-service-row")
					.filter({ hasText: "Ops Service" }),
			).toBeVisible();
		} finally {
			await request.delete(`${API_BASE}/services/${serviceBody.id}`);
			await request.delete(`${API_BASE}/workspaces/${workspaceBody.id}`);
		}
	});

	test("opening a service updates the URL, and reloading with that URL reopens it", async ({
		page,
		request,
	}) => {
		// Arrange: seed a second service in the default workspace.
		const created = await request.post(`${API_BASE}/services`, {
			data: {
				name: "Bookmarkable Service",
				mark: "BM",
				hue: "teal",
				host: "example.com",
				url: "https://example.com",
				ws: "default",
			},
		});
		expect(created.ok()).toBeTruthy();
		const body = await created.json();

		try {
			await page.goto("/");
			await page.reload();

			// Act: open it via the sidebar.
			await page
				.getByTestId("sidebar-service-row")
				.filter({ hasText: "Bookmarkable Service" })
				.click();

			// Assert: the address bar reflects the open service without a navigation/reload.
			await expect(page).toHaveURL(/service=Bookmarkable(\+|%20)Service/);
			const bookmarkedUrl = page.url();

			// Act: simulate opening the bookmarked URL in a fresh load.
			await page.goto(bookmarkedUrl);

			// Assert: the same service is active again.
			const activeFrame = page.locator(
				`[data-testid="service-iframe"][data-service-id="${body.id}"]`,
			);
			await expect(activeFrame).toHaveClass(/active/);
		} finally {
			await request.delete(`${API_BASE}/services/${body.id}`);
		}
	});
});
