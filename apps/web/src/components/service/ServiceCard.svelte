<script lang="ts">
import type { TileHue } from "@flip/store";
import Latency from "../status/Latency.svelte";
import ServiceMark from "./ServiceMark.svelte";

// The mobile switcher's grid item — a horizontal row card, not a reuse of ServiceTile's
// square HUD tile (structurally different: mark-left/name-right vs mark-top/name-below).
let {
	name,
	mark,
	hue,
	ms,
	active = false,
	onclick,
}: {
	name: string;
	mark: string;
	hue: TileHue;
	ms: number | null;
	active?: boolean;
	onclick?: () => void;
} = $props();
</script>

<div
	class="card"
	class:active
	{onclick}
	role="button"
	tabindex="0"
	onkeydown={(e) => e.key === "Enter" && onclick?.()}
>
	<ServiceMark text={mark} {hue} size="lg" inset />
	<div class="info">
		<span class="name">{name}</span>
		<Latency {ms} withDot size="2xs" />
	</div>
</div>

<style>
	.card {
		height: 66px;
		box-sizing: border-box;
		border-radius: var(--r-2xl);
		background: var(--bg-tile);
		border: var(--stroke-active) solid var(--border-hair);
		display: flex;
		align-items: center;
		gap: var(--sp-8);
		padding: 0 var(--sp-9);
		cursor: pointer;
		transition: background var(--dur-instant) var(--ease-out);
	}
	.card.active {
		background: var(--accent-fill);
		border-color: var(--accent);
	}
	.info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 3px;
	}
	.name {
		font-family: var(--font-display);
		font-size: 13.5px;
		letter-spacing: var(--track-tight);
		color: var(--text-1);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
