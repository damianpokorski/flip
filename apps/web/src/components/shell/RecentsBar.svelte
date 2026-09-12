<script lang="ts">
import { appState } from "$lib/app-state.svelte";
import { hueVar } from "$lib/hue";
import IconButton from "../core/IconButton.svelte";
import StatusDot from "../status/StatusDot.svelte";

let { onOpenSwitcher }: { onOpenSwitcher: () => void } = $props();
</script>

<div class="bar">
	{#each appState.recentServices as service (service.id)}
		<div
			class="tile"
			class:active={service.id === appState.activeServiceId}
			onclick={() => appState.openService(service.id)}
			role="button"
			tabindex="0"
			onkeydown={(e) => e.key === "Enter" && appState.openService(service.id)}
			data-testid="recents-tile"
			data-service-id={service.id}
		>
			<span class="mark" style:color={hueVar(service.hue)}>{service.mark}</span>
			<StatusDot ms={service.health.ms} size={4} />
		</div>
	{/each}
	<IconButton glyph="⌗" size="touch" tone="accent" label="Open switcher" onclick={onOpenSwitcher} />
</div>

<style>
	.bar {
		flex: none;
		box-sizing: border-box;
		padding: var(--sp-7) var(--sp-9) var(--sp-4);
		background: var(--bg-spine);
		border-top: var(--stroke-hair) solid var(--border-hair);
		display: flex;
		align-items: center;
		gap: var(--sp-6);
		zoom: var(--ui-scale, 1);
	}
	.tile {
		flex: 1;
		height: 48px;
		border-radius: var(--r-xl);
		background: var(--bg-tile);
		border: var(--stroke-active) solid var(--border-hair);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2px;
		cursor: pointer;
		transition: background var(--dur-instant) var(--ease-out);
	}
	.tile.active {
		background: var(--accent-fill);
		border-color: var(--accent);
	}
	.mark {
		font-family: var(--font-mono);
		font-size: 12px;
		font-weight: var(--w-semibold);
	}
</style>
