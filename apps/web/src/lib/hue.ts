import type { TileHue } from "@flip/store";

export function hueVar(hue: TileHue): string {
	return `var(--tile-${hue})`;
}
