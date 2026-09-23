import { beforeEach, describe, expect, mock, test } from "bun:test";

const getMock = mock();
const learnOriginMock = mock();
const updateMock = mock();
const readRawMock = mock();

// Must run before the controller is imported: it builds `new ConfigService(...)` at module
// scope, so the collaborator needs to be faked first.
mock.module("../services/ConfigService", () => ({
	ConfigService: class {
		get = getMock;
		update = updateMock;
		readRaw = readRawMock;
	},
}));
// Same reason as above: ./services builds real repositories/health checks at module scope.
mock.module("./services", () => ({
	caddyProxyService: { learnOrigin: learnOriginMock },
}));
mock.module("../db/ConfigRepository", () => ({
	ConfigRepository: class {},
}));

const { configController } = await import("./config");

const sampleConfig = {
	healthCheckTimeoutMs: 5000,
	maxParallelFrameLoads: 3,
	proxyDomain: null,
	proxyPort: 8080,
	uiScale: 1,
	theme: "catppuccin-mocha",
};

beforeEach(() => {
	getMock.mockReset();
	learnOriginMock.mockReset();
	updateMock.mockReset();
	readRawMock.mockReset();
});

describe("GET /config", () => {
	test("returns the app configuration from the service layer", async () => {
		// Arrange
		getMock.mockResolvedValue(sampleConfig);

		// Act
		const response = await configController.handle(
			new Request("http://localhost/config"),
		);
		const body = await response.json();

		// Assert
		expect(response.status).toBe(200);
		expect(body).toEqual(sampleConfig);
	});

	test("learns the request's Host as an allowed frame ancestor before responding", async () => {
		// Arrange
		getMock.mockResolvedValue(sampleConfig);
		const order: string[] = [];
		learnOriginMock.mockImplementation(async () => {
			order.push("learn");
		});
		getMock.mockImplementation(async () => {
			order.push("get");
			return sampleConfig;
		});

		// Act
		await configController.handle(
			new Request("http://flip.lan:8080/config", {
				headers: { host: "flip.lan:8080" },
			}),
		);

		// Assert
		expect(learnOriginMock).toHaveBeenCalledWith("flip.lan:8080");
		expect(order).toEqual(["learn", "get"]);
	});
});

describe("PATCH /config", () => {
	test("passes the body through to the service layer and returns the result", async () => {
		// Arrange
		updateMock.mockResolvedValue({ ...sampleConfig, theme: "nord" });

		// Act
		const response = await configController.handle(
			new Request("http://localhost/config", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ theme: "nord" }),
			}),
		);
		const body = await response.json();

		// Assert
		expect(response.status).toBe(200);
		expect(updateMock).toHaveBeenCalledWith({ theme: "nord" });
		expect(body).toMatchObject({ theme: "nord" });
	});

	test("rejects a theme outside the known set", async () => {
		// Act
		const response = await configController.handle(
			new Request("http://localhost/config", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ theme: "not-a-real-theme" }),
			}),
		);

		// Assert
		expect(response.status).toBe(422);
		expect(updateMock).not.toHaveBeenCalled();
	});
});

describe("GET /config/raw", () => {
	test("returns the raw config.yaml file text", async () => {
		// Arrange
		readRawMock.mockResolvedValue({
			content: "healthCheckTimeoutMs: 5000\n",
			updatedAt: "2026-01-01T00:00:00.000Z",
		});

		// Act
		const response = await configController.handle(
			new Request("http://localhost/config/raw"),
		);
		const body = await response.json();

		// Assert
		expect(response.status).toBe(200);
		expect(body).toEqual({
			content: "healthCheckTimeoutMs: 5000\n",
			updatedAt: "2026-01-01T00:00:00.000Z",
		});
	});
});
