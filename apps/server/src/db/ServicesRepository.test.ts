import { describe, expect, mock, test } from "bun:test";

const findAllMock = mock();
const findByIdMock = mock();
const createMock = mock();
const updateMock = mock();
const deleteMock = mock();
const reorderMock = mock();
const reassignWorkspaceMock = mock();
const readRawMock = mock();
mock.module("@flip/store", () => ({
	servicesStore: {
		findAll: findAllMock,
		findById: findByIdMock,
		create: createMock,
		update: updateMock,
		delete: deleteMock,
		reorder: reorderMock,
		reassignWorkspace: reassignWorkspaceMock,
		readRaw: readRawMock,
	},
}));

const { ServicesRepository } = await import("./ServicesRepository");

describe("ServicesRepository", () => {
	test("delegates each method to the matching servicesStore function", async () => {
		// Arrange
		const repo = new ServicesRepository();

		// Act
		await repo.findAll();
		await repo.findById("1");
		await repo.create({ name: "Example" } as never);
		await repo.update("1", { name: "Renamed" });
		await repo.delete("1");
		await repo.reorder(["1", "2"]);
		await repo.reassignWorkspace("from", "to");
		await repo.readRaw();

		// Assert
		expect(findAllMock).toHaveBeenCalled();
		expect(findByIdMock).toHaveBeenCalledWith("1");
		expect(createMock).toHaveBeenCalledWith({ name: "Example" });
		expect(updateMock).toHaveBeenCalledWith("1", { name: "Renamed" });
		expect(deleteMock).toHaveBeenCalledWith("1");
		expect(reorderMock).toHaveBeenCalledWith(["1", "2"]);
		expect(reassignWorkspaceMock).toHaveBeenCalledWith("from", "to");
		expect(readRawMock).toHaveBeenCalled();
	});
});
