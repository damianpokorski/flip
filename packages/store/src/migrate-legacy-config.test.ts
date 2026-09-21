import { afterEach, describe, expect, mock, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parseDocument } from "yaml";

const tmpDir = mkdtempSync(path.join(os.tmpdir(), "flip-migrate-legacy-"));
mock.module("@flip/env/server", () => ({ env: { DATA_DIR: tmpDir } }));

const { migrateLegacyConfigIfNeeded } = await import("./migrate-legacy-config");

const servicesPath = path.join(tmpDir, "services.yaml");
const workspacesPath = path.join(tmpDir, "workspaces.yaml");
const configPath = path.join(tmpDir, "config.yaml");

const LEGACY_WORKSPACES_YAML = `- id: media
  name: Media
  label: MD
  position: 1
- id: default
  name: DEFAULT
  label: DF
  position: 0
`;

const LEGACY_SERVICES_YAML = `- id: svc-b
  name: Second
  mark: SB
  hue: teal
  host: b.home.lan
  url: https://b.home.lan
  healthCheckUrl: null
  source: external
  localSlug: null
  ws: default
  pin: null
  codes: "200"
  every: 30s
  target: frame
  proxyHeaders: false
  hidden: false
  lazyLoad: false
  position: 1
- id: svc-a
  name: First # keep me
  mark: SA
  hue: sapphire
  host: a.home.lan
  url: https://a.home.lan
  healthCheckUrl: null
  source: external
  localSlug: null
  ws: default
  pin: null
  codes: "200"
  every: 30s
  target: frame
  proxyHeaders: false
  hidden: false
  lazyLoad: false
  position: 0
`;

afterEach(() => {
	for (const p of [servicesPath, workspacesPath, configPath]) {
		rmSync(p, { force: true });
	}
});

describe("migrateLegacyConfigIfNeeded", () => {
	test("does nothing when neither legacy file exists", async () => {
		// Act
		await migrateLegacyConfigIfNeeded();

		// Assert
		expect(existsSync(configPath)).toBe(false);
	});

	test("merges both legacy files into config.yaml, sorted by position, and deletes them", async () => {
		// Arrange
		await writeFile(workspacesPath, LEGACY_WORKSPACES_YAML, "utf8");
		await writeFile(servicesPath, LEGACY_SERVICES_YAML, "utf8");

		// Act
		await migrateLegacyConfigIfNeeded();
		const combined = parseDocument(await Bun.file(configPath).text()).toJS();

		// Assert — workspace order follows the legacy `position` (default, then media)
		expect(combined.workspaces.map((w: { id: string }) => w.id)).toEqual([
			"default",
			"media",
		]);
		// Assert — services nested under "default", ordered by their own legacy `position`
		expect(
			combined.workspaces[0].services.map((s: { id: string }) => s.id),
		).toEqual(["svc-a", "svc-b"]);
		// Assert — neither `ws` nor `position` survive onto the nested service
		expect(combined.workspaces[0].services[0]).not.toHaveProperty("ws");
		expect(combined.workspaces[0].services[0]).not.toHaveProperty("position");
		expect(existsSync(servicesPath)).toBe(false);
		expect(existsSync(workspacesPath)).toBe(false);
	});

	test("carries forward an existing flat config.yaml's scalar values", async () => {
		// Arrange
		await writeFile(workspacesPath, LEGACY_WORKSPACES_YAML, "utf8");
		await writeFile(servicesPath, LEGACY_SERVICES_YAML, "utf8");
		await writeFile(configPath, "uiScale: 1.5\n", "utf8");

		// Act
		await migrateLegacyConfigIfNeeded();
		const combined = parseDocument(await Bun.file(configPath).text()).toJS();

		// Assert
		expect(combined.uiScale).toBe(1.5);
	});

	test("is a no-op crash-recovery cleanup when config.yaml is already the new nested shape", async () => {
		// Arrange — a previous run wrote the combined file but crashed before deleting the
		// legacy ones
		await writeFile(workspacesPath, LEGACY_WORKSPACES_YAML, "utf8");
		await writeFile(servicesPath, LEGACY_SERVICES_YAML, "utf8");
		await writeFile(
			configPath,
			"healthCheckTimeoutMs: 5000\nmaxParallelFrameLoads: 3\nuiScale: 1\nworkspaces: []\n",
			"utf8",
		);

		// Act
		await migrateLegacyConfigIfNeeded();
		const combined = parseDocument(await Bun.file(configPath).text()).toJS();

		// Assert — untouched (still empty workspaces, from the already-migrated file, not
		// re-derived from the stale legacy files)
		expect(combined.workspaces).toEqual([]);
		expect(existsSync(servicesPath)).toBe(false);
		expect(existsSync(workspacesPath)).toBe(false);
	});

	test("throws when only one of the two legacy files exists", async () => {
		// Arrange
		await writeFile(workspacesPath, LEGACY_WORKSPACES_YAML, "utf8");

		// Act & Assert
		await expect(migrateLegacyConfigIfNeeded()).rejects.toThrow();
		expect(existsSync(configPath)).toBe(false);
	});
});
