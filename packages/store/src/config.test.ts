import { afterAll, describe, expect, mock, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const tmpDir = mkdtempSync(path.join(os.tmpdir(), "flip-config-store-"));
mock.module("@flip/env/server", () => ({ env: { DATA_DIR: tmpDir } }));

const { configStore } = await import("./config");

afterAll(() => {
	rmSync(tmpDir, { recursive: true, force: true });
});

describe("configStore", () => {
	test("ensureExists seeds the default config", async () => {
		// Act
		await configStore.ensureExists();
		const config = await configStore.get();

		// Assert
		expect(config).toEqual({
			healthCheckTimeoutMs: 5000,
			maxParallelFrameLoads: 3,
			uiScale: 1,
		});
	});

	test("update patches only the given fields", async () => {
		// Act
		const updated = await configStore.update({ uiScale: 1.25 });

		// Assert
		expect(updated.uiScale).toBe(1.25);
		expect(updated.healthCheckTimeoutMs).toBe(5000);
	});

	test("readRaw returns the live file text", async () => {
		// Act
		const raw = await configStore.readRaw();

		// Assert
		expect(raw.content).toContain("FLIP configuration");
	});

	test("watch returns a stop function", () => {
		// Act
		const stop = configStore.watch();

		// Assert
		expect(typeof stop).toBe("function");
		stop();
	});

	test("onChange registers a listener and returns an unsubscribe function", () => {
		// Act
		const unsubscribe = configStore.onChange(() => {});

		// Assert
		expect(typeof unsubscribe).toBe("function");
		unsubscribe();
	});
});
