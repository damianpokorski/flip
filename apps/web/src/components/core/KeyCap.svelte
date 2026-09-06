<script lang="ts">
import type { Snippet } from "svelte";

let { children }: { children: Snippet } = $props();
</script>

<span class="keycap">{@render children()}</span>

<style>
	.keycap {
		display: inline-flex;
		align-items: center;
		padding: 1px var(--sp-3);
		border-radius: var(--r-keycap);
		background: var(--bg-tile);
		border: var(--stroke-hair) solid var(--border-strong);
		color: var(--text-1);
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: var(--w-medium);
		white-space: nowrap;
	}
</style>
