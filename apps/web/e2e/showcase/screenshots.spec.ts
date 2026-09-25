import { cpSync, mkdirSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";
import { devices, expect, test } from "@playwright/test";

// Regenerates the showcase images used by the README and the docs site (apps/docs) against
// realistic demo data. Unlike the visual regression suite, this run does NOT disable health
// checks (see playwright.showcase.config.ts) — the whole point is services showing a genuine
// health status rather than the regression suite's deliberately permanent "down".
//
// The tests share one seeded data directory and run in order: the first one seeds the demo
// fleet, the rest only read it (and the last ones add to it), so they must stay serial.
const API_BASE = "http://localhost:8080/api";
const OUTPUT_DIR = fileURLToPath(
	new URL("../../../docs/src/assets/screenshots/", import.meta.url),
);
// Must match playwright.showcase.config.ts's SHOWCASE_DATA_DIR — this spec runs as a local
// process alongside the already-started server, so it can seed disk content directly rather
// than through an API (there's no upload endpoint by design; local sites are volume-mounted).
const SHOWCASE_DATA_DIR = fileURLToPath(
	new URL("./.showcase-data/", import.meta.url),
);
const FIXTURES_DIR = fileURLToPath(new URL("./fixtures/", import.meta.url));

// The Pixel 7 preset pins a browser type, which Playwright rejects inside a describe block —
// the project's browser is already Chromium, so it's dropped here.
const { defaultBrowserType: _browserType, ...pixel7 } = devices["Pixel 7"];

// animations: "disabled" resolves CSS transitions (e.g. the HUD's fade-in) to their final
// state before capturing — page.screenshot() defaults to "allow", unlike toHaveScreenshot().
const SHOT = { animations: "disabled" } as const;

test.describe.configure({ mode: "serial" });

let homeWs: string;
let startId: string;
let jellyfinId: string;

test("seed the demo fleet", async ({ request }) => {
	// Arrange: clear the bootstrap default ("Example service") and seed a small, realistic
	// demo fleet across two workspaces, matching the apps named in the README's own pitch.
	mkdirSync(OUTPUT_DIR, { recursive: true });
	const existing = await request.get(`${API_BASE}/services`);
	for (const service of await existing.json()) {
		await request.delete(`${API_BASE}/services/${service.id}`);
	}

	const home = await request.post(`${API_BASE}/workspaces`, {
		data: { name: "Home", label: "HM" },
	});
	expect(home.ok()).toBeTruthy();
	homeWs = (await home.json()).id;

	// Local sites are volume-mounted, not uploaded — seed the folder directly on disk before
	// creating the service that references it, same as an operator would.
	mkdirSync(`${SHOWCASE_DATA_DIR}sites/start`, { recursive: true });
	cpSync(`${FIXTURES_DIR}start/`, `${SHOWCASE_DATA_DIR}sites/start/`, {
		recursive: true,
	});

	const demoServices = [
		{
			name: "NAS",
			mark: "NA",
			hue: "sapphire",
			host: "nas.home.lan",
			url: "https://example.com",
			ws: "default",
		},
		{
			name: "Jellyfin",
			mark: "JF",
			hue: "peach",
			host: "jellyfin.home.lan",
			url: "https://example.org",
			ws: "default",
			pin: "1",
		},
		{
			name: "Pi-hole",
			mark: "PH",
			hue: "green",
			host: "pi.hole",
			url: "https://example.net",
			ws: homeWs,
		},
		{
			name: "Home Assistant",
			mark: "HA",
			hue: "teal",
			host: "ha.home.lan",
			url: "https://example.com",
			ws: homeWs,
		},
		{
			name: "Start",
			mark: "ST",
			hue: "blue",
			host: "start",
			url: "",
			source: "local",
			localSlug: "start",
			ws: homeWs,
		},
	];
	for (const service of demoServices) {
		const created = await request.post(`${API_BASE}/services`, {
			data: service,
		});
		expect(created.ok()).toBeTruthy();
		const body = await created.json();
		if (service.name === "Start") startId = body.id;
		if (service.name === "Jellyfin") jellyfinId = body.id;
	}
});

test("dashboard and HUD", async ({ page }) => {
	// Act: load the dashboard and wait for the real health-check tick (every 5s server-side)
	// to report back over SSE, rather than the initial "down" state before the first check.
	await page.goto("/");
	await expect(page.getByTestId("sidebar-service-row")).toHaveCount(2);
	for (const row of await page.getByTestId("sidebar-service-row").all()) {
		await expect(row.getByText(/\d+ms/)).toBeVisible({ timeout: 10_000 });
	}

	// Switch to the Home workspace and open the locally-hosted "Start" page before capturing
	// dashboard.png — otherwise the default-active service is whatever's first in the default
	// workspace (NAS, whose demo url is the bare "Example Domain" placeholder), which makes
	// for a plain hero screenshot. This also doubles as the showcase for local site hosting.
	await page
		.locator(
			`[data-testid=spine-workspace-pill][data-workspace-id="${homeWs}"]`,
		)
		.click();
	await expect(page.getByTestId("sidebar-service-row")).toHaveCount(3);
	for (const row of await page.getByTestId("sidebar-service-row").all()) {
		await expect(row.getByText(/\d+ms/)).toBeVisible({ timeout: 10_000 });
	}
	await page
		.locator(`[data-testid=sidebar-service-row][data-service-id="${startId}"]`)
		.click();

	// Assert (loosely — this is a docs asset generator, not a regression check): capture each
	// view once its content is in the desired, settled state.
	await page.screenshot({ path: `${OUTPUT_DIR}dashboard.png`, ...SHOT });

	await page.keyboard.press("`");
	await expect(page.getByTestId("hud")).toBeVisible();
	await page.screenshot({ path: `${OUTPUT_DIR}hud.png`, ...SHOT });

	// A typed query narrows the grid across every workspace, not just the current one, so the
	// shot is cropped to the search bar and the few tiles that survive the filter.
	await page.keyboard.type("ho");
	await expect(page.getByTestId("hud-tile").first()).toBeVisible();
	await page.screenshot({
		path: `${OUTPUT_DIR}hud-filtered.png`,
		clip: { x: 160, y: 30, width: 960, height: 220 },
		...SHOT,
	});
	await page.keyboard.press("`");
});

test("settings: services, edit form, config, shortcuts", async ({ page }) => {
	await page.goto("/settings/services");
	await expect(page.getByTestId("service-row")).toHaveCount(5);
	for (const row of await page.getByTestId("service-row").all()) {
		await expect(row.getByText(/\d+ms/)).toBeVisible({ timeout: 10_000 });
	}
	await page.screenshot({ path: `${OUTPUT_DIR}services.png`, ...SHOT });

	// The local-folder service shows the "serve a local folder" toggle and site picker; the
	// external one shows the header-stripping proxy toggle (only offered because the showcase
	// server runs with PROXY_DOMAIN set — see playwright.showcase.config.ts).
	await page.goto(`/settings/services/${startId}`);
	await expect(page.getByTestId("service-site-toggle")).toBeVisible();
	await page.screenshot({
		path: `${OUTPUT_DIR}service-edit-local.png`,
		...SHOT,
	});

	await page.goto(`/settings/services/${jellyfinId}`);
	await expect(
		page.getByText("Route through FLIP's header-stripping proxy"),
	).toBeVisible();
	await page.screenshot({
		path: `${OUTPUT_DIR}service-edit-proxy.png`,
		...SHOT,
	});

	await page.goto("/settings/config");
	// Scroll the viewer down to the actual data: the file opens on its long comment header,
	// which makes for a dull screenshot.
	const workspaces = page.getByText("workspaces:", { exact: true }).last();
	await workspaces.evaluate((el) => el.scrollIntoView({ block: "start" }));
	await page.screenshot({ path: `${OUTPUT_DIR}settings-config.png`, ...SHOT });

	await page.goto("/settings/shortcuts");
	await expect(page.getByText("Raise the HUD")).toBeVisible();
	await page.screenshot({
		path: `${OUTPUT_DIR}settings-shortcuts.png`,
		...SHOT,
	});
});

test("workspace board mid-drag", async ({ page }) => {
	await page.goto("/settings/workspaces");
	const cards = page.getByTestId("workspace-card");
	await expect(cards).toHaveCount(5);
	const source = await cards.filter({ hasText: "Jellyfin" }).boundingBox();
	const target = await page
		.getByTestId("workspace-column")
		.last()
		.boundingBox();
	if (!source || !target) throw new Error("missing bounding box");

	// svelte-dnd-action listens for pointer/mouse events, not native HTML5 drag events, so the
	// gesture is driven by hand — and deliberately left held (no mouse.up) so the screenshot
	// catches the mauve drag state rather than a settled board.
	await page.mouse.move(
		source.x + source.width / 2,
		source.y + source.height / 2,
	);
	await page.mouse.down();
	await page.mouse.move(target.x + target.width / 2, target.y + 80, {
		steps: 12,
	});
	await page.mouse.move(target.x + target.width / 2, target.y + 70, {
		steps: 2,
	});
	await page.screenshot({
		path: `${OUTPUT_DIR}workspaces-drag.png`,
		...SHOT,
	});
	// Release so the gesture settles cleanly. Jellyfin ends up in the Home workspace from here
	// on; later tests don't depend on where it sits.
	await page.mouse.up();
});

test.describe("mobile", () => {
	test.use({ ...pixel7, deviceScaleFactor: 1 });

	test("top bar and switcher", async ({ page }) => {
		await page.goto("/");
		await expect(page.getByTestId("service-iframe").first()).toBeVisible();
		await page.screenshot({ path: `${OUTPUT_DIR}mobile.png`, ...SHOT });

		await page.getByLabel("Open switcher").click();
		await expect(page.getByTestId("mobile-switcher")).toBeVisible();
		await page.screenshot({
			path: `${OUTPUT_DIR}mobile-switcher.png`,
			...SHOT,
		});
	});
});

test("health states", async ({ page, request }) => {
	// Arrange: real demo URLs only ever answer "fast", so stand up four tiny local servers
	// whose response time (or absence) lands in each latency bucket — thresholds in
	// packages/store/src/health-bucket.ts: fast < 60ms, ok < 250ms, slow beyond, down = no answer.
	const listen = (delayMs: number) =>
		new Promise<Server>((resolve) => {
			const server = createServer((_req, res) =>
				setTimeout(() => {
					res.setHeader("content-type", "text/html");
					res.end("<!doctype html><title>demo</title>");
				}, delayMs),
			);
			server.listen(0, "127.0.0.1", () => resolve(server));
		});
	const servers = [await listen(0), await listen(120), await listen(400)];
	const closed = await listen(0);
	const closedPort = (closed.address() as AddressInfo).port;
	await new Promise((resolve) => closed.close(resolve));

	const fleet = [
		{
			name: "Router",
			mark: "RT",
			port: (servers[0].address() as AddressInfo).port,
		},
		{
			name: "Wiki",
			mark: "WK",
			port: (servers[1].address() as AddressInfo).port,
		},
		{
			name: "Backups",
			mark: "BK",
			port: (servers[2].address() as AddressInfo).port,
		},
		{ name: "Archive", mark: "AR", port: closedPort },
	];

	try {
		const lab = await request.post(`${API_BASE}/workspaces`, {
			data: { name: "Lab", label: "LB" },
		});
		expect(lab.ok()).toBeTruthy();
		const labId = (await lab.json()).id;
		for (const service of fleet) {
			const created = await request.post(`${API_BASE}/services`, {
				data: {
					name: service.name,
					mark: service.mark,
					hue: "lavender",
					host: `127.0.0.1:${service.port}`,
					url: `http://127.0.0.1:${service.port}/`,
					target: "external",
					ws: labId,
				},
			});
			expect(created.ok()).toBeTruthy();
		}

		// Act: open the Lab workspace and wait for the first server-side tick to land — the
		// three reachable services get a latency reading in the same tick that marks the
		// closed port down, so once those appear the fourth row is settled too.
		await page.goto("/");
		await page
			.locator(
				`[data-testid=spine-workspace-pill][data-workspace-id="${labId}"]`,
			)
			.click();
		const rows = page.getByTestId("sidebar-service-row");
		await expect(rows).toHaveCount(4);
		await expect(rows.filter({ hasText: /\d+ms/ })).toHaveCount(3, {
			timeout: 10_000,
		});

		// Assert (loosely): capture just the sidebar, where all four states sit together.
		await page.locator(".sidebar").screenshot({
			path: `${OUTPUT_DIR}health-states.png`,
			...SHOT,
		});
	} finally {
		for (const server of servers) server.close();
	}
});
