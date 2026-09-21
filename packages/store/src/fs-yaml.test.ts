import { afterAll, describe, expect, mock, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { chmod, mkdir, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { isSeq } from "yaml";
import { z } from "zod";

const tmpDir = mkdtempSync(path.join(os.tmpdir(), "flip-fs-yaml-test-"));
const mockEnv = { DATA_DIR: tmpDir };
mock.module("@flip/env/server", () => ({ env: mockEnv }));

const { YamlFile } = await import("./fs-yaml");

const mode = async (p: string) => (await stat(p)).mode & 0o777;

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

describe("YamlFile permissions", () => {
	test("chmods a freshly created file to a+rwx", async () => {
		// Arrange
		const { file, filePath } = uniqueFile();

		// Act
		await file.ensureExists();

		// Assert
		expect(await mode(filePath)).toBe(0o777);
	});

	test("never changes the permissions of a file that already exists", async () => {
		// Arrange
		const { file, filePath } = uniqueFile();
		await file.ensureExists();
		await chmod(filePath, 0o600);

		// Act
		await file.ensureExists();

		// Assert
		expect(await mode(filePath)).toBe(0o600);
	});

	test("chmods DATA_DIR to a+rwx only the first time it's created", async () => {
		// Arrange
		const freshDataDir = path.join(
			tmpDir,
			`fresh-${Math.random().toString(36).slice(2)}`,
		);
		const originalDataDir = mockEnv.DATA_DIR;
		mockEnv.DATA_DIR = freshDataDir;
		const { file } = uniqueFile();

		try {
			// Act
			await file.ensureExists();
			const modeAfterCreate = await mode(freshDataDir);

			// Assert — created fresh, so it got chmodded
			expect(modeAfterCreate).toBe(0o777);

			// Act — lock the dir down, then call ensureExists() again on an already-existing dir
			await chmod(freshDataDir, 0o700);
			await file.ensureExists();

			// Assert — untouched the second time, since it already existed
			expect(await mode(freshDataDir)).toBe(0o700);
		} finally {
			await chmod(freshDataDir, 0o700).catch(() => {});
			mockEnv.DATA_DIR = originalDataDir;
		}
	});
});

describe("YamlFile migrateNewDefaultsOnBoot", () => {
	const ConfigLikeSchema = z.object({
		a: z.number().default(1),
		b: z.number().default(2),
	});
	const NEW_CONFIG_YAML =
		"# new header\n#   a   thing one\n#   b   thing two\na: 1\nb: 2\n";
	const OLD_CONFIG_YAML = "# old header\n#   a   thing one\na: 1\n";

	function configFile(defaultContent = NEW_CONFIG_YAML) {
		const fileName = `config-${Math.random().toString(36).slice(2)}.yaml`;
		const file = new YamlFile(fileName, ConfigLikeSchema, defaultContent, {
			migrateNewDefaultsOnBoot: true,
		});
		return { file, filePath: path.join(tmpDir, fileName) };
	}

	test("backfills a missing top-level default field and refreshes the header comment", async () => {
		// Arrange — a file written before `b` existed
		const { file, filePath } = configFile();
		await writeFile(filePath, OLD_CONFIG_YAML, "utf8");

		// Act
		await file.ensureExists();
		const data = await file.read();
		const raw = await file.readRaw();

		// Assert
		expect(data).toEqual({ a: 1, b: 2 });
		expect(raw.content).toContain("b: 2");
		expect(raw.content).toContain("# new header");
		expect(raw.content).toContain("#   b   thing two");
		expect(raw.content).not.toContain("# old header");
	});

	test("leaves an already-current file completely untouched", async () => {
		// Arrange
		const { file, filePath } = configFile();
		await file.ensureExists();
		const before = await stat(filePath);
		await new Promise((resolve) => setTimeout(resolve, 10));

		// Act
		await file.ensureExists();
		const after = await stat(filePath);

		// Assert — no rewrite happened, so mtime is exactly the same
		expect(after.mtimeMs).toBe(before.mtimeMs);
	});

	test("propagates a write failure instead of swallowing it", async () => {
		// Arrange — a pre-existing file missing `b`, sitting in a directory this process
		// can't write to (simulating e.g. a read-only mount)
		const subDir = path.join(
			tmpDir,
			`readonly-${Math.random().toString(36).slice(2)}`,
		);
		await mkdir(subDir, { recursive: true });
		const fileName = "config.yaml";
		await writeFile(path.join(subDir, fileName), OLD_CONFIG_YAML, "utf8");
		const originalDataDir = mockEnv.DATA_DIR;
		mockEnv.DATA_DIR = subDir;
		await chmod(subDir, 0o500); // read + execute, no write

		try {
			const file = new YamlFile(fileName, ConfigLikeSchema, NEW_CONFIG_YAML, {
				migrateNewDefaultsOnBoot: true,
			});

			// Act & Assert
			await expect(file.ensureExists()).rejects.toThrow();
		} finally {
			await chmod(subDir, 0o700);
			mockEnv.DATA_DIR = originalDataDir;
		}
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

describe("YamlFile nested mutations", () => {
	const GroupSchema = z.object({
		id: z.string(),
		items: z.array(ItemSchema).default([]),
	});
	const GroupsSchema = z.array(GroupSchema).default([]);
	type Group = z.infer<typeof GroupSchema>;

	const DEFAULT_GROUPS_YAML = `- id: a
  items:
    - id: "1"
      name: One # keep me
- id: b
  items: []
`;

	function groupsFile() {
		const fileName = `groups-${Math.random().toString(36).slice(2)}.yaml`;
		const file = new YamlFile<Group[]>(
			fileName,
			GroupsSchema,
			DEFAULT_GROUPS_YAML,
		);
		return file;
	}

	// The two mechanics services.ts/workspaces.ts rely on to nest services under a workspace
	// (Document.addIn into a nested array, and moving a raw node between two nested arrays)
	// have no other precedent in this codebase — verified here against a generic schema,
	// isolated from the real facades that build on top of them.
	test("mutate can append into a nested array via addIn, in block style even when the array started empty", async () => {
		// Arrange
		const file = groupsFile();
		await file.ensureExists();

		// Act
		await file.mutate((doc) => {
			const seq = doc.getIn([1, "items"], true);
			if (isSeq(seq)) seq.flow = false;
			doc.addIn([1, "items"], { id: "2", name: "Two" });
		});
		const data = await file.read();
		const raw = await file.readRaw();

		// Assert
		expect(data[1]?.items).toEqual([{ id: "2", name: "Two" }]);
		expect(raw.content).not.toContain("items: [");
		expect(raw.content).toContain('    - id: "2"\n      name: Two\n');
	});

	test("mutate can move a raw node between two nested arrays while preserving its comment", async () => {
		// Arrange
		const file = groupsFile();
		await file.ensureExists();

		// Act
		await file.mutate((doc) => {
			const node = doc.getIn([0, "items", 0], true);
			doc.deleteIn([0, "items", 0]);
			const destSeq = doc.getIn([1, "items"], true);
			if (isSeq(destSeq)) destSeq.flow = false;
			doc.addIn([1, "items"], node);
		});
		const data = await file.read();
		const raw = await file.readRaw();

		// Assert
		expect(data[0]?.items).toEqual([]);
		expect(data[1]?.items).toEqual([{ id: "1", name: "One" }]);
		expect(raw.content).toContain("# keep me");
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
