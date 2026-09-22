import { TILE_HUES, type TileHue } from "./schemas/service";

// Deterministic per-name colour assignment for services whose `hue` is unset ("auto") — lets a
// hand-edited config.yaml omit the field entirely and still render sensibly, and gives an even
// spread across many services without anyone having to pick a distinct colour per entry. DJB2
// string hash, normalized to lowercase so incidental case edits don't change the result. "Even
// spread" is only statistical across many distinct names, not a zero-collision guarantee for a
// handful of them.
export function hueFor(name: string): TileHue {
	const normalized = name.trim().toLowerCase();
	let hash = 5381;
	for (let i = 0; i < normalized.length; i++) {
		hash = (hash * 33) ^ normalized.charCodeAt(i);
	}
	const index = Math.abs(hash) % TILE_HUES.length;
	// biome-ignore lint/style/noNonNullAssertion: index is always < TILE_HUES.length
	return TILE_HUES[index]!;
}
