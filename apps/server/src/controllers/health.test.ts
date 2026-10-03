import { afterEach, describe, expect, test } from "bun:test";
import {
	startTelemetry,
	stopTelemetry,
	type TelemetrySnapshot,
} from "../telemetry";
import { healthController } from "./health";

function sources(
	overrides: {
		caddyAlive?: boolean;
		running?: boolean;
		lastTickAt?: number | null;
	} = {},
) {
	return {
		health: {
			running: overrides.running ?? true,
			lastTickAt:
				overrides.lastTickAt === undefined ? Date.now() : overrides.lastTickAt,
			inFlightCount: 0,
		},
		caddy: { isAlive: overrides.caddyAlive ?? true },
		healthTickStaleMs: 30_000,
	};
}

async function getHealth() {
	const response = await healthController.handle(
		new Request("http://localhost/health"),
	);
	return {
		status: response.status,
		body: (await response.json()) as TelemetrySnapshot,
	};
}

describe("GET /health", () => {
	afterEach(() => {
		stopTelemetry();
	});

	test("returns 200 ok with diagnostics when every component is healthy", async () => {
		// Arrange
		startTelemetry(sources());

		// Act
		const { status, body } = await getHealth();

		// Assert
		expect(status).toBe(200);
		expect(body.status).toBe("ok");
		expect(body.problems).toEqual([]);
		expect(body.caddyAlive).toBe(true);
		expect(typeof body.rssMb).toBe("number");
	});

	test("returns 503 degraded when caddy is not running", async () => {
		// Arrange
		startTelemetry(sources({ caddyAlive: false }));

		// Act
		const { status, body } = await getHealth();

		// Assert
		expect(status).toBe(503);
		expect(body.status).toBe("degraded");
		expect(body.problems).toContain("caddy is not running");
	});

	test("returns 503 degraded when the health-check scheduler has stalled", async () => {
		// Arrange
		startTelemetry(sources({ lastTickAt: Date.now() - 60_000 }));

		// Act
		const { status, body } = await getHealth();

		// Assert
		expect(status).toBe(503);
		expect(body.problems[0]).toContain("health-check scheduler");
	});

	test("ignores health-check staleness when health checks are disabled", async () => {
		// Arrange
		startTelemetry(sources({ running: false, lastTickAt: null }));

		// Act
		const { status } = await getHealth();

		// Assert
		expect(status).toBe(200);
	});
});
