import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { bucketFor, parseCodes, parseEvery } from "@flip/store";

// Static imports are hoisted above mock.module(), so these resolve against the real,
// unmocked @flip/store — only the dynamically-imported HealthCheckService below sees the
// mocked configStore.
const configGetMock = mock();
mock.module("@flip/store", () => ({
	bucketFor,
	parseCodes,
	parseEvery,
	configStore: { get: configGetMock },
}));

const { HealthCheckService } = await import("./HealthCheckService");

const originalFetch = global.fetch;

function service(overrides: Partial<Record<string, unknown>> = {}) {
	return {
		id: "1",
		name: "Example",
		url: "https://example.com",
		healthCheckUrl: null,
		codes: "200",
		every: "30s",
		...overrides,
	};
}

describe("HealthCheckService", () => {
	beforeEach(() => {
		configGetMock.mockReset();
		configGetMock.mockResolvedValue({ healthCheckTimeoutMs: 5000 });
	});

	afterEach(() => {
		global.fetch = originalFetch;
	});

	test("a response whose status is in `codes` is up, bucketed by latency", async () => {
		// Arrange
		global.fetch = (async () =>
			new Response("", { status: 200 })) as unknown as typeof fetch;
		const repo = { findAll: async () => [service()] };
		const health = new HealthCheckService(repo as never);

		// Act
		await (health as unknown as { tick: () => Promise<void> }).tick();
		const status = health.getStatus("1");

		// Assert
		expect(status.ms).not.toBeNull();
		expect(status.bucket).toBe(bucketFor(status.ms));
	});

	test("a response whose status is NOT in `codes` counts as down", async () => {
		// Arrange — service only accepts 200, but the server returns 500
		global.fetch = (async () =>
			new Response("", { status: 500 })) as unknown as typeof fetch;
		const repo = { findAll: async () => [service({ codes: "200" })] };
		const health = new HealthCheckService(repo as never);

		// Act
		await (health as unknown as { tick: () => Promise<void> }).tick();
		const status = health.getStatus("1");

		// Assert
		expect(status.ms).toBeNull();
		expect(status.bucket).toBe("down");
	});

	test("a response matching a non-default `codes` entry is up", async () => {
		// Arrange — service explicitly accepts 401 (e.g. an auth-gated dashboard)
		global.fetch = (async () =>
			new Response("", { status: 401 })) as unknown as typeof fetch;
		const repo = { findAll: async () => [service({ codes: "200, 401" })] };
		const health = new HealthCheckService(repo as never);

		// Act
		await (health as unknown as { tick: () => Promise<void> }).tick();
		const status = health.getStatus("1");

		// Assert
		expect(status.ms).not.toBeNull();
	});

	test("a network error/timeout counts as down", async () => {
		// Arrange
		global.fetch = (async () => {
			throw new Error("network error");
		}) as unknown as typeof fetch;
		const repo = { findAll: async () => [service()] };
		const health = new HealthCheckService(repo as never);

		// Act
		await (health as unknown as { tick: () => Promise<void> }).tick();
		const status = health.getStatus("1");

		// Assert
		expect(status.ms).toBeNull();
		expect(status.bucket).toBe("down");
	});

	test("checks healthCheckUrl instead of url when set", async () => {
		// Arrange
		let requestedUrl: string | undefined;
		global.fetch = (async (url: string) => {
			requestedUrl = url;
			return new Response("", { status: 200 });
		}) as unknown as typeof fetch;
		const repo = {
			findAll: async () => [
				service({
					url: "https://main.home.lan",
					healthCheckUrl: "https://main.home.lan/health",
				}),
			],
		};
		const health = new HealthCheckService(repo as never);

		// Act
		await (health as unknown as { tick: () => Promise<void> }).tick();

		// Assert
		expect(requestedUrl).toBe("https://main.home.lan/health");
	});

	test("an unchecked service reports down/unknown-shaped status", () => {
		// Arrange
		const repo = { findAll: async () => [] };
		const health = new HealthCheckService(repo as never);

		// Act
		const status = health.getStatus("never-checked");

		// Assert
		expect(status).toEqual({ ms: null, lastCheckedAt: null, bucket: "down" });
	});

	test("does not re-check a service before its own `every` interval has elapsed", async () => {
		// Arrange
		let callCount = 0;
		global.fetch = (async () => {
			callCount += 1;
			return new Response("", { status: 200 });
		}) as unknown as typeof fetch;
		const repo = { findAll: async () => [service({ every: "1h" })] };
		const health = new HealthCheckService(repo as never);

		// Act
		await (health as unknown as { tick: () => Promise<void> }).tick();
		await (health as unknown as { tick: () => Promise<void> }).tick();

		// Assert
		expect(callCount).toBe(1);
	});
});
