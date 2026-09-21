<script lang="ts">
import type { Theme } from "@flip/store";
import { onMount } from "svelte";
import { appState } from "$lib/app-state.svelte";

// Kept local rather than imported from @flip/store's THEMES so this file never pulls the
// package's node:fs-touching main index into the browser bundle — same reasoning as
// ServiceForm.svelte's own local TILE_HUES list.
const THEME_OPTIONS: { id: Theme; name: string; kind: "dark" | "light" }[] = [
	{ id: "catppuccin-mocha", name: "Catppuccin Mocha", kind: "dark" },
	{ id: "rose-pine", name: "Rosé Pine", kind: "dark" },
	{ id: "rose-pine-dawn", name: "Rosé Pine Dawn", kind: "light" },
	{ id: "tokyo-night", name: "Tokyo Night", kind: "dark" },
	{ id: "tokyo-night-light", name: "Tokyo Night Light", kind: "light" },
	{ id: "kanagawa", name: "Kanagawa", kind: "dark" },
	{ id: "kanagawa-lotus", name: "Kanagawa Lotus", kind: "light" },
	{ id: "nord", name: "Nord", kind: "dark" },
	{ id: "dracula", name: "Dracula", kind: "dark" },
];

onMount(() => {
	appState.refresh();
});
</script>

<div class="appearance-page">
	<span class="hint">the shell's colour palette — applies everywhere, instantly, for everyone who opens this FLIP instance</span>

	<div class="grid">
		{#each THEME_OPTIONS as option (option.id)}
			<button
				type="button"
				class="card"
				data-theme={option.id}
				class:current={appState.theme === option.id}
				onclick={() => appState.setTheme(option.id)}
			>
				<div class="preview">
					<div class="preview-spine"></div>
					<div class="preview-panel">
						<div class="preview-tile" style:background="var(--tile-blue)"></div>
						<div class="preview-tile" style:background="var(--tile-green)"></div>
						<div class="preview-tile" style:background="var(--tile-peach)"></div>
					</div>
					<div class="preview-app">
						<span class="preview-accent" style:background="var(--accent)"></span>
						<span class="preview-drag" style:background="var(--drag)"></span>
					</div>
				</div>
				<div class="label">
					<span class="name">{option.name}</span>
					<span class="kind">{option.kind}</span>
				</div>
			</button>
		{/each}
	</div>
</div>

<style>
	.appearance-page {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: var(--sp-9);
		padding: var(--sp-9) var(--sp-11);
	}
	.hint {
		font-family: var(--font-mono);
		font-size: var(--t-mono-2xs);
		color: var(--text-4);
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(148px, 1fr));
		gap: var(--sp-8);
	}
	.card {
		display: flex;
		flex-direction: column;
		gap: var(--sp-5);
		padding: var(--sp-6);
		border-radius: var(--r-md);
		background: var(--bg-panel);
		border: var(--stroke-active) solid var(--border-hair);
		cursor: pointer;
		font: inherit;
		text-align: left;
		transition: border-color var(--dur-instant) var(--ease-out);
	}
	.card.current {
		border-color: var(--accent);
	}
	.preview {
		display: flex;
		height: 64px;
		border-radius: var(--r-sm);
		overflow: hidden;
		border: var(--stroke-hair) solid var(--border-soft);
	}
	.preview-spine {
		width: 12px;
		flex: none;
		background: var(--bg-spine);
	}
	.preview-panel {
		width: 34px;
		flex: none;
		background: var(--bg-panel);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 4px;
	}
	.preview-tile {
		width: 14px;
		height: 6px;
		border-radius: 2px;
	}
	.preview-app {
		flex: 1;
		min-width: 0;
		background: var(--bg-app);
		display: flex;
		align-items: flex-end;
		gap: var(--sp-3);
		padding: var(--sp-4);
	}
	.preview-accent,
	.preview-drag {
		width: 16px;
		height: 16px;
		border-radius: var(--r-dot);
	}
	.label {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.name {
		font-family: var(--font-display);
		font-size: var(--t-label);
		font-weight: var(--w-semibold);
		color: var(--text-1);
	}
	.kind {
		font-family: var(--font-mono);
		font-size: var(--t-mono-3xs);
		letter-spacing: var(--track-widest);
		text-transform: uppercase;
		color: var(--text-4);
	}
</style>
