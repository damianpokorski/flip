import { describe, expect, mock, test } from "bun:test";

const getMock = mock();
const updateMock = mock();
const readRawMock = mock();
mock.module("@flip/store", () => ({
	configStore: { get: getMock, update: updateMock, readRaw: readRawMock },
}));

const { ConfigRepository } = await import("./ConfigRepository");

describe("ConfigRepository", () => {
	test("get() delegates to configStore.get()", async () => {
		// Arrange
		const config = {
			healthCheckTimeoutMs: 5000,
			maxParallelFrameLoads: 3,
			uiScale: 1,
			theme: "catppuccin-mocha" as const,
		};
		getMock.mockResolvedValue(config);
		const repo = new ConfigRepository();

		// Act
		const result = await repo.get();

		// Assert
		expect(result).toBe(config);
		expect(getMock).toHaveBeenCalled();
	});

	test("update() delegates to configStore.update()", async () => {
		// Arrange
		const updated = {
			healthCheckTimeoutMs: 5000,
			maxParallelFrameLoads: 3,
			uiScale: 1,
			theme: "nord" as const,
		};
		updateMock.mockResolvedValue(updated);
		const repo = new ConfigRepository();

		// Act
		const result = await repo.update({ theme: "nord" });

		// Assert
		expect(result).toBe(updated);
		expect(updateMock).toHaveBeenCalledWith({ theme: "nord" });
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
