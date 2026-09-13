import { afterAll, describe, expect, mock, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const tmpDir = mkdtempSync(path.join(os.tmpdir(), "flip-sites-store-"));
mock.module("@flip/env/server", () => ({ env: { DATA_DIR: tmpDir } }));

const { listSiteSlugs, resolveSiteFile, sitesDir } = await import("./sites");

afterAll(() => {
	rmSync(tmpDir, { recursive: true, force: true });
});

describe("listSiteSlugs", () => {
	test("returns an empty list when sitesDir doesn't exist yet", async () => {
		// Act
		const slugs = await listSiteSlugs();

		// Assert
		expect(slugs).toEqual([]);
	});

	test("lists only directories, not files, under sitesDir", async () => {
		// Arrange
		mkdirSync(path.join(sitesDir(), "demo"), { recursive: true });
		mkdirSync(path.join(sitesDir(), "blog"), { recursive: true });
		await Bun.write(path.join(sitesDir(), "stray-file.txt"), "not a site");

		// Act
		const slugs = await listSiteSlugs();

		// Assert
		expect(slugs.sort()).toEqual(["blog", "demo"]);
	});
});

describe("resolveSiteFile", () => {
	test("resolves a normal subpath within the site's folder", () => {
		// Act
		const resolved = resolveSiteFile("demo", "style.css");

		// Assert
		expect(resolved).toBe(path.join(sitesDir(), "demo", "style.css"));
	});

	test("defaults to index.html when no subpath is given", () => {
		// Act
		const resolved = resolveSiteFile("demo", "");

		// Assert
		expect(resolved).toBe(path.join(sitesDir(), "demo", "index.html"));
	});

	test("rejects a path-traversal attempt", () => {
		// Act
		const resolved = resolveSiteFile("demo", "../../etc/passwd");

		// Assert
		expect(resolved).toBeNull();
	});

	test("rejects a malformed slug", () => {
		// Act
		const resolved = resolveSiteFile("../evil", "index.html");

		// Assert
		expect(resolved).toBeNull();
	});

	test("rejects an uppercase slug (not in the allowed pattern)", () => {
		// Act
		const resolved = resolveSiteFile("Demo", "index.html");

		// Assert
		expect(resolved).toBeNull();
	});
});
