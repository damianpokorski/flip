<script lang="ts">
import { appState } from "$lib/app-state.svelte";
import { workspaceLabel } from "$lib/workspace";
import Badge from "../core/Badge.svelte";
import IconButton from "../core/IconButton.svelte";
import Latency from "../status/Latency.svelte";

// Rest screen's top bar — Frame's own desktop topbar is suppressed (`topbar={false}`) when
// this renders instead, so there's exactly one topbar on screen at a time either way.
let {
	onReload,
	onOpenExternally,
}: {
	onReload: () => void;
	onOpenExternally: () => void;
} = $props();

const active = $derived(appState.activeService);
</script>

{#if active}
	<div class="topbar">
		<Badge tone="accent" upper>{workspaceLabel(appState.workspaces, active.ws)}</Badge>
		<div class="info">
			<span class="name">{active.name}</span>
			<div class="meta">
				<Latency ms={active.health.ms} withDot size="2xs" />
				<span class="host">{active.host}</span>
			</div>
		</div>
		<IconButton glyph="⟳" size="touch" label="Reload frame" onclick={onReload} />
		<IconButton glyph="⇱" size="touch" label="Open in a new tab" onclick={onOpenExternally} />
	</div>
{/if}

<style>
	.topbar {
		height: 52px;
		flex: none;
		box-sizing: border-box;
		display: flex;
		align-items: center;
		gap: var(--sp-8);
		padding: 0 var(--sp-6) 0 var(--sp-10);
		border-bottom: var(--stroke-hair) solid var(--border-hair);
	}
	.info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 1px;
	}
	.name {
		font-family: var(--font-display);
		font-size: 16px;
		font-weight: var(--w-medium);
		letter-spacing: var(--track-normal);
		color: var(--text-1);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.meta {
		display: flex;
		align-items: center;
		gap: var(--sp-3);
	}
	.host {
		font-family: var(--font-mono);
		font-size: var(--t-mono-2xs);
		color: var(--text-5);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
