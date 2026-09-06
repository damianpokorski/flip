<script lang="ts">
import { bucketFor } from "@flip/store/health-bucket";
import StatusDot from "./StatusDot.svelte";

let {
	ms,
	withDot = false,
	size = "xs",
	align,
	width,
}: {
	ms: number | null;
	withDot?: boolean;
	size?: "sm" | "xs" | "2xs";
	align?: "right";
	width?: number;
} = $props();

const BUCKET_VAR = {
	fast: "var(--health-fast)",
	ok: "var(--health-ok)",
	slow: "var(--health-slow)",
	down: "var(--health-down)",
} as const;

const FONT_SIZE_VAR = {
	sm: "var(--t-mono-sm)",
	xs: "var(--t-mono-xs)",
	"2xs": "var(--t-mono-2xs)",
} as const;
</script>

<span
	class="latency"
	class:right={align === "right"}
	style:width={width ? `${width}px` : undefined}
	style:font-size={FONT_SIZE_VAR[size]}
	style:color={BUCKET_VAR[bucketFor(ms)]}
>
	{#if withDot}<StatusDot {ms} />{/if}
	{ms == null ? "down" : `${ms}ms`}
</span>

<style>
	.latency {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-2);
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
	}
	.latency.right {
		justify-content: flex-end;
	}
</style>
