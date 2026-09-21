import { beforeEach, describe, expect, mock, test } from "bun:test";
import { BadRequestError, NotFoundError } from "../errors";
import { WorkspacesService } from "./WorkspacesService";

const workspace = (id: string) => ({
	id,
	name: id.toUpperCase(),
	label: id.slice(0, 2).toUpperCase(),
});

function fakeWorkspacesRepo(workspaces: ReturnType<typeof workspace>[]) {
	return {
		findAll: async () => workspaces,
		findById: async (id: string) => workspaces.find((w) => w.id === id),
		create: mock(),
		update: mock(),
		reorder: mock(),
		deleteWithCascade: mock(async (id: string) =>
			workspaces.find((w) => w.id === id),
		),
	};
}

describe("WorkspacesService.delete", () => {
	let workspacesRepo: ReturnType<typeof fakeWorkspacesRepo>;
	let service: WorkspacesService;

	beforeEach(() => {
		workspacesRepo = fakeWorkspacesRepo([
			workspace("default"),
			workspace("media"),
		]);
		// biome-ignore lint/suspicious/noExplicitAny: fakes intentionally implement a subset
		service = new WorkspacesService(workspacesRepo as any);
	});

	test("cascades to the first remaining workspace via one atomic call, then returns the deleted workspace", async () => {
		// Arrange — deleting "default" should fall back to "media" (the only one left)

		// Act
		const result = await service.delete("default");

		// Assert
		expect(workspacesRepo.deleteWithCascade).toHaveBeenCalledWith(
			"default",
			"media",
		);
		expect(result.id).toBe("default");
	});

	test("refuses to delete the only remaining workspace", async () => {
		// Arrange
		workspacesRepo = fakeWorkspacesRepo([workspace("default")]);
		// biome-ignore lint/suspicious/noExplicitAny: fakes intentionally implement a subset
		service = new WorkspacesService(workspacesRepo as any);

		// Act & Assert
		await expect(service.delete("default")).rejects.toThrow(BadRequestError);
		expect(workspacesRepo.deleteWithCascade).not.toHaveBeenCalled();
	});

	test("throws NotFoundError for a nonexistent workspace before any cascade logic runs", async () => {
		// Act & Assert
		await expect(service.delete("missing")).rejects.toThrow(NotFoundError);
		expect(workspacesRepo.deleteWithCascade).not.toHaveBeenCalled();
	});
});

describe("WorkspacesService.getAll/getById", () => {
	let workspacesRepo: ReturnType<typeof fakeWorkspacesRepo>;
	let service: WorkspacesService;

	beforeEach(() => {
		workspacesRepo = fakeWorkspacesRepo([workspace("default")]);
		// biome-ignore lint/suspicious/noExplicitAny: fakes intentionally implement a subset
		service = new WorkspacesService(workspacesRepo as any);
	});

	test("getAll delegates directly to the repository", async () => {
		// Act
		const result = await service.getAll();

		// Assert
		expect(result).toEqual([workspace("default")]);
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
	let service: WorkspacesService;

	beforeEach(() => {
		workspacesRepo = fakeWorkspacesRepo([workspace("default")]);
		// biome-ignore lint/suspicious/noExplicitAny: fakes intentionally implement a subset
		service = new WorkspacesService(workspacesRepo as any);
	});

	test("create delegates to the repository", async () => {
		// Arrange
		workspacesRepo.create.mockResolvedValue(workspace("media"));

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
			...workspace("default"),
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
	let service: WorkspacesService;

	beforeEach(() => {
		workspacesRepo = fakeWorkspacesRepo([
			workspace("default"),
			workspace("media"),
		]);
		// biome-ignore lint/suspicious/noExplicitAny: fakes intentionally implement a subset
		service = new WorkspacesService(workspacesRepo as any);
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
