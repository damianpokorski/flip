import { describe, expect, mock, test } from "bun:test";

const findAllMock = mock();
const findByIdMock = mock();
const createMock = mock();
const updateMock = mock();
const deleteMock = mock();
const reorderMock = mock();
const readRawMock = mock();
mock.module("@flip/store", () => ({
	workspacesStore: {
		findAll: findAllMock,
		findById: findByIdMock,
		create: createMock,
		update: updateMock,
		delete: deleteMock,
		reorder: reorderMock,
		readRaw: readRawMock,
	},
}));

const { WorkspacesRepository } = await import("./WorkspacesRepository");

describe("WorkspacesRepository", () => {
	test("delegates each method to the matching workspacesStore function", async () => {
		// Arrange
		const repo = new WorkspacesRepository();

		// Act
		await repo.findAll();
		await repo.findById("default");
		await repo.create({ name: "Media", label: "MD" });
		await repo.update("default", { name: "Renamed", label: "RN" });
		await repo.delete("default");
		await repo.reorder(["a", "b"]);
		await repo.readRaw();

		// Assert
		expect(findAllMock).toHaveBeenCalled();
		expect(findByIdMock).toHaveBeenCalledWith("default");
		expect(createMock).toHaveBeenCalledWith({ name: "Media", label: "MD" });
		expect(updateMock).toHaveBeenCalledWith("default", {
			name: "Renamed",
			label: "RN",
		});
		expect(deleteMock).toHaveBeenCalledWith("default");
		expect(reorderMock).toHaveBeenCalledWith(["a", "b"]);
		expect(readRawMock).toHaveBeenCalled();
	});
});
