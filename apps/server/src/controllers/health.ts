import { Elysia, t } from "elysia";
import { telemetrySnapshot } from "../telemetry";

const HealthReport = t.Object({
	status: t.Union([t.Literal("ok"), t.Literal("degraded")]),
	problems: t.Array(t.String()),
	uptimeS: t.Number(),
	rssMb: t.Number(),
	heapMb: t.Number(),
	eventLoopLagMs: t.Number(),
	eventLoopLagMaxMs: t.Number(),
	caddyAlive: t.Boolean(),
	lastHealthTickAt: t.Nullable(t.String()),
	inFlightChecks: t.Number(),
	sseClients: t.Number(),
	eventListeners: t.Number(),
	openFds: t.Nullable(t.Number()),
});

// Backs the Docker HEALTHCHECK (which only looks at the status code) and doubles as a
// human-readable diagnostics dump when the container misbehaves — 503 when a component
// FLIP depends on is gone or stalled, so the HEALTHCHECK catches more than "port is open".
export const healthController = new Elysia().model({ HealthReport }).get(
	"/health",
	({ set }) => {
		const report = telemetrySnapshot();
		if (report.status !== "ok") set.status = 503;
		return report;
	},
	{ response: { 200: "HealthReport", 503: "HealthReport" } },
);
