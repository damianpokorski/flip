import { describe, expect, mock, test } from "bun:test";

const findAllMock = mock();
const findByIdMock = mock();
const createMock = mock();
const updateMock = mock();
const deleteMock = mock();
const reorderMock = mock();
mock.module("@flip/store", () => ({
	servicesStore: {
		findAll: findAllMock,
		findById: findByIdMock,
		create: createMock,
		update: updateMock,
		delete: deleteMock,
		reorder: reorderMock,
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
		await repo.reorder("default", ["1", "2"]);

		// Assert
		expect(findAllMock).toHaveBeenCalled();
		expect(findByIdMock).toHaveBeenCalledWith("1");
		expect(createMock).toHaveBeenCalledWith({ name: "Example" });
		expect(updateMock).toHaveBeenCalledWith("1", { name: "Renamed" });
		expect(deleteMock).toHaveBeenCalledWith("1");
		expect(reorderMock).toHaveBeenCalledWith("default", ["1", "2"]);
	});
});
