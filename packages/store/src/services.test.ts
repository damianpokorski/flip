import { afterAll, describe, expect, mock, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { NewService } from "./services";

const tmpDir = mkdtempSync(path.join(os.tmpdir(), "flip-services-store-"));
mock.module("@flip/env/server", () => ({ env: { DATA_DIR: tmpDir } }));

const { servicesStore } = await import("./services");
const { workspacesStore } = await import("./workspaces");
const { configStore } = await import("./config");

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
	test("the default example service is seeded (via configStore.ensureExists) under the default workspace", async () => {
		// Act
		await configStore.ensureExists();
		const all = await servicesStore.findAll();

		// Assert
		expect(all).toHaveLength(1);
		expect(all[0]).toMatchObject({ id: SEED_ID, ws: "default" });
	});

	test("create appends the service under its target workspace", async () => {
		// Act
		const created = await servicesStore.create(newService({ name: "New" }));

		// Assert
		expect(created.name).toBe("New");
		expect(created.ws).toBe("default");
	});

	test("findAll returns services in nested order — workspace order, then within-workspace order", async () => {
		// Arrange
		await workspacesStore.create({ name: "Media", label: "MD" });
		const a = await servicesStore.create(
			newService({ name: "A", ws: "media" }),
		);
		const b = await servicesStore.create(
			newService({ name: "B", ws: "media" }),
		);

		// Act
		const all = await servicesStore.findAll();
		const media = all.filter((s) => s.ws === "media");

		// Assert
		expect(media.map((s) => s.id)).toEqual([a.id, b.id]);
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
		expect(found?.ws).toBe("default");
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

	test("update moves a service to a different workspace when ws changes", async () => {
		// Arrange
		const created = await servicesStore.create(
			newService({ name: "Movable", ws: "default" }),
		);

		// Act
		const updated = await servicesStore.update(created.id, { ws: "media" });

		// Assert
		expect(updated?.ws).toBe("media");
		const stillFound = await servicesStore.findById(created.id);
		expect(stillFound?.ws).toBe("media");
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

	test("reorder applies the new order within a single workspace", async () => {
		// Arrange — a dedicated workspace so this test isn't affected by services other tests
		// have already created under "default"/"media"
		await workspacesStore.create({ name: "Order Test", label: "OT" });
		const a = await servicesStore.create(
			newService({ name: "A", ws: "order-test" }),
		);
		const b = await servicesStore.create(
			newService({ name: "B", ws: "order-test" }),
		);

		// Act
		const reordered = await servicesStore.reorder("order-test", [b.id, a.id]);

		// Assert
		expect(reordered.map((s) => s.id)).toEqual([b.id, a.id]);
	});

	test("reorder doesn't affect services in other workspaces", async () => {
		// Arrange
		await workspacesStore.create({ name: "Untouched", label: "UT" });
		const a = await servicesStore.create(
			newService({ name: "A", ws: "untouched" }),
		);
		const b = await servicesStore.create(
			newService({ name: "B", ws: "untouched" }),
		);
		const before = await servicesStore.findAll();
		const otherWorkspaceIds = before
			.filter((s) => s.ws !== "untouched")
			.map((s) => s.id);

		// Act
		await servicesStore.reorder("untouched", [b.id, a.id]);
		const after = await servicesStore.findAll();

		// Assert
		expect(after.filter((s) => s.ws !== "untouched").map((s) => s.id)).toEqual(
			otherWorkspaceIds,
		);
	});
});
