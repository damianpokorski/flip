import { afterAll, describe, expect, mock, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { NewService } from "./services";

const tmpDir = mkdtempSync(path.join(os.tmpdir(), "flip-services-store-"));
mock.module("@flip/env/server", () => ({ env: { DATA_DIR: tmpDir } }));

const { servicesStore } = await import("./services");

afterAll(() => {
	rmSync(tmpDir, { recursive: true, force: true });
});

const SEED_ID = "00000000-0000-7000-8000-000000000001";

function newService(overrides: Partial<NewService> = {}): NewService {
	return {
		id: `svc-${Math.random().toString(36).slice(2)}`,
		name: "Test service",
		mark: "TS",
		hue: "sapphire",
		host: "test.home.lan",
		url: "https://test.home.lan",
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
		...overrides,
	};
}

describe("servicesStore", () => {
	test("ensureExists seeds the default example service at position 0", async () => {
		// Act
		await servicesStore.ensureExists();
		const all = await servicesStore.findAll();

		// Assert
		expect(all).toHaveLength(1);
		expect(all[0]).toMatchObject({ id: SEED_ID, position: 0 });
	});

	test("findAll returns services sorted by position", async () => {
		// Arrange
		await servicesStore.ensureExists();

		// Act
		const all = await servicesStore.findAll();

		// Assert
		for (let i = 1; i < all.length; i++) {
			// biome-ignore lint/style/noNonNullAssertion: both indices are within bounds by the loop condition
			expect(all[i]!.position).toBeGreaterThanOrEqual(all[i - 1]!.position);
		}
	});

	test("create assigns the next position after the current max", async () => {
		// Arrange
		await servicesStore.ensureExists();
		const before = await servicesStore.findAll();
		const maxPosition = Math.max(...before.map((s) => s.position));

		// Act
		const created = await servicesStore.create(newService({ name: "New" }));

		// Assert
		expect(created.position).toBe(maxPosition + 1);
		expect(created.name).toBe("New");
	});

	test("findById returns the matching service", async () => {
		// Arrange
		const created = await servicesStore.create(
			newService({ name: "Findable" }),
		);

		// Act
		const found = await servicesStore.findById(created.id);

		// Assert
		expect(found?.name).toBe("Findable");
	});

	test("findById returns undefined for an unknown id", async () => {
		// Act
		const found = await servicesStore.findById("does-not-exist");

		// Assert
		expect(found).toBeUndefined();
	});

	test("update patches only the given fields", async () => {
		// Arrange
		const created = await servicesStore.create(
			newService({ name: "Original" }),
		);

		// Act
		const updated = await servicesStore.update(created.id, { name: "Renamed" });

		// Assert
		expect(updated?.name).toBe("Renamed");
		expect(updated?.host).toBe(created.host);
	});

	test("update returns undefined for an unknown id", async () => {
		// Act
		const updated = await servicesStore.update("does-not-exist", {
			name: "x",
		});

		// Assert
		expect(updated).toBeUndefined();
	});

	test("delete removes and returns the deleted service", async () => {
		// Arrange
		const created = await servicesStore.create(
			newService({ name: "ToDelete" }),
		);

		// Act
		const deleted = await servicesStore.delete(created.id);
		const found = await servicesStore.findById(created.id);

		// Assert
		expect(deleted?.id).toBe(created.id);
		expect(found).toBeUndefined();
	});

	test("delete returns undefined for an unknown id", async () => {
		// Act
		const deleted = await servicesStore.delete("does-not-exist");

		// Assert
		expect(deleted).toBeUndefined();
	});

	test("reorder applies new positions in the given order", async () => {
		// Arrange
		const a = await servicesStore.create(newService({ name: "A" }));
		const b = await servicesStore.create(newService({ name: "B" }));

		// Act
		const reordered = await servicesStore.reorder([b.id, a.id]);
		const bAfter = reordered.find((s) => s.id === b.id);
		const aAfter = reordered.find((s) => s.id === a.id);

		// Assert
		// biome-ignore lint/style/noNonNullAssertion: both were just created above
		expect(bAfter!.position).toBeLessThan(aAfter!.position);
	});

	test("reassignWorkspace moves only member services to the new workspace", async () => {
		// Arrange
		const member = await servicesStore.create(
			newService({ name: "Member", ws: "moving-from" }),
		);
		const other = await servicesStore.create(
			newService({ name: "Other", ws: "staying-put" }),
		);

		// Act
		await servicesStore.reassignWorkspace("moving-from", "moving-to");

		// Assert
		const memberAfter = await servicesStore.findById(member.id);
		const otherAfter = await servicesStore.findById(other.id);
		expect(memberAfter?.ws).toBe("moving-to");
		expect(otherAfter?.ws).toBe("staying-put");
	});

	test("readRaw returns the live file text", async () => {
		// Act
		const raw = await servicesStore.readRaw();

		// Assert
		expect(raw.content).toContain("FLIP services");
	});

	test("watch returns a stop function", () => {
		// Act
		const stop = servicesStore.watch();

		// Assert
		expect(typeof stop).toBe("function");
		stop();
	});

	test("onChange registers a listener and returns an unsubscribe function", () => {
		// Act
		const unsubscribe = servicesStore.onChange(() => {});

		// Assert
		expect(typeof unsubscribe).toBe("function");
		unsubscribe();
	});
});
