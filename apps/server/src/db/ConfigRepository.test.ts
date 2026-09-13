import { describe, expect, mock, test } from "bun:test";

const getMock = mock();
const readRawMock = mock();
mock.module("@flip/store", () => ({
	configStore: { get: getMock, readRaw: readRawMock },
}));

const { ConfigRepository } = await import("./ConfigRepository");

describe("ConfigRepository", () => {
	test("get() delegates to configStore.get()", async () => {
		// Arrange
		const config = {
			healthCheckTimeoutMs: 5000,
			maxParallelFrameLoads: 3,
			uiScale: 1,
		};
		getMock.mockResolvedValue(config);
		const repo = new ConfigRepository();

		// Act
		const result = await repo.get();

		// Assert
		expect(result).toBe(config);
		expect(getMock).toHaveBeenCalled();
	});

	test("readRaw() delegates to configStore.readRaw()", async () => {
		// Arrange
		const raw = { content: "healthCheckTimeoutMs: 5000\n", updatedAt: "now" };
		readRawMock.mockResolvedValue(raw);
		const repo = new ConfigRepository();

		// Act
		const result = await repo.readRaw();

		// Assert
		expect(result).toBe(raw);
	});
});
