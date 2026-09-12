<script lang="ts">
import { appState, HUD_GRID_COLUMNS } from "$lib/app-state.svelte";
import Input from "../core/Input.svelte";
import KeyCap from "../core/KeyCap.svelte";
import ServiceTile from "../service/ServiceTile.svelte";
</script>

<div class="hud" data-testid="hud">
	<div class="search">
		<!-- Deliberately not autofocused/bound: keystrokes while the HUD is open are
		     captured globally (see +layout.svelte's keydown handler), not by this field.
		     A mouse click can still give the native input real DOM focus, so `readonly`
		     + `tabindex="-1"` stop it from natively editing too (which doubled keystrokes:
		     one from native typing, one from the global handler). This stays a controlled
		     display of appState.query, not an editable input. Matches the reference design's model. -->
		<Input
			size="lg"
			glyph="⌕"
			focused
			readonly
			tabindex="-1"
			placeholder="filter {appState.visibleServices.length} services"
			value={appState.query}
			suffix={appState.hudTyping ? countSuffix : undefined}
		/>
	</div>

	{#snippet countSuffix()}
		<span class="count">{appState.hudTiles.length} of {appState.visibleServices.length}</span>
	{/snippet}

	<div class="grid" style:grid-template-columns="repeat({HUD_GRID_COLUMNS}, minmax(0, 1fr))">
		{#each appState.hudTiles as service, i (service.id)}
			<div data-testid="hud-tile" data-service-id={service.id}>
				<ServiceTile
					name={service.name}
					mark={service.mark}
					hue={service.hue}
					ms={service.health.ms}
					shortcut={appState.hudTyping ? `\`${i + 1}` : service.pin ? `\`${service.pin}` : undefined}
					active={i === appState.cursor}
					onclick={() => appState.openService(service.id)}
				/>
			</div>
		{/each}
	</div>

	<div class="hints">
		<KeyCap>↑↓←→</KeyCap>
		<span class="hint">move</span>
		<KeyCap>⏎</KeyCap>
		<span class="hint">open</span>
		{#if !appState.hudTyping}
			<span class="hint dim">·</span>
			<span class="hint">type to search</span>
		{/if}
	</div>
</div>

<style>
	.hud {
		position: absolute;
		inset: 0;
		background: var(--bg-hud);
		display: flex;
		flex-direction: column;
		align-items: center;
		padding-top: 48px;
		gap: var(--sp-10);
		zoom: var(--ui-scale, 1);
		animation: hudIn var(--dur-hud) var(--ease-out);
		z-index: 100;
	}
	@keyframes hudIn {
		from {
			opacity: 0;
			transform: scale(var(--hud-scale-from));
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}
	.search {
		width: min(920px, 88vw);
	}
	.count {
		font-family: var(--font-mono);
		font-size: var(--t-mono-2xs);
		color: var(--text-4);
		white-space: nowrap;
	}
	.grid {
		width: min(920px, 88vw);
		display: grid;
		gap: var(--sp-7);
	}
	.hints {
		display: flex;
		align-items: center;
		gap: var(--sp-7);
		padding-top: 2px;
	}
	.hint {
		font-family: var(--font-mono);
		font-size: var(--t-mono-2xs);
		color: var(--text-4);
	}
	.hint.dim {
		color: var(--text-dim);
	}
</style>
