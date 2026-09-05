import { beforeEach, describe, expect, mock, test } from "bun:test";

const getAllMock = mock();
const getByIdMock = mock();
const createMock = mock();
const updateMock = mock();
const deleteMock = mock();
const reorderMock = mock();
const allServiceMocks = [
	getAllMock,
	getByIdMock,
	createMock,
	updateMock,
	deleteMock,
	reorderMock,
];

// Must run before the controller is imported: it builds `new PanelsService(new
// PanelsRepository(), ...)` and `new HealthCheckService(...)` at module scope, so all three
// need to be faked first.
mock.module("../services/PanelsService", () => ({
	PanelsService: class {
		getAll = getAllMock;
		getById = getByIdMock;
		create = createMock;
		update = updateMock;
		delete = deleteMock;
		reorder = reorderMock;
	},
}));
mock.module("../db/PanelsRepository", () => ({
	PanelsRepository: class {},
}));
mock.module("../services/HealthCheckService", () => ({
	HealthCheckService: class {
		getStatus() {
			return { status: "unknown", latencyMs: null, lastCheckedAt: null };
		}
		start() {}
		stop() {}
	},
}));

const { panelsController } = await import("./panels");
const { NotFoundError, BadRequestError } = await import("../errors");

const samplePanel = {
	id: "1",
	title: "Example",
	url: "https://example.com",
	hidden: false,
	healthCheckUrl: null,
	healthCheckIntervalMs: null,
	health: { status: "unknown", latencyMs: null, lastCheckedAt: null },
};

beforeEach(() => {
	for (const m of allServiceMocks) m.mockReset();
});

describe("GET /panels", () => {
	test("returns all panels from the service", async () => {
		// Arrange
		getAllMock.mockResolvedValue([samplePanel]);

		// Act
		const response = await panelsController.handle(
			new Request("http://localhost/panels"),
		);
		const body = await response.json();

		// Assert
		expect(response.status).toBe(200);
		expect(body).toEqual([samplePanel]);
	});
});

describe("GET /panels/:id", () => {
	test("returns the panel when found", async () => {
		// Arrange
		getByIdMock.mockResolvedValue(samplePanel);

		// Act
		const response = await panelsController.handle(
			new Request("http://localhost/panels/1"),
		);
		const body = await response.json();

		// Assert
		expect(response.status).toBe(200);
		expect(body).toEqual(samplePanel);
		expect(getByIdMock).toHaveBeenCalledWith("1");
	});

	test("maps NotFoundError to a 404 with a message body", async () => {
		// Arrange
		getByIdMock.mockRejectedValue(new NotFoundError("Panel not found"));

		// Act
		const response = await panelsController.handle(
			new Request("http://localhost/panels/missing"),
		);
		const body = await response.json();

		// Assert
		expect(response.status).toBe(404);
		expect(body).toEqual({ message: "Panel not found" });
	});
});

describe("POST /panels", () => {
	test("passes the body through to the service and returns the created panel", async () => {
		// Arrange
		createMock.mockResolvedValue(samplePanel);
		const requestBody = { url: "https://example.com", title: "Example" };

		// Act
		const response = await panelsController.handle(
			new Request("http://localhost/panels", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(requestBody),
			}),
		);
		const body = await response.json();

		// Assert
		expect(response.status).toBe(200);
		expect(body).toEqual(samplePanel);
		expect(createMock).toHaveBeenCalledWith(
			expect.objectContaining(requestBody),
		);
	});
});

describe("PUT /panels/:id", () => {
	test("updates and returns the panel", async () => {
		// Arrange
		updateMock.mockResolvedValue(samplePanel);
		const requestBody = { url: "https://example.com", title: "Updated" };

		// Act
		const response = await panelsController.handle(
			new Request("http://localhost/panels/1", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(requestBody),
			}),
		);
		const body = await response.json();

		// Assert
		expect(response.status).toBe(200);
		expect(body).toEqual(samplePanel);
	});

	test("maps NotFoundError to a 404", async () => {
		// Arrange
		updateMock.mockRejectedValue(new NotFoundError("Panel not found"));

		// Act
		const response = await panelsController.handle(
			new Request("http://localhost/panels/missing", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ url: "https://example.com", title: "X" }),
			}),
		);
		const body = await response.json();

		// Assert
		expect(response.status).toBe(404);
		expect(body).toEqual({ message: "Panel not found" });
	});
});

describe("DELETE /panels/:id", () => {
	test("deletes and returns the panel", async () => {
		// Arrange
		deleteMock.mockResolvedValue(samplePanel);

		// Act
		const response = await panelsController.handle(
			new Request("http://localhost/panels/1", { method: "DELETE" }),
		);
		const body = await response.json();

		// Assert
		expect(response.status).toBe(200);
		expect(body).toEqual(samplePanel);
	});

	test("maps NotFoundError to a 404", async () => {
		// Arrange
		deleteMock.mockRejectedValue(new NotFoundError("Panel not found"));

		// Act
		const response = await panelsController.handle(
			new Request("http://localhost/panels/missing", { method: "DELETE" }),
		);
		const body = await response.json();

		// Assert
		expect(response.status).toBe(404);
		expect(body).toEqual({ message: "Panel not found" });
	});
});

describe("PATCH /panels/reorder", () => {
	test("reorders and returns the panel list", async () => {
		// Arrange
		reorderMock.mockResolvedValue([samplePanel]);

		// Act
		const response = await panelsController.handle(
			new Request("http://localhost/panels/reorder", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ ids: ["1"] }),
			}),
		);
		const body = await response.json();

		// Assert
		expect(response.status).toBe(200);
		expect(body).toEqual([samplePanel]);
		expect(reorderMock).toHaveBeenCalledWith(["1"]);
	});

	test("maps BadRequestError to a 400", async () => {
		// Arrange
		reorderMock.mockRejectedValue(
			new BadRequestError("ids must be exactly the set of existing panel ids"),
		);

		// Act
		const response = await panelsController.handle(
			new Request("http://localhost/panels/reorder", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ ids: ["bogus"] }),
			}),
		);
		const body = await response.json();

		// Assert
		expect(response.status).toBe(400);
		expect(body).toEqual({
			message: "ids must be exactly the set of existing panel ids",
		});
	});
});
