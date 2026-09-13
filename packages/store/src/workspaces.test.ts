import { afterAll, describe, expect, mock, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const tmpDir = mkdtempSync(path.join(os.tmpdir(), "flip-workspaces-store-"));
mock.module("@flip/env/server", () => ({ env: { DATA_DIR: tmpDir } }));

const { workspacesStore } = await import("./workspaces");

afterAll(() => {
	rmSync(tmpDir, { recursive: true, force: true });
});

describe("workspacesStore", () => {
	test("ensureExists seeds the default workspace", async () => {
		// Act
		await workspacesStore.ensureExists();
		const all = await workspacesStore.findAll();

		// Assert
		expect(all).toHaveLength(1);
		expect(all[0]).toMatchObject({ id: "default", position: 0 });
	});

	test("create derives an id by slugifying the name", async () => {
		// Act
		const created = await workspacesStore.create({
			name: "Home Media",
			label: "HM",
		});

		// Assert
		expect(created.id).toBe("home-media");
	});

	test("create de-dupes a slug collision by suffixing -2, -3, ...", async () => {
		// Arrange
		await workspacesStore.create({ name: "Dev Tools", label: "DT" });

		// Act
		const second = await workspacesStore.create({
			name: "Dev Tools",
			label: "D2",
		});

		// Assert
		expect(second.id).toBe("dev-tools-2");
	});

	test("create assigns the next position after the current max", async () => {
		// Arrange
		const before = await workspacesStore.findAll();
		const maxPosition = Math.max(...before.map((w) => w.position));

		// Act
		const created = await workspacesStore.create({
			name: `Unique ${Math.random()}`,
			label: "UQ",
		});

		// Assert
		expect(created.position).toBe(maxPosition + 1);
	});

	test("findById returns the matching workspace", async () => {
		// Arrange
		const created = await workspacesStore.create({
			name: "Findable Space",
			label: "FS",
		});

		// Act
		const found = await workspacesStore.findById(created.id);

		// Assert
		expect(found?.name).toBe("Findable Space");
	});

	test("update patches only the given fields, leaving the id untouched", async () => {
		// Arrange
		const created = await workspacesStore.create({
			name: "Original Space",
			label: "OS",
		});

		// Act
		const updated = await workspacesStore.update(created.id, {
			name: "Renamed Space",
			label: "RS",
		});

		// Assert
		expect(updated?.id).toBe(created.id);
		expect(updated?.name).toBe("Renamed Space");
	});

	test("update returns undefined for an unknown id", async () => {
		// Act
		const updated = await workspacesStore.update("does-not-exist", {
			name: "x",
			label: "XX",
		});

		// Assert
		expect(updated).toBeUndefined();
	});

	test("delete removes and returns the deleted workspace", async () => {
		// Arrange
		const created = await workspacesStore.create({
			name: "To Delete",
			label: "TD",
		});

		// Act
		const deleted = await workspacesStore.delete(created.id);
		const found = await workspacesStore.findById(created.id);

		// Assert
		expect(deleted?.id).toBe(created.id);
		expect(found).toBeUndefined();
	});

	test("reorder applies new positions in the given order", async () => {
		// Arrange
		const a = await workspacesStore.create({ name: "Order A", label: "OA" });
		const b = await workspacesStore.create({ name: "Order B", label: "OB" });

		// Act
		const reordered = await workspacesStore.reorder([b.id, a.id]);
		const bAfter = reordered.find((w) => w.id === b.id);
		const aAfter = reordered.find((w) => w.id === a.id);

		// Assert
		// biome-ignore lint/style/noNonNullAssertion: both were just created above
		expect(bAfter!.position).toBeLessThan(aAfter!.position);
	});

	test("readRaw returns the live file text", async () => {
		// Act
		const raw = await workspacesStore.readRaw();

		// Assert
		expect(raw.content).toContain("FLIP workspaces");
	});

	test("watch returns a stop function", () => {
		// Act
		const stop = workspacesStore.watch();

		// Assert
		expect(typeof stop).toBe("function");
		stop();
	});

	test("onChange registers a listener and returns an unsubscribe function", () => {
		// Act
		const unsubscribe = workspacesStore.onChange(() => {});

		// Assert
		expect(typeof unsubscribe).toBe("function");
		unsubscribe();
	});
});
