const UNIT_MS: Record<string, number> = {
	ms: 1,
	s: 1_000,
	m: 60_000,
	h: 3_600_000,
};

const INTERVAL_PATTERN = /^(\d+)(ms|s|m|h)$/;

// "30s" -> 30000, "5m" -> 300000, "500ms" -> 500, "2h" -> 7200000.
export function parseEvery(every: string): number {
	const match = INTERVAL_PATTERN.exec(every.trim());
	if (!match) throw new Error(`Invalid interval string: "${every}"`);
	const [, amount, unit] = match;
	// biome-ignore lint/style/noNonNullAssertion: unit is constrained by INTERVAL_PATTERN to a UNIT_MS key
	return Number(amount) * UNIT_MS[unit!]!;
}
