import { beforeEach, describe, expect, mock, test } from "bun:test";

const getAllMock = mock();
const getByIdMock = mock();
const createMock = mock();
const updateMock = mock();
const deleteMock = mock();
const reorderMock = mock();
const readRawMock = mock();
const allServiceMocks = [
	getAllMock,
	getByIdMock,
	createMock,
	updateMock,
	deleteMock,
	reorderMock,
	readRawMock,
];

mock.module("../services/WorkspacesService", () => ({
	WorkspacesService: class {
		getAll = getAllMock;
		getById = getByIdMock;
		create = createMock;
		update = updateMock;
		delete = deleteMock;
		reorder = reorderMock;
		readRaw = readRawMock;
	},
}));
mock.module("../db/WorkspacesRepository", () => ({
	WorkspacesRepository: class {},
}));
mock.module("../db/ServicesRepository", () => ({
	ServicesRepository: class {},
}));

const { workspacesController } = await import("./workspaces");
const { NotFoundError, BadRequestError } = await import("../errors");

const sampleWorkspace = { id: "default", name: "DEFAULT", label: "DF" };

beforeEach(() => {
	for (const m of allServiceMocks) m.mockReset();
});

describe("GET /workspaces", () => {
	test("returns all workspaces from the service layer", async () => {
		// Arrange
		getAllMock.mockResolvedValue([sampleWorkspace]);

		// Act
		const response = await workspacesController.handle(
			new Request("http://localhost/workspaces"),
		);
		const body = await response.json();

		// Assert
		expect(response.status).toBe(200);
		expect(body).toEqual([sampleWorkspace]);
	});
});

describe("GET /workspaces/:id", () => {
	test("maps NotFoundError to a 404", async () => {
		// Arrange
		getByIdMock.mockRejectedValue(new NotFoundError("Workspace not found"));

		// Act
		const response = await workspacesController.handle(
			new Request("http://localhost/workspaces/missing"),
		);
		const body = await response.json();

		// Assert
		expect(response.status).toBe(404);
		expect(body).toEqual({ message: "Workspace not found" });
	});
});

describe("POST /workspaces", () => {
	test("creates and returns the workspace", async () => {
		// Arrange
		createMock.mockResolvedValue(sampleWorkspace);
		const requestBody = { name: "DEFAULT", label: "DF" };

		// Act
		const response = await workspacesController.handle(
			new Request("http://localhost/workspaces", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(requestBody),
			}),
		);
		const body = await response.json();

		// Assert
		expect(response.status).toBe(200);
		expect(body).toEqual(sampleWorkspace);
	});
});

describe("DELETE /workspaces/:id", () => {
	test("deletes and returns the workspace (member services are reassigned elsewhere)", async () => {
		// Arrange
		deleteMock.mockResolvedValue(sampleWorkspace);

		// Act
		const response = await workspacesController.handle(
			new Request("http://localhost/workspaces/default", { method: "DELETE" }),
		);
		const body = await response.json();

		// Assert
		expect(response.status).toBe(200);
		expect(body).toEqual(sampleWorkspace);
	});
});

describe("PATCH /workspaces/reorder", () => {
	test("maps BadRequestError to a 400", async () => {
		// Arrange
		reorderMock.mockRejectedValue(
			new BadRequestError(
				"ids must be exactly the set of existing workspace ids",
			),
		);

		// Act
		const response = await workspacesController.handle(
			new Request("http://localhost/workspaces/reorder", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ ids: ["bogus"] }),
			}),
		);
		const body = await response.json();

		// Assert
		expect(response.status).toBe(400);
		expect(body).toEqual({
			message: "ids must be exactly the set of existing workspace ids",
		});
	});
});
