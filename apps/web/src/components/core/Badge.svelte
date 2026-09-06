<script lang="ts">
import type { Snippet } from "svelte";

let {
	children,
	tone = "neutral",
	upper = false,
}: {
	children: Snippet;
	tone?: "neutral" | "accent" | "drag" | "quiet";
	upper?: boolean;
} = $props();
</script>

<span class="badge" class:accent={tone === "accent"} class:drag={tone === "drag"} class:quiet={tone === "quiet"} class:upper>
	{@render children()}
</span>

<style>
	.badge {
		display: inline-flex;
		align-items: center;
		padding: 3px var(--sp-6);
		border-radius: var(--r-sm);
		background: var(--bg-panel);
		border: var(--stroke-hair) solid var(--border-mid);
		color: var(--text-3);
		font-family: var(--font-display);
		font-size: var(--t-label-xs);
		font-weight: var(--w-medium);
		letter-spacing: var(--track-wide);
		white-space: nowrap;
	}
	.badge.upper {
		letter-spacing: var(--track-head);
		text-transform: uppercase;
	}
	.badge.accent {
		background: var(--accent-fill);
		border-color: var(--accent-line);
		color: var(--accent);
	}
	.badge.drag {
		background: var(--drag-fill);
		border-color: var(--drag-line);
		color: var(--drag);
	}
	.badge.quiet {
		background: transparent;
		border-color: transparent;
		color: var(--text-4);
	}
</style>
