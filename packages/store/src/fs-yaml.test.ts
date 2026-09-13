import { afterAll, describe, expect, mock, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { z } from "zod";

const tmpDir = mkdtempSync(path.join(os.tmpdir(), "flip-fs-yaml-test-"));
mock.module("@flip/env/server", () => ({ env: { DATA_DIR: tmpDir } }));

const { YamlFile } = await import("./fs-yaml");

afterAll(() => {
	rmSync(tmpDir, { recursive: true, force: true });
});

const ItemSchema = z.object({ id: z.string(), name: z.string() });
const ItemsSchema = z.array(ItemSchema).default([]);
type Item = z.infer<typeof ItemSchema>;

const DEFAULT_ITEMS_YAML = `# a comment worth preserving
- id: "1"
  name: One
`;

function uniqueFile(defaultContent = DEFAULT_ITEMS_YAML) {
	const fileName = `items-${Math.random().toString(36).slice(2)}.yaml`;
	const file = new YamlFile<Item[]>(fileName, ItemsSchema, defaultContent);
	return { file, filePath: path.join(tmpDir, fileName) };
}

describe("YamlFile.ensureExists", () => {
	test("creates the file with the default content when missing", async () => {
		// Arrange
		const { file } = uniqueFile();

		// Act
		await file.ensureExists();
		const data = await file.read();

		// Assert
		expect(data).toEqual([{ id: "1", name: "One" }]);
	});

	test("never overwrites an existing file", async () => {
		// Arrange
		const { file } = uniqueFile();
		await file.ensureExists();
		await file.mutate((doc) => doc.add({ id: "2", name: "Two" }));

		// Act
		await file.ensureExists();
		const data = await file.read();

		// Assert
		expect(data).toHaveLength(2);
	});

	test("throws if its own default content doesn't satisfy the schema", async () => {
		// Arrange
		const { file } = uniqueFile("- id: 1\n"); // missing required `name`

		// Act & Assert
		await expect(file.ensureExists()).rejects.toThrow();
	});
});

describe("YamlFile.read", () => {
	test("caches after the first read — a direct external write isn't picked up", async () => {
		// Arrange
		const { file, filePath } = uniqueFile();
		await file.ensureExists();
		await file.read();

		// Act — write directly to disk, bypassing this YamlFile instance
		await writeFile(filePath, '- id: "1"\n  name: Changed\n', "utf8");

		// Assert — cache still reflects the original read
		const data = await file.read();
		expect(data).toEqual([{ id: "1", name: "One" }]);
	});
});

describe("YamlFile.mutate", () => {
	test("re-reads from disk, applies the mutation, validates, and writes atomically", async () => {
		// Arrange
		const { file } = uniqueFile();
		await file.ensureExists();

		// Act
		const result = await file.mutate((doc) => {
			doc.add({ id: "2", name: "Two" });
		});

		// Assert
		expect(result).toEqual([
			{ id: "1", name: "One" },
			{ id: "2", name: "Two" },
		]);
	});

	test("updates the in-memory cache so a subsequent read reflects the mutation", async () => {
		// Arrange
		const { file } = uniqueFile();
		await file.ensureExists();
		await file.read();

		// Act
		await file.mutate((doc) => {
			doc.add({ id: "2", name: "Two" });
		});

		// Assert
		const data = await file.read();
		expect(data).toHaveLength(2);
	});

	test("preserves comments/formatting on untouched parts of the file", async () => {
		// Arrange
		const { file } = uniqueFile();
		await file.ensureExists();

		// Act
		await file.mutate((doc) => {
			doc.add({ id: "2", name: "Two" });
		});
		const raw = await file.readRaw();

		// Assert
		expect(raw.content).toContain("# a comment worth preserving");
	});

	test("rejects a mutation that leaves the document failing schema validation", async () => {
		// Arrange
		const { file } = uniqueFile();
		await file.ensureExists();

		// Act & Assert
		await expect(
			file.mutate((doc) => {
				doc.add({ id: "2" }); // missing required `name`
			}),
		).rejects.toThrow();
	});

	test("serializes concurrent mutations rather than racing", async () => {
		// Arrange
		const { file } = uniqueFile();
		await file.ensureExists();

		// Act
		await Promise.all([
			file.mutate((doc) => doc.add({ id: "2", name: "Two" })),
			file.mutate((doc) => doc.add({ id: "3", name: "Three" })),
			file.mutate((doc) => doc.add({ id: "4", name: "Four" })),
		]);

		// Assert
		const data = await file.read();
		expect(data.map((item) => item.id).sort()).toEqual(["1", "2", "3", "4"]);
	});
});

describe("YamlFile.readRaw", () => {
	test("returns raw file text and an ISO updatedAt timestamp", async () => {
		// Arrange
		const { file } = uniqueFile();
		await file.ensureExists();

		// Act
		const raw = await file.readRaw();

		// Assert
		expect(raw.content).toContain("name: One");
		expect(() => new Date(raw.updatedAt).toISOString()).not.toThrow();
	});
});

describe("YamlFile.watch/onChange", () => {
	test("notifies listeners after an external, valid change to the file on disk", async () => {
		// Arrange
		const { file, filePath } = uniqueFile();
		await file.ensureExists();
		const changed = new Promise<Item[]>((resolve) => {
			file.onChange(resolve);
		});
		const stop = file.watch();

		// Act — bypass this instance and edit the file directly, as a hand-edit would
		await writeFile(
			filePath,
			`${DEFAULT_ITEMS_YAML}- id: "2"\n  name: Two\n`,
			"utf8",
		);

		// Assert
		const data = await changed;
		expect(data).toHaveLength(2);
		stop();
	}, 3000);

	test("swallows an external edit that fails schema validation, keeping last-known-good data", async () => {
		// Arrange
		const { file, filePath } = uniqueFile();
		await file.ensureExists();
		const stop = file.watch();

		// Act — an invalid hand-edit, followed by a valid one; only the valid one should
		// ever reach a listener
		const changed = new Promise<Item[]>((resolve) => {
			file.onChange(resolve);
		});
		await writeFile(filePath, "- id: 2\n", "utf8"); // missing required `name`
		await new Promise((resolve) => setTimeout(resolve, 400));
		await writeFile(
			filePath,
			`${DEFAULT_ITEMS_YAML}- id: "2"\n  name: Two\n`,
			"utf8",
		);
		const data = await changed;

		// Assert — the invalid edit never corrupted the in-memory cache; the store recovers
		// once a valid edit follows
		expect(data).toHaveLength(2);
		stop();
	}, 3000);
});
