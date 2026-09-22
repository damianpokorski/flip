import { beforeEach, describe, expect, mock, test } from "bun:test";
import { BadRequestError, NotFoundError } from "../errors";
import { ServicesService } from "./ServicesService";

function service(overrides: Partial<Record<string, unknown>> = {}) {
	return {
		id: "1",
		name: "Example",
		mark: "EX",
		hue: "sapphire",
		host: "example.com",
		url: "https://example.com",
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

function fakeServicesRepo(services: ReturnType<typeof service>[] = []) {
	return {
		findAll: mock(async () => services),
		findById: mock(async (id: string) => services.find((s) => s.id === id)),
		create: mock(async (data: unknown) => ({
			...(data as object),
		})),
		update: mock(async (_id: string, data: unknown) => ({
			...(data as object),
		})),
		delete: mock(async (id: string) => services.find((s) => s.id === id)),
		reorder: mock(async () => services),
	};
}

function fakeWorkspacesRepo() {
	return { findById: mock(async () => ({ id: "default" })) };
}

const baseBody = {
	name: "Example",
	mark: "EX",
	hue: "sapphire" as const,
	host: "example.com",
	url: "https://example.com",
	ws: "default",
};

describe("ServicesService local-source derivation", () => {
	let servicesRepo: ReturnType<typeof fakeServicesRepo>;
	let workspacesRepo: ReturnType<typeof fakeWorkspacesRepo>;
	let service: ServicesService;

	beforeEach(() => {
		servicesRepo = fakeServicesRepo();
		workspacesRepo = fakeWorkspacesRepo();
		// biome-ignore lint/suspicious/noExplicitAny: fakes intentionally implement a subset
		service = new ServicesService(servicesRepo as any, workspacesRepo as any);
	});

	test("derives url from localSlug and forces proxyHeaders off for source: local", async () => {
		// Arrange
		const body = { ...baseBody, source: "local" as const, localSlug: "demo" };

		// Act
		await service.create(body);

		// Assert
		expect(servicesRepo.create).toHaveBeenCalledWith(
			expect.objectContaining({
				source: "local",
				localSlug: "demo",
				url: "/api/sites/demo/",
				proxyHeaders: false,
			}),
		);
	});

	test("throws BadRequestError when source is local but localSlug is missing", async () => {
		// Arrange
		const body = { ...baseBody, source: "local" as const, localSlug: null };

		// Act & Assert
		await expect(service.create(body)).rejects.toThrow(BadRequestError);
		expect(servicesRepo.create).not.toHaveBeenCalled();
	});

	test("clears localSlug and leaves url untouched for source: external", async () => {
		// Arrange
		const body = {
			...baseBody,
			source: "external" as const,
			localSlug: "stale",
		};

		// Act
		await service.create(body);

		// Assert
		expect(servicesRepo.create).toHaveBeenCalledWith(
			expect.objectContaining({
				source: "external",
				localSlug: null,
				url: "https://example.com",
			}),
		);
	});
});

describe("ServicesService hue resolution", () => {
	test("getAll resolves an unset hue to a hashed colour and flags it as auto", async () => {
		// Arrange
		const servicesRepo = fakeServicesRepo([
			service({ id: "1", name: "Example", hue: null }),
		]);
		const workspacesRepo = fakeWorkspacesRepo();
		// biome-ignore lint/suspicious/noExplicitAny: fakes intentionally implement a subset
		const svc = new ServicesService(servicesRepo as any, workspacesRepo as any);

		// Act
		const result = await svc.getAll();
		// biome-ignore lint/style/noNonNullAssertion: the repo above seeds exactly one service
		const first = result[0]!;

		// Assert
		expect(first.hueAuto).toBe(true);
		expect(first.hue).not.toBeNull();
	});

	test("getById reports hueAuto: false when a hue is explicitly stored", async () => {
		// Arrange
		const servicesRepo = fakeServicesRepo([service({ id: "1", hue: "mauve" })]);
		const workspacesRepo = fakeWorkspacesRepo();
		// biome-ignore lint/suspicious/noExplicitAny: fakes intentionally implement a subset
		const svc = new ServicesService(servicesRepo as any, workspacesRepo as any);

		// Act
		const result = await svc.getById("1");

		// Assert
		expect(result.hueAuto).toBe(false);
		expect(result.hue).toBe("mauve");
	});
});

describe("ServicesService.getAll/getById", () => {
	test("getAll maps each service through the health lookup", async () => {
		// Arrange
		const servicesRepo = fakeServicesRepo([service({ id: "1" })]);
		const workspacesRepo = fakeWorkspacesRepo();
		const getHealth = mock(() => ({
			ms: 10,
			lastCheckedAt: "now",
			bucket: "fast" as const,
		}));
		const svc = new ServicesService(
			// biome-ignore lint/suspicious/noExplicitAny: fakes intentionally implement a subset
			servicesRepo as any,
			// biome-ignore lint/suspicious/noExplicitAny: fakes intentionally implement a subset
			workspacesRepo as any,
			getHealth,
		);

		// Act
		const result = await svc.getAll();
		// biome-ignore lint/style/noNonNullAssertion: the repo above seeds exactly one service
		const first = result[0]!;

		// Assert
		expect(first.health).toEqual({
			ms: 10,
			lastCheckedAt: "now",
			bucket: "fast",
		});
		expect(first).not.toHaveProperty("position");
	});

	test("getById returns the service when found", async () => {
		// Arrange
		const servicesRepo = fakeServicesRepo([
			service({ id: "1", name: "Found" }),
		]);
		const workspacesRepo = fakeWorkspacesRepo();
		// biome-ignore lint/suspicious/noExplicitAny: fakes intentionally implement a subset
		const svc = new ServicesService(servicesRepo as any, workspacesRepo as any);

		// Act
		const result = await svc.getById("1");

		// Assert
		expect(result.name).toBe("Found");
	});

	test("getById throws NotFoundError when the service doesn't exist", async () => {
		// Arrange
		const servicesRepo = fakeServicesRepo([]);
		const workspacesRepo = fakeWorkspacesRepo();
		// biome-ignore lint/suspicious/noExplicitAny: fakes intentionally implement a subset
		const svc = new ServicesService(servicesRepo as any, workspacesRepo as any);

		// Act & Assert
		await expect(svc.getById("missing")).rejects.toThrow(NotFoundError);
	});
});

describe("ServicesService pin conflict validation", () => {
	test("create rejects a pin already used by another service", async () => {
		// Arrange
		const servicesRepo = fakeServicesRepo([
			service({ id: "existing", pin: "1" }),
		]);
		const workspacesRepo = fakeWorkspacesRepo();
		// biome-ignore lint/suspicious/noExplicitAny: fakes intentionally implement a subset
		const svc = new ServicesService(servicesRepo as any, workspacesRepo as any);

		// Act & Assert
		await expect(svc.create({ ...baseBody, pin: "1" })).rejects.toThrow(
			BadRequestError,
		);
		expect(servicesRepo.create).not.toHaveBeenCalled();
	});

	test("create allows a pin that no other service is using", async () => {
		// Arrange
		const servicesRepo = fakeServicesRepo([]);
		const workspacesRepo = fakeWorkspacesRepo();
		// biome-ignore lint/suspicious/noExplicitAny: fakes intentionally implement a subset
		const svc = new ServicesService(servicesRepo as any, workspacesRepo as any);

		// Act
		await svc.create({ ...baseBody, pin: "1" });

		// Assert
		expect(servicesRepo.create).toHaveBeenCalled();
	});

	test("update excludes the service's own id from the pin conflict check", async () => {
		// Arrange — service "1" already owns pin "1"; updating it (keeping the same pin)
		// must not be treated as a conflict with itself
		const servicesRepo = fakeServicesRepo([service({ id: "1", pin: "1" })]);
		const workspacesRepo = fakeWorkspacesRepo();
		// biome-ignore lint/suspicious/noExplicitAny: fakes intentionally implement a subset
		const svc = new ServicesService(servicesRepo as any, workspacesRepo as any);

		// Act
		await svc.update("1", { ...baseBody, pin: "1" });

		// Assert
		expect(servicesRepo.update).toHaveBeenCalled();
	});

	test("create rejects an unknown workspace id", async () => {
		// Arrange
		const servicesRepo = fakeServicesRepo([]);
		const workspacesRepo = { findById: mock(async () => undefined) };
		// biome-ignore lint/suspicious/noExplicitAny: fakes intentionally implement a subset
		const svc = new ServicesService(servicesRepo as any, workspacesRepo as any);

		// Act & Assert
		await expect(svc.create({ ...baseBody, ws: "bogus" })).rejects.toThrow(
			BadRequestError,
		);
	});
});

describe("ServicesService.update/delete", () => {
	test("update throws NotFoundError before touching the repository when the service doesn't exist", async () => {
		// Arrange
		const servicesRepo = fakeServicesRepo([]);
		const workspacesRepo = fakeWorkspacesRepo();
		// biome-ignore lint/suspicious/noExplicitAny: fakes intentionally implement a subset
		const svc = new ServicesService(servicesRepo as any, workspacesRepo as any);

		// Act & Assert
		await expect(svc.update("missing", baseBody)).rejects.toThrow(
			NotFoundError,
		);
		expect(servicesRepo.update).not.toHaveBeenCalled();
	});

	test("delete throws NotFoundError before touching the repository when the service doesn't exist", async () => {
		// Arrange
		const servicesRepo = fakeServicesRepo([]);
		const workspacesRepo = fakeWorkspacesRepo();
		// biome-ignore lint/suspicious/noExplicitAny: fakes intentionally implement a subset
		const svc = new ServicesService(servicesRepo as any, workspacesRepo as any);

		// Act & Assert
		await expect(svc.delete("missing")).rejects.toThrow(NotFoundError);
		expect(servicesRepo.delete).not.toHaveBeenCalled();
	});

	test("delete removes an existing service", async () => {
		// Arrange
		const servicesRepo = fakeServicesRepo([service({ id: "1", name: "Bye" })]);
		const workspacesRepo = fakeWorkspacesRepo();
		// biome-ignore lint/suspicious/noExplicitAny: fakes intentionally implement a subset
		const svc = new ServicesService(servicesRepo as any, workspacesRepo as any);

		// Act
		const result = await svc.delete("1");

		// Assert
		expect(result.name).toBe("Bye");
		expect(servicesRepo.delete).toHaveBeenCalledWith("1");
	});
});

describe("ServicesService.reorder", () => {
	test("throws BadRequestError for an unknown workspace id", async () => {
		// Arrange
		const servicesRepo = fakeServicesRepo([service({ id: "1" })]);
		const workspacesRepo = { findById: mock(async () => undefined) };
		// biome-ignore lint/suspicious/noExplicitAny: fakes intentionally implement a subset
		const svc = new ServicesService(servicesRepo as any, workspacesRepo as any);

		// Act & Assert
		await expect(svc.reorder("bogus-ws", ["1"])).rejects.toThrow(
			BadRequestError,
		);
		expect(servicesRepo.reorder).not.toHaveBeenCalled();
	});

	test("throws BadRequestError when the id set doesn't match the workspace's existing services", async () => {
		// Arrange
		const servicesRepo = fakeServicesRepo([service({ id: "1" })]);
		const workspacesRepo = fakeWorkspacesRepo();
		// biome-ignore lint/suspicious/noExplicitAny: fakes intentionally implement a subset
		const svc = new ServicesService(servicesRepo as any, workspacesRepo as any);

		// Act & Assert
		await expect(svc.reorder("default", ["bogus"])).rejects.toThrow(
			BadRequestError,
		);
		expect(servicesRepo.reorder).not.toHaveBeenCalled();
	});

	test("reorders when the id set exactly matches the workspace's existing services", async () => {
		// Arrange
		const servicesRepo = fakeServicesRepo([
			service({ id: "1" }),
			service({ id: "2" }),
		]);
		const workspacesRepo = fakeWorkspacesRepo();
		// biome-ignore lint/suspicious/noExplicitAny: fakes intentionally implement a subset
		const svc = new ServicesService(servicesRepo as any, workspacesRepo as any);

		// Act
		await svc.reorder("default", ["2", "1"]);

		// Assert
		expect(servicesRepo.reorder).toHaveBeenCalledWith("default", ["2", "1"]);
	});

	test("ignores ids from another workspace when checking the id set", async () => {
		// Arrange — a service in a different workspace must not count toward "default"'s set
		const servicesRepo = fakeServicesRepo([
			service({ id: "1", ws: "default" }),
			service({ id: "2", ws: "media" }),
		]);
		const workspacesRepo = fakeWorkspacesRepo();
		// biome-ignore lint/suspicious/noExplicitAny: fakes intentionally implement a subset
		const svc = new ServicesService(servicesRepo as any, workspacesRepo as any);

		// Act & Assert
		await expect(svc.reorder("default", ["2"])).rejects.toThrow(
			BadRequestError,
		);
		expect(servicesRepo.reorder).not.toHaveBeenCalled();
	});
});
