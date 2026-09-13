import { afterAll, describe, expect, mock, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const tmpDir = mkdtempSync(path.join(os.tmpdir(), "flip-index-store-"));
mock.module("@flip/env/server", () => ({ env: { DATA_DIR: tmpDir } }));

const { initDataFiles } = await import("./index");

afterAll(() => {
	rmSync(tmpDir, { recursive: true, force: true });
});

describe("initDataFiles", () => {
	test("creates all default YAML files and the sites directory", async () => {
		// Act
		await initDataFiles();

		// Assert
		expect(existsSync(path.join(tmpDir, "services.yaml"))).toBe(true);
		expect(existsSync(path.join(tmpDir, "workspaces.yaml"))).toBe(true);
		expect(existsSync(path.join(tmpDir, "config.yaml"))).toBe(true);
		expect(existsSync(path.join(tmpDir, "sites"))).toBe(true);
	});

	test("is safe to call again — never overwrites existing files", async () => {
		// Arrange
		const { servicesStore } = await import("./services");
		await servicesStore.create({
			id: "extra",
			name: "Extra",
			mark: "EX",
			hue: "sapphire",
			host: "extra.home.lan",
			url: "https://extra.home.lan",
			healthCheckUrl: null,
			source: "external",
			localSlug: null,
			ws: "default",
			pin: null,
			codes: "200",
			every: "30s",
			target: "frame",
			proxyHeaders: false,
			hidden: false,
			lazyLoad: false,
		});

		// Act
		await initDataFiles();
		const all = await servicesStore.findAll();

		// Assert — the extra service survives a second initDataFiles() call
		expect(all.some((s) => s.id === "extra")).toBe(true);
	});
});
