export type HealthBucket = "fast" | "ok" | "slow" | "down";

// Single source of truth for latency classification — imported by the server (embedded in
// API responses) and the web client (StatusDot/Latency/ServiceTile/the add-service probe
// form), so the thresholds can't drift between the two.
export function bucketFor(ms: number | null): HealthBucket {
	if (ms == null) return "down";
	if (ms < 60) return "fast";
	if (ms < 250) return "ok";
	return "slow";
}
