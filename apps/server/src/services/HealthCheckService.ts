import { env } from "@flip/env/server";
import { bucketFor, configStore, type HealthBucket, parseCodes, parseEvery } from "@flip/store";
import type { ServicesRepository } from "../db/ServicesRepository";
import { notifyHealthChanged } from "../events";

export interface HealthStatus {
  ms: number | null;
  lastCheckedAt: string | null;
  bucket: HealthBucket;
}

interface HealthRecord extends HealthStatus {
  lastCheckedAtMs: number;
}

const UNKNOWN_HEALTH: HealthStatus = {
  ms: null,
  lastCheckedAt: null,
  bucket: "down",
};

// Runs a single scheduler tick (rather than one setInterval per service) that checks each
// service's target URL once its own `every` interval has elapsed. Status is kept in memory
// only — deliberately never persisted to YAML, so config files stay stable/human-diffable
// and don't race with the file watcher. Status resets to "unknown"-shaped (down/null) on
// every restart, which is an accepted tradeoff for a personal-scale tool.
const TICK_MS = 5_000;

export class HealthCheckService {
  private readonly statuses = new Map<string, HealthRecord>();
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(private readonly repo: ServicesRepository) {}

  getStatus(id: string): HealthStatus {
    const record = this.statuses.get(id);
    if (!record) return UNKNOWN_HEALTH;
    const { lastCheckedAtMs: _, ...status } = record;
    return status;
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.tick().catch((err) => console.error("[HealthCheckService] tick failed", err));
    }, TICK_MS);
    // Kick off an immediate first tick instead of waiting a full TICK_MS before the
    // first status is known.
    this.tick().catch((err) => console.error("[HealthCheckService] tick failed", err));
  }

  stop(): void {
    clearInterval(this.timer);
    this.timer = undefined;
  }

  private async tick(): Promise<void> {
    const [services, config] = await Promise.all([this.repo.findAll(), configStore.get()]);
    const now = Date.now();
    const changed: Record<string, HealthStatus> = {};

    await Promise.all(
      services.map(async (service) => {
        const intervalMs = parseEvery(service.every);
        const existing = this.statuses.get(service.id);
        if (existing && now - existing.lastCheckedAtMs < intervalMs) return;

        // A locally-hosted site's `url`/`healthCheckUrl` is a same-origin relative path
        // (e.g. "/api/sites/demo/") rather than an absolute URL — resolve it against this
        // same process's own loopback listener rather than the outside world.
        const rawTarget = service.healthCheckUrl ?? service.url;
        const target = rawTarget.startsWith("/")
          ? `http://127.0.0.1:${env.PORT}${rawTarget}`
          : rawTarget;
        const okCodes = parseCodes(service.codes);
        const startedAt = performance.now();
        let ms: number | null;
        try {
          const response = await fetch(target, {
            signal: AbortSignal.timeout(config.healthCheckTimeoutMs),
          });
          // A response outside the configured OK codes counts as down, same as a
          // timeout/network error — the codes list is the whole up/down contract.
          ms = okCodes.includes(response.status) ? Math.round(performance.now() - startedAt) : null;
        } catch {
          ms = null;
        }
        const record: HealthRecord = {
          ms,
          lastCheckedAt: new Date().toISOString(),
          bucket: bucketFor(ms),
          lastCheckedAtMs: now,
        };
        this.statuses.set(service.id, record);
        changed[service.id] = {
          ms,
          lastCheckedAt: record.lastCheckedAt,
          bucket: record.bucket,
        };
      }),
    );

    if (Object.keys(changed).length > 0) notifyHealthChanged(changed);
  }
}
