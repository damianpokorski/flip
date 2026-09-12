<script lang="ts">
import { appState } from "$lib/app-state.svelte";
import KeyCap from "../core/KeyCap.svelte";
import ServiceRow from "../service/ServiceRow.svelte";

const workspace = $derived(
	appState.workspaces.find((w) => w.id === appState.activeWs),
);
const services = $derived(appState.servicesInActiveWorkspace);
</script>

<div class="sidebar" class:collapsed={appState.sidebarCollapsed}>
	<div class="content">
		<div class="head">
			<span class="ws-name">{workspace?.name ?? ""}</span>
		</div>
		<div class="meta">
			<span class="count">{services.length} svc</span>
			<span class="dot">·</span>
			<span class="hold">press</span>
			<KeyCap>`</KeyCap>
		</div>
		<div class="rows">
			{#each services as service (service.id)}
				<div data-testid="sidebar-service-row" data-service-id={service.id}>
					<ServiceRow
						name={service.name}
						mark={service.mark}
						hue={service.hue}
						ms={service.health.ms}
						active={service.id === appState.activeServiceId}
						onclick={() => appState.openService(service.id)}
					/>
				</div>
			{/each}
		</div>
	</div>
</div>

<style>
	.sidebar {
		width: var(--w-sidebar);
		flex: none;
		background: var(--bg-panel);
		border-right-width: var(--stroke-hair);
		border-right-style: solid;
		border-right-color: var(--border-hair);
		padding: var(--sp-9) var(--sp-8);
		overflow: hidden;
		box-sizing: border-box;
		zoom: var(--ui-scale, 1);
	}
	.sidebar.collapsed {
		width: 0;
		padding: var(--sp-9) 0;
		border-right-width: 0;
	}
	.content {
		width: calc(var(--w-sidebar) - (var(--sp-8) * 2));
		height: 100%;
		flex: none;
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
		min-height: 0;
		opacity: 1;
	}
	.sidebar.collapsed .content {
		opacity: 0;
	}
	.head {
		padding: 0 var(--sp-4) var(--sp-2);
	}
	.ws-name {
		font-family: var(--font-display);
		font-size: var(--t-display-xs);
		font-weight: var(--w-semibold);
		letter-spacing: 0.12em;
		color: var(--text-1);
	}
	.meta {
		display: flex;
		align-items: center;
		gap: var(--sp-4);
		padding: 0 var(--sp-4) var(--sp-8);
	}
	.count,
	.hold {
		font-family: var(--font-mono);
		font-size: 9px;
		color: var(--text-4);
	}
	.dot {
		font-family: var(--font-mono);
		font-size: 9px;
		color: var(--text-faint);
	}
	.rows {
		display: flex;
		flex-direction: column;
		gap: var(--sp-1);
		overflow-y: auto;
	}
</style>
