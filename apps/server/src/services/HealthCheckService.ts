import { configStore } from "@flip/store";
import type { PanelsRepository } from "../db/PanelsRepository";
import { notifyHealthChanged } from "../events";

export type HealthState = "up" | "down" | "unknown";

export interface HealthStatus {
	status: HealthState;
	latencyMs: number | null;
	lastCheckedAt: string | null;
}

interface HealthRecord extends HealthStatus {
	lastCheckedAtMs: number;
}

const UNKNOWN_HEALTH: HealthStatus = {
	status: "unknown",
	latencyMs: null,
	lastCheckedAt: null,
};

// Runs a single scheduler tick (rather than one setInterval per panel) that checks each
// panel's target URL once its own interval has elapsed. Status is kept in memory only —
// deliberately never persisted to YAML, so config files stay stable/human-diffable and
// don't race with the file watcher. Status resets to "unknown" on every restart, which is
// an accepted tradeoff for a personal-scale tool.
const TICK_MS = 5_000;

export class HealthCheckService {
	private readonly statuses = new Map<string, HealthRecord>();
	private timer: ReturnType<typeof setInterval> | undefined;

	constructor(private readonly repo: PanelsRepository) {}

	getStatus(id: string): HealthStatus {
		const record = this.statuses.get(id);
		if (!record) return UNKNOWN_HEALTH;
		const { lastCheckedAtMs: _, ...status } = record;
		return status;
	}

	start(): void {
		if (this.timer) return;
		this.timer = setInterval(() => {
			this.tick().catch((err) =>
				console.error("[HealthCheckService] tick failed", err),
			);
		}, TICK_MS);
		// Kick off an immediate first tick instead of waiting a full TICK_MS before the
		// first status is known.
		this.tick().catch((err) =>
			console.error("[HealthCheckService] tick failed", err),
		);
	}

	stop(): void {
		clearInterval(this.timer);
		this.timer = undefined;
	}

	private async tick(): Promise<void> {
		const [panels, config] = await Promise.all([
			this.repo.findAll(),
			configStore.get(),
		]);
		const now = Date.now();
		const changed: Record<string, HealthStatus> = {};

		await Promise.all(
			panels.map(async (panel) => {
				const intervalMs =
					panel.healthCheckIntervalMs ?? config.healthCheckIntervalMs;
				const existing = this.statuses.get(panel.id);
				if (existing && now - existing.lastCheckedAtMs < intervalMs) return;

				const target = panel.healthCheckUrl ?? panel.url;
				const startedAt = performance.now();
				let status: HealthState;
				let latencyMs: number | null;
				try {
					await fetch(target, {
						signal: AbortSignal.timeout(config.healthCheckTimeoutMs),
					});
					// Many self-hosted dashboards redirect or return non-2xx on their root page —
					// any response at all (not a timeout/network error) counts as "up".
					status = "up";
					latencyMs = Math.round(performance.now() - startedAt);
				} catch {
					status = "down";
					latencyMs = null;
				}
				const record: HealthRecord = {
					status,
					latencyMs,
					lastCheckedAt: new Date().toISOString(),
					lastCheckedAtMs: now,
				};
				this.statuses.set(panel.id, record);
				changed[panel.id] = {
					status,
					latencyMs,
					lastCheckedAt: record.lastCheckedAt,
				};
			}),
		);

		if (Object.keys(changed).length > 0) notifyHealthChanged(changed);
	}
}
