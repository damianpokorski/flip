<script lang="ts">
import type { TileHue } from "@flip/store";
import Latency from "../status/Latency.svelte";
import ServiceMark from "./ServiceMark.svelte";

let {
	name,
	mark,
	hue,
	ms,
	host,
	active = false,
	onclick,
}: {
	name: string;
	mark: string;
	hue: TileHue;
	ms: number | null;
	host?: string;
	active?: boolean;
	onclick?: () => void;
} = $props();
</script>

<div class="row" class:active {onclick} role="button" tabindex="0" onkeydown={(e) => e.key === "Enter" && onclick?.()}>
	<ServiceMark text={mark} {hue} />
	<span class="info">
		<span class="name">{name}</span>
		{#if host}<span class="host">{host}</span>{/if}
	</span>
	<Latency {ms} />
</div>

<style>
	.row {
		display: flex;
		align-items: center;
		gap: var(--sp-5);
		padding: 5px 6px;
		border-radius: var(--r-row);
		background: transparent;
		cursor: pointer;
		transition: background var(--dur-instant) var(--ease-out);
	}
	.row.active {
		background: var(--accent-row);
	}
	.info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.name {
		font-family: var(--font-display);
		font-size: var(--t-label);
		letter-spacing: var(--track-tight);
		color: var(--text-2);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.row.active .name {
		color: var(--text-1);
	}
	.host {
		font-family: var(--font-mono);
		font-size: 8px;
		color: var(--text-5);
	}
</style>
