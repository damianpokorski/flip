import { beforeEach, describe, expect, mock, test } from "bun:test";

const envState: { PROXY_DOMAIN?: string; NODE_ENV: string } = {
	PROXY_DOMAIN: undefined,
	NODE_ENV: "development",
};
mock.module("@flip/env/server", () => ({ env: envState }));

const { ConfigService } = await import("./ConfigService");

function fakeRepo(config: Record<string, unknown>) {
	return {
		get: mock(async () => config),
		readRaw: mock(async () => ({
			content: "healthCheckTimeoutMs: 5000\n",
			updatedAt: "2026-01-01T00:00:00.000Z",
		})),
	};
}

describe("ConfigService.get", () => {
	beforeEach(() => {
		envState.PROXY_DOMAIN = undefined;
		envState.NODE_ENV = "development";
	});

	test("merges the stored config with proxyDomain: null when PROXY_DOMAIN is unset", async () => {
		// Arrange
		const repo = fakeRepo({ healthCheckTimeoutMs: 5000 });
		// biome-ignore lint/suspicious/noExplicitAny: fake intentionally implements a subset
		const service = new ConfigService(repo as any);

		// Act
		const result = await service.get();

		// Assert
		expect(result.proxyDomain).toBeNull();
	});

	test("surfaces PROXY_DOMAIN when set", async () => {
		// Arrange
		envState.PROXY_DOMAIN = "flip.home.lan";
		const repo = fakeRepo({ healthCheckTimeoutMs: 5000 });
		// biome-ignore lint/suspicious/noExplicitAny: fake intentionally implements a subset
		const service = new ConfigService(repo as any);

		// Act
		const result = await service.get();

		// Assert
		expect(result.proxyDomain).toBe("flip.home.lan");
	});

	test("resolves proxyPort to the dev port outside production", async () => {
		// Arrange
		envState.NODE_ENV = "development";
		const repo = fakeRepo({});
		// biome-ignore lint/suspicious/noExplicitAny: fake intentionally implements a subset
		const service = new ConfigService(repo as any);

		// Act
		const result = await service.get();

		// Assert
		expect(result.proxyPort).toBe(8080);
	});

	test("resolves proxyPort to the prod port in production", async () => {
		// Arrange
		envState.NODE_ENV = "production";
		const repo = fakeRepo({});
		// biome-ignore lint/suspicious/noExplicitAny: fake intentionally implements a subset
		const service = new ConfigService(repo as any);

		// Act
		const result = await service.get();

		// Assert
		expect(result.proxyPort).toBe(80);
	});

	test("passes through the stored config's own fields", async () => {
		// Arrange
		const repo = fakeRepo({
			healthCheckTimeoutMs: 1234,
			maxParallelFrameLoads: 7,
			uiScale: 1.5,
		});
		// biome-ignore lint/suspicious/noExplicitAny: fake intentionally implements a subset
		const service = new ConfigService(repo as any);

		// Act
		const result = await service.get();

		// Assert
		expect(result).toMatchObject({
			healthCheckTimeoutMs: 1234,
			maxParallelFrameLoads: 7,
			uiScale: 1.5,
		});
	});
});

describe("ConfigService.readRaw", () => {
	test("delegates to the repository", async () => {
		// Arrange
		const repo = fakeRepo({});
		// biome-ignore lint/suspicious/noExplicitAny: fake intentionally implements a subset
		const service = new ConfigService(repo as any);

		// Act
		const result = await service.readRaw();

		// Assert
		expect(result.content).toContain("healthCheckTimeoutMs");
		expect(repo.readRaw).toHaveBeenCalled();
	});
});
