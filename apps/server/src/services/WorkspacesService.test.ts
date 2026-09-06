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
