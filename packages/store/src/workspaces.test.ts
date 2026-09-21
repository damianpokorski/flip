import { afterAll, describe, expect, mock, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const tmpDir = mkdtempSync(path.join(os.tmpdir(), "flip-workspaces-store-"));
mock.module("@flip/env/server", () => ({ env: { DATA_DIR: tmpDir } }));

const { workspacesStore } = await import("./workspaces");
const { servicesStore } = await import("./services");
const { configStore } = await import("./config");

afterAll(() => {
	rmSync(tmpDir, { recursive: true, force: true });
});

describe("workspacesStore", () => {
	test("the default workspace is seeded (via configStore.ensureExists)", async () => {
		// Act
		await configStore.ensureExists();
		const all = await workspacesStore.findAll();

		// Assert
		expect(all).toHaveLength(1);
		expect(all[0]).toMatchObject({ id: "default" });
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

	test("create appends the workspace after the existing ones, with no services yet", async () => {
		// Act
		const created = await workspacesStore.create({
			name: `Unique ${Math.random()}`,
			label: "UQ",
		});
		const all = await workspacesStore.findAll();
		const services = await servicesStore.findAll();

		// Assert
		expect(all[all.length - 1]?.id).toBe(created.id);
		expect(services.filter((s) => s.ws === created.id)).toHaveLength(0);
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

	test("reorder applies the new order", async () => {
		// Arrange
		const a = await workspacesStore.create({ name: "Order A", label: "OA" });
		const b = await workspacesStore.create({ name: "Order B", label: "OB" });

		// Act
		const reordered = await workspacesStore.reorder([b.id, a.id]);
		const bIndex = reordered.findIndex((w) => w.id === b.id);
		const aIndex = reordered.findIndex((w) => w.id === a.id);

		// Assert
		expect(bIndex).toBeLessThan(aIndex);
	});

	test("deleteWithCascade moves the deleted workspace's services onto the fallback, in one call, then removes it", async () => {
		// Arrange
		const from = await workspacesStore.create({ name: "From", label: "FR" });
		const to = await workspacesStore.create({ name: "To", label: "TO" });
		const member = await servicesStore.create({
			id: `svc-${Math.random().toString(36).slice(2)}`,
			name: "Member",
			mark: "MB",
			hue: "sapphire",
			host: "member.home.lan",
			url: "https://member.home.lan",
			healthCheckUrl: null,
			source: "external",
			localSlug: null,
			ws: from.id,
			pin: null,
			codes: "200",
			every: "30s",
			target: "frame",
			proxyHeaders: false,
			hidden: false,
			lazyLoad: false,
		});

		// Act
		const deleted = await workspacesStore.deleteWithCascade(from.id, to.id);

		// Assert
		expect(deleted?.id).toBe(from.id);
		expect(await workspacesStore.findById(from.id)).toBeUndefined();
		const memberAfter = await servicesStore.findById(member.id);
		expect(memberAfter?.ws).toBe(to.id);
	});

	test("deleteWithCascade returns undefined for an unknown id", async () => {
		// Act
		const deleted = await workspacesStore.deleteWithCascade(
			"does-not-exist",
			"default",
		);

		// Assert
		expect(deleted).toBeUndefined();
	});
});
