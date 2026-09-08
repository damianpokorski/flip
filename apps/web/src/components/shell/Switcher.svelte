<script lang="ts">
import { appState } from "$lib/app-state.svelte";
import Input from "../core/Input.svelte";
import WorkspaceChip from "../nav/WorkspaceChip.svelte";
import ServiceCard from "../service/ServiceCard.svelte";

// The HUD, as a bottom sheet: a real editable search input (mobile has no global-keydown
// capture to simulate typing with, unlike desktop's deliberately-readonly Hud input) over a
// dimmed, still-visible Rest screen. `appState.hudTiles`/`hudTyping` are reused unmodified —
// same alphabetical-then-filtered, 24-capped list desktop's Hud shows.
let {
	onClose,
	onPick,
}: {
	onClose: () => void;
	onPick: (id: string) => void;
} = $props();
</script>

<div class="switcher" data-testid="mobile-switcher">
	<div
		class="scrim"
		data-testid="switcher-scrim"
		onclick={onClose}
		role="button"
		tabindex="0"
		aria-label="Dismiss switcher"
		onkeydown={(e) => e.key === "Enter" && onClose()}
	></div>

	<div class="sheet">
		<div class="handle-row">
			<div class="handle"></div>
		</div>

		<div class="search">
			<Input
				glyph="⌕"
				size="lg"
				placeholder="Search {appState.visibleServices.length} services"
				bind:value={() => appState.query, (v) => appState.setQuery(v)}
			/>
		</div>

		{#if !appState.hudTyping}
			<div class="chips">
				{#each appState.workspaces as workspace (workspace.id)}
					<WorkspaceChip
						label={workspace.label}
						active={workspace.id === appState.activeWs}
						onclick={() => appState.setActiveWorkspace(workspace.id)}
					/>
				{/each}
			</div>
		{:else}
			<div class="count">{appState.hudTiles.length} of {appState.visibleServices.length}</div>
		{/if}

		<div class="grid">
			{#each appState.hudTiles as service (service.id)}
				<div data-testid="mobile-switcher-card" data-service-id={service.id}>
					<ServiceCard
						name={service.name}
						mark={service.mark}
						hue={service.hue}
						ms={service.health.ms}
						active={service.id === appState.activeServiceId}
						onclick={() => onPick(service.id)}
					/>
				</div>
			{/each}
		</div>

		<div class="footer">
			<a class="settings-link" href="/settings">Settings</a>
		</div>
	</div>
</div>

<style>
	.switcher {
		position: absolute;
		inset: 0;
		z-index: 100;
	}
	.scrim {
		position: absolute;
		inset: 0;
		background: var(--bg-scrim);
	}
	.sheet {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		height: 66%;
		box-sizing: border-box;
		background: var(--bg-panel);
		border-top: var(--stroke-hair) solid var(--border-soft);
		border-radius: var(--r-sheet) var(--r-sheet) 0 0;
		box-shadow: var(--shadow-sheet);
		padding-top: var(--sp-8);
		display: flex;
		flex-direction: column;
		min-height: 0;
		animation: sheetIn var(--dur-sheet) var(--ease-out);
	}
	@keyframes sheetIn {
		from {
			transform: translateY(100%);
		}
		to {
			transform: translateY(0);
		}
	}
	.handle-row {
		flex: none;
		display: flex;
		justify-content: center;
		padding-bottom: var(--sp-8);
	}
	.handle {
		width: 44px;
		height: 4px;
		border-radius: 3px;
		background: var(--ctp-surface-1);
	}
	.search {
		flex: none;
		margin: 0 var(--sp-10) var(--sp-9);
		height: 46px;
		box-sizing: border-box;
		border-radius: var(--r-xl);
		background: var(--bg-tile);
		border: var(--stroke-active) solid var(--border-mid);
		display: flex;
		align-items: center;
		padding: 0 13px;
	}
	.chips {
		flex: none;
		display: flex;
		gap: var(--sp-6);
		padding: 0 var(--sp-10) var(--sp-9);
		overflow-x: auto;
	}
	.count {
		flex: none;
		padding: 0 var(--sp-11) var(--sp-9);
		font-family: var(--font-mono);
		font-size: var(--t-mono-2xs);
		color: var(--text-4);
	}
	.grid {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--sp-7);
		padding: 0 var(--sp-10) var(--sp-9);
		align-content: start;
	}
	.footer {
		flex: none;
		padding: 0 var(--sp-10) var(--sp-9);
		display: flex;
		justify-content: flex-end;
	}
	.settings-link {
		font-family: var(--font-mono);
		font-size: var(--t-mono-2xs);
		color: var(--accent);
		text-decoration: none;
	}
</style>
