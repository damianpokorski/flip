<script lang="ts">
import type { TileHue } from "@flip/store";
import { hueVar } from "$lib/hue";

let {
	text,
	hue,
	size = "sm",
	inset = false,
}: {
	text: string;
	hue: TileHue;
	size?: "lg" | "md" | "sm" | "xs";
	inset?: boolean;
} = $props();

const SIZE_VAR = {
	lg: { box: "var(--size-tile-lg)", radius: "var(--r-row)", font: "10px" },
	md: { box: "var(--size-tile-md)", radius: "var(--r-xs)", font: "8px" },
	sm: { box: "var(--size-tile-sm)", radius: "var(--r-xs)", font: "7.5px" },
	xs: { box: "var(--size-tile-xs)", radius: "4px", font: "6.5px" },
} as const;
</script>

<span
	class="mark"
	class:inset
	style:width={SIZE_VAR[size].box}
	style:height={SIZE_VAR[size].box}
	style:border-radius={SIZE_VAR[size].radius}
	style:font-size={SIZE_VAR[size].font}
	style:color={hueVar(hue)}
>
	{text}
</span>

<style>
	.mark {
		flex: none;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bg-tile);
		border: var(--stroke-hair) solid var(--border-hair);
		font-family: var(--font-mono);
		font-weight: var(--w-bold);
	}
	.mark.inset {
		background: var(--bg-tile-inset);
	}
</style>
