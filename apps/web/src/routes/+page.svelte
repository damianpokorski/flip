<script lang="ts">
import { onMount } from "svelte";
import type { HealthStatus, PanelData } from "$lib/api";
import { createApi, resolveServerUrl } from "$lib/api";

let panels = $state<PanelData[]>([]);
let activePanelId = $state<string | null>(null);

let visiblePanels = $derived(panels.filter((panel) => !panel.hidden));

async function refreshPanels() {
	const api = createApi();
	const { data, error } = await api.api.panels.get();
	if (error) {
		console.error("Failed to load panels", error);
		return;
	}
	panels = data;
	if (
		!activePanelId ||
		!visiblePanels.some((panel) => panel.id === activePanelId)
	) {
		activePanelId = visiblePanels[0]?.id ?? null;
	}
}

function patchHealth(patch: Record<string, HealthStatus>) {
	panels = panels.map((panel) =>
		patch[panel.id] ? { ...panel, health: patch[panel.id] } : panel,
	);
}

onMount(refreshPanels);

// Re-fetch panels / patch health the instant they change on the server (e.g. an edit
// made from the settings page, a hand-edited YAML file, or a health-check tick), so the
// switcher stays in sync without a manual reload. The browser's EventSource auto-reconnects.
onMount(() => {
	const source = new EventSource(`${resolveServerUrl()}/api/events`);
	source.addEventListener("change", refreshPanels);
	source.addEventListener("health", (event) => {
		try {
			patchHealth(JSON.parse(event.data));
		} catch (err) {
			console.error("Failed to parse health event", err);
		}
	});
	return () => source.close();
});

function healthColor(status: HealthStatus["status"]) {
	if (status === "up") return "var(--ctp-green)";
	if (status === "down") return "var(--ctp-red)";
	return "var(--ctp-overlay0)";
}
</script>

<div class="wrapper">
	{#if panels.length === 0}
		<div class="empty">
			<p>No panels configured yet.</p>
			<a href="/settings">Add your first panel →</a>
		</div>
	{:else}
		<div class="switcher" data-testid="panel-switcher">
			{#each visiblePanels as panel (panel.id)}
				<button
					class="switcher-tab"
					class:active={panel.id === activePanelId}
					data-testid="panel-tab"
					data-panel-id={panel.id}
					onclick={() => (activePanelId = panel.id)}
				>
					<span class="dot" style="background: {healthColor(panel.health.status)}"></span>
					{panel.title}
				</button>
			{/each}
		</div>

		<div class="frames">
			<!-- All non-hidden panels stay mounted; switching is a pure CSS visibility toggle so
			     embedded apps never reload or lose their session/scroll state. -->
			{#each visiblePanels as panel (panel.id)}
				<iframe
					title={panel.title}
					src={panel.url}
					class="frame"
					class:active={panel.id === activePanelId}
					data-testid="panel-iframe"
					data-panel-id={panel.id}
				></iframe>
			{/each}
		</div>
	{/if}
</div>

<style>
	.wrapper {
		display: flex;
		flex-direction: column;
		height: 100%;
	}
	.empty {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		align-items: center;
		justify-content: center;
		height: 100%;
		color: var(--ctp-overlay1);
	}
	.empty a {
		color: var(--ctp-mauve);
	}
	.switcher {
		display: flex;
		gap: 0.25rem;
		padding: 0.5rem;
		overflow-x: auto;
		background: var(--ctp-mantle);
		border-bottom: 1px solid var(--ctp-surface0);
		flex-shrink: 0;
	}
	.switcher-tab {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		background: var(--ctp-surface0);
		color: var(--ctp-text);
		border: none;
		border-radius: 6px;
		padding: 0.4rem 0.8rem;
		font-size: 0.9rem;
		cursor: pointer;
		white-space: nowrap;
	}
	.switcher-tab:hover {
		background: var(--ctp-surface1);
	}
	.switcher-tab.active {
		background: var(--ctp-mauve);
		color: var(--ctp-base);
		font-weight: 600;
	}
	.dot {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 999px;
		flex-shrink: 0;
	}
	.frames {
		position: relative;
		flex: 1;
	}
	.frame {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		border: none;
		opacity: 0;
		pointer-events: none;
		z-index: -1;
	}
	.frame.active {
		opacity: 1;
		pointer-events: auto;
		z-index: 1;
	}
</style>
