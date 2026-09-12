import { describe, expect, test } from "bun:test";
import path from "node:path";
import { dataDir } from "@flip/store";
import { SitesRepository } from "./SitesRepository";

describe("SitesRepository.resolveFile", () => {
	const repo = new SitesRepository();

	test("resolves a normal subpath within the site's folder", () => {
		// Arrange
		const expected = path.join(dataDir(), "sites", "demo", "style.css");

		// Act
		const resolved = repo.resolveFile("demo", "style.css");

		// Assert
		expect(resolved).toBe(expected);
	});

	test("defaults to index.html when no subpath is given", () => {
		// Arrange
		const expected = path.join(dataDir(), "sites", "demo", "index.html");

		// Act
		const resolved = repo.resolveFile("demo", "");

		// Assert
		expect(resolved).toBe(expected);
	});

	test("rejects a path-traversal attempt", () => {
		// Act
		const resolved = repo.resolveFile("demo", "../../etc/passwd");

		// Assert
		expect(resolved).toBeNull();
	});

	test("rejects a malformed slug", () => {
		// Act
		const resolved = repo.resolveFile("../evil", "index.html");

		// Assert
		expect(resolved).toBeNull();
	});
});
