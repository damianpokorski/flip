import { beforeEach, describe, expect, mock, test } from "bun:test";

const getMock = mock();
const readRawMock = mock();

// Must run before the controller is imported: it builds `new ConfigService(...)` at module
// scope, so the collaborator needs to be faked first.
mock.module("../services/ConfigService", () => ({
	ConfigService: class {
		get = getMock;
		readRaw = readRawMock;
	},
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
};

beforeEach(() => {
	getMock.mockReset();
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
