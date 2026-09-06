<script lang="ts">
import KeyCap from "../../../components/core/KeyCap.svelte";

const SHORTCUTS: { label: string; keys: string[]; note?: string }[] = [
	{ label: "Raise the HUD", keys: ["`"], note: "hold" },
	{ label: "Move across the grid", keys: ["↑", "↓", "←", "→"] },
	{ label: "Previous / next workspace", keys: ["⇧←", "⇧→"] },
	{ label: "Jump to a pinned service", keys: ["`1", "…", "`0"] },
	{ label: "Open the highlighted service", keys: ["⏎"] },
	{ label: "Dismiss the HUD", keys: ["Esc"] },
];
</script>

<div class="shortcuts-page">
	{#each SHORTCUTS as shortcut (shortcut.label)}
		<div class="row">
			<span class="label">{shortcut.label}</span>
			{#if shortcut.note}<span class="note">{shortcut.note}</span>{/if}
			{#each shortcut.keys as key (key)}<KeyCap>{key}</KeyCap>{/each}
		</div>
	{/each}
	<span class="hint">shortcuts are fixed for now — rebinding isn't implemented yet</span>
</div>

<style>
	.shortcuts-page {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: var(--sp-6);
		padding: var(--sp-10) var(--sp-11);
	}
	.row {
		display: flex;
		align-items: center;
		gap: var(--sp-8);
		padding: var(--sp-5) var(--sp-8);
		border-radius: var(--r-row);
		background: var(--bg-panel);
		border: var(--stroke-hair) solid var(--border-hair);
	}
	.label {
		flex: 1;
		font-family: var(--font-display);
		font-size: var(--t-label);
		letter-spacing: var(--track-normal);
		color: var(--text-1);
	}
	.note {
		font-family: var(--font-mono);
		font-size: var(--t-mono-2xs);
		color: var(--text-4);
	}
	.hint {
		font-family: var(--font-mono);
		font-size: var(--t-mono-2xs);
		color: var(--text-dim);
	}
</style>
