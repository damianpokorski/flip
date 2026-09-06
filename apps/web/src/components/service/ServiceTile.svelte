<script lang="ts">
import type { TileHue } from "@flip/store";
import { hueVar } from "$lib/hue";
import Latency from "../status/Latency.svelte";

let {
	name,
	mark,
	hue,
	ms,
	shortcut,
	active = false,
	onclick,
}: {
	name: string;
	mark: string;
	hue: TileHue;
	ms: number | null;
	shortcut?: string;
	active?: boolean;
	onclick?: () => void;
} = $props();
</script>

<div
	class="tile"
	class:active
	{onclick}
	role="button"
	tabindex="0"
	onkeydown={(e) => e.key === "Enter" && onclick?.()}
>
	<span class="mark" style:color={hueVar(hue)}>{mark}</span>
	<span class="name">{name}</span>
	<Latency {ms} withDot size="2xs" />
	{#if shortcut}<span class="shortcut">{shortcut}</span>{/if}
</div>

<style>
	.tile {
		position: relative;
		aspect-ratio: 1 / 1;
		border-radius: var(--r-lg);
		background: var(--bg-tile);
		border: var(--stroke-active) solid var(--border-hair);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--sp-2);
		padding-inline: var(--sp-4);
		box-sizing: border-box;
		cursor: pointer;
		transition: background var(--dur-instant) var(--ease-out);
	}
	.tile.active {
		background: var(--accent-fill);
		border-color: var(--accent);
	}
	.mark {
		font-family: var(--font-mono);
		font-size: 14px;
		font-weight: var(--w-bold);
	}
	.name {
		max-width: 100%;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
		text-align: center;
		font-family: var(--font-display);
		font-size: 10.5px;
		letter-spacing: var(--track-normal);
		color: var(--text-2);
	}
	.shortcut {
		position: absolute;
		top: 6px;
		right: 8px;
		font-family: var(--font-mono);
		font-size: 9px;
		color: var(--text-3);
	}
</style>
