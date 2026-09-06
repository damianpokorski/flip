<script lang="ts">
import type { Snippet } from "svelte";

let { children }: { children: Snippet } = $props();
</script>

<div class="field-label">{@render children()}</div>

<style>
	.field-label {
		font-family: var(--font-mono);
		font-size: var(--t-mono-3xs);
		letter-spacing: var(--track-widest);
		text-transform: uppercase;
		color: var(--text-5);
		padding-bottom: var(--sp-2);
	}
</style>
