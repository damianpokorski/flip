import { beforeEach, describe, expect, mock, test } from "bun:test";
import { BadRequestError, NotFoundError } from "../errors";
import { WorkspacesService } from "./WorkspacesService";

const workspace = (id: string, position: number) => ({
	id,
	name: id.toUpperCase(),
	label: id.slice(0, 2).toUpperCase(),
	position,
});

function fakeWorkspacesRepo(workspaces: ReturnType<typeof workspace>[]) {
	return {
		findAll: async () => workspaces,
		findById: async (id: string) => workspaces.find((w) => w.id === id),
		create: mock(),
		update: mock(),
		delete: mock(async (id: string) => workspaces.find((w) => w.id === id)),
		reorder: mock(),
		readRaw: mock(),
	};
}

function fakeServicesRepo() {
	return { reassignWorkspace: mock() };
}

describe("WorkspacesService.delete", () => {
	let workspacesRepo: ReturnType<typeof fakeWorkspacesRepo>;
	let servicesRepo: ReturnType<typeof fakeServicesRepo>;
	let service: WorkspacesService;

	beforeEach(() => {
		workspacesRepo = fakeWorkspacesRepo([
			workspace("default", 0),
			workspace("media", 1),
		]);
		servicesRepo = fakeServicesRepo();
		// biome-ignore lint/suspicious/noExplicitAny: fakes intentionally implement a subset
		service = new WorkspacesService(workspacesRepo as any, servicesRepo as any);
	});

	test("reassigns member services to the first remaining workspace by position, then deletes it", async () => {
		// Arrange — deleting "default" (position 0) should fall back to "media" (position 1)

		// Act
		const result = await service.delete("default");

		// Assert
		expect(servicesRepo.reassignWorkspace).toHaveBeenCalledWith(
			"default",
			"media",
		);
		expect(workspacesRepo.delete).toHaveBeenCalledWith("default");
		expect(result.id).toBe("default");
	});

	test("refuses to delete the only remaining workspace", async () => {
		// Arrange
		workspacesRepo = fakeWorkspacesRepo([workspace("default", 0)]);
		servicesRepo = fakeServicesRepo();
		// biome-ignore lint/suspicious/noExplicitAny: fakes intentionally implement a subset
		service = new WorkspacesService(workspacesRepo as any, servicesRepo as any);

		// Act & Assert
		await expect(service.delete("default")).rejects.toThrow(BadRequestError);
		expect(servicesRepo.reassignWorkspace).not.toHaveBeenCalled();
		expect(workspacesRepo.delete).not.toHaveBeenCalled();
	});

	test("throws NotFoundError for a nonexistent workspace before any cascade logic runs", async () => {
		// Act & Assert
		await expect(service.delete("missing")).rejects.toThrow(NotFoundError);
		expect(servicesRepo.reassignWorkspace).not.toHaveBeenCalled();
		expect(workspacesRepo.delete).not.toHaveBeenCalled();
	});
});

describe("WorkspacesService.getAll/getById", () => {
	let workspacesRepo: ReturnType<typeof fakeWorkspacesRepo>;
	let servicesRepo: ReturnType<typeof fakeServicesRepo>;
	let service: WorkspacesService;

	beforeEach(() => {
		workspacesRepo = fakeWorkspacesRepo([workspace("default", 0)]);
		servicesRepo = fakeServicesRepo();
		// biome-ignore lint/suspicious/noExplicitAny: fakes intentionally implement a subset
		service = new WorkspacesService(workspacesRepo as any, servicesRepo as any);
	});

	test("getAll delegates directly to the repository", async () => {
		// Act
		const result = await service.getAll();

		// Assert
		expect(result).toEqual([workspace("default", 0)]);
	});

	test("getById returns the workspace when found", async () => {
		// Act
		const result = await service.getById("default");

		// Assert
		expect(result.id).toBe("default");
	});

	test("getById throws NotFoundError when the workspace doesn't exist", async () => {
		// Act & Assert
		await expect(service.getById("missing")).rejects.toThrow(NotFoundError);
	});
});

describe("WorkspacesService.create/update", () => {
	let workspacesRepo: ReturnType<typeof fakeWorkspacesRepo>;
	let servicesRepo: ReturnType<typeof fakeServicesRepo>;
	let service: WorkspacesService;

	beforeEach(() => {
		workspacesRepo = fakeWorkspacesRepo([workspace("default", 0)]);
		servicesRepo = fakeServicesRepo();
		// biome-ignore lint/suspicious/noExplicitAny: fakes intentionally implement a subset
		service = new WorkspacesService(workspacesRepo as any, servicesRepo as any);
	});

	test("create delegates to the repository", async () => {
		// Arrange
		workspacesRepo.create.mockResolvedValue(workspace("media", 1));

		// Act
		const result = await service.create({ name: "Media", label: "MD" });

		// Assert
		expect(workspacesRepo.create).toHaveBeenCalledWith({
			name: "Media",
			label: "MD",
		});
		expect(result.id).toBe("media");
	});

	test("update throws NotFoundError before touching the repository when missing", async () => {
		// Act & Assert
		await expect(
			service.update("missing", { name: "x", label: "XX" }),
		).rejects.toThrow(NotFoundError);
		expect(workspacesRepo.update).not.toHaveBeenCalled();
	});

	test("update patches an existing workspace", async () => {
		// Arrange
		workspacesRepo.update.mockResolvedValue({
			...workspace("default", 0),
			name: "Renamed",
		});

		// Act
		const result = await service.update("default", {
			name: "Renamed",
			label: "DF",
		});

		// Assert
		expect(result.name).toBe("Renamed");
	});
});

describe("WorkspacesService.reorder", () => {
	let workspacesRepo: ReturnType<typeof fakeWorkspacesRepo>;
	let servicesRepo: ReturnType<typeof fakeServicesRepo>;
	let service: WorkspacesService;

	beforeEach(() => {
		workspacesRepo = fakeWorkspacesRepo([
			workspace("default", 0),
			workspace("media", 1),
		]);
		servicesRepo = fakeServicesRepo();
		// biome-ignore lint/suspicious/noExplicitAny: fakes intentionally implement a subset
		service = new WorkspacesService(workspacesRepo as any, servicesRepo as any);
	});

	test("throws BadRequestError when the id set doesn't match existing workspaces", async () => {
		// Act & Assert
		await expect(service.reorder(["bogus"])).rejects.toThrow(BadRequestError);
		expect(workspacesRepo.reorder).not.toHaveBeenCalled();
	});

	test("reorders when the id set exactly matches existing workspaces", async () => {
		// Act
		await service.reorder(["media", "default"]);

		// Assert
		expect(workspacesRepo.reorder).toHaveBeenCalledWith(["media", "default"]);
	});
});
