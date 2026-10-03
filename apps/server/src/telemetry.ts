import { readdirSync } from "node:fs";
import { dataEvents } from "./events";

// Lightweight, dependency-free runtime telemetry: enough to tell *which* layer is stuck when
// the container stops responding (event loop blocked? Caddy gone? health checks stalled? a
// slow leak in sockets/listeners/memory?) — not a metrics stack. Surfaced through
// /api/health and a periodic `[stats]` log line so `docker logs` shows the trend leading up
// to a hang.

const LAG_SAMPLE_MS = 1_000;
const STATS_LOG_MS = 5 * 60_000;

export interface TelemetrySources {
	health: {
		readonly running: boolean;
		readonly lastTickAt: number | null;
		readonly inFlightCount: number;
	};
	caddy: { readonly isAlive: boolean };
	// How long the health-check scheduler may go without completing a tick before
	// /api/health reports the process as degraded.
	healthTickStaleMs: number;
}

export interface TelemetrySnapshot {
	status: "ok" | "degraded";
	problems: string[];
	uptimeS: number;
	rssMb: number;
	heapMb: number;
	eventLoopLagMs: number;
	eventLoopLagMaxMs: number;
	caddyAlive: boolean;
	lastHealthTickAt: string | null;
	inFlightChecks: number;
	sseClients: number;
	eventListeners: number;
	openFds: number | null;
}

let sources: TelemetrySources | undefined;
let startedAtMs = Date.now();
let lagTimer: ReturnType<typeof setInterval> | undefined;
let statsTimer: ReturnType<typeof setInterval> | undefined;
let lastLagMs = 0;
// Worst lag seen since the last `[stats]` line, so a short stall between two health polls
// still shows up rather than only whatever the most recent 1s sample happened to be.
let maxLagMs = 0;
let sseClients = 0;

// Called once per SSE connection; the returned function must run when it closes.
export function trackSseClient(): () => void {
	sseClients++;
	let released = false;
	return () => {
		if (released) return;
		released = true;
		sseClients--;
	};
}

function openFdCount(): number | null {
	// /proc only exists on Linux (i.e. the Docker image) — dev on macOS just reports null.
	try {
		return readdirSync("/proc/self/fd").length;
	} catch {
		return null;
	}
}

const toMb = (bytes: number) => Math.round((bytes / 1024 / 1024) * 10) / 10;

export function telemetrySnapshot(now = Date.now()): TelemetrySnapshot {
	const memory = process.memoryUsage();
	const problems: string[] = [];
	const caddyAlive = sources?.caddy.isAlive ?? false;
	if (sources && !caddyAlive) problems.push("caddy is not running");

	const lastTickAt = sources?.health.lastTickAt ?? null;
	if (sources?.health.running) {
		// Before the first tick completes, measure from when telemetry started instead.
		const sinceTick = now - (lastTickAt ?? startedAtMs);
		if (sinceTick > sources.healthTickStaleMs) {
			problems.push(
				`health-check scheduler has not completed a tick in ${Math.round(sinceTick / 1000)}s`,
			);
		}
	}

	return {
		status: problems.length === 0 ? "ok" : "degraded",
		problems,
		uptimeS: Math.round(process.uptime()),
		rssMb: toMb(memory.rss),
		heapMb: toMb(memory.heapUsed),
		eventLoopLagMs: lastLagMs,
		eventLoopLagMaxMs: maxLagMs,
		caddyAlive,
		lastHealthTickAt:
			lastTickAt === null ? null : new Date(lastTickAt).toISOString(),
		inFlightChecks: sources?.health.inFlightCount ?? 0,
		sseClients,
		eventListeners:
			dataEvents.listenerCount("change") + dataEvents.listenerCount("health"),
		openFds: openFdCount(),
	};
}

export function startTelemetry(telemetrySources: TelemetrySources): void {
	if (lagTimer) return;
	sources = telemetrySources;
	startedAtMs = Date.now();

	// Event-loop lag: how late a 1s interval actually fires. A synchronous stall (huge YAML
	// parse, busy loop, blocking fs call) shows up here directly.
	let expected = performance.now() + LAG_SAMPLE_MS;
	lagTimer = setInterval(() => {
		const current = performance.now();
		lastLagMs = Math.max(0, Math.round(current - expected));
		maxLagMs = Math.max(maxLagMs, lastLagMs);
		expected = current + LAG_SAMPLE_MS;
	}, LAG_SAMPLE_MS);

	statsTimer = setInterval(() => {
		const { status, problems, ...stats } = telemetrySnapshot();
		console.log("[stats]", JSON.stringify({ status, ...stats }));
		if (problems.length > 0) console.error("[stats] degraded:", problems);
		maxLagMs = 0;
	}, STATS_LOG_MS);
}

export function stopTelemetry(): void {
	clearInterval(lagTimer);
	clearInterval(statsTimer);
	lagTimer = undefined;
	statsTimer = undefined;
}
