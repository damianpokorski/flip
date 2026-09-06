<script lang="ts">
import { onMount } from "svelte";
import { goto } from "$app/navigation";
import { createApi } from "$lib/api";
import { appState } from "$lib/app-state.svelte";
import Button from "../../../components/core/Button.svelte";
import Input from "../../../components/core/Input.svelte";
import ServiceMark from "../../../components/service/ServiceMark.svelte";
import Latency from "../../../components/status/Latency.svelte";
import StatusDot from "../../../components/status/StatusDot.svelte";

const api = createApi();

let filter = $state("");
let openMenuId = $state<string | null>(null);

onMount(() => {
	appState.refresh();
});

function workspaceName(ws: string): string {
	return (
		appState.workspaces.find((workspace) => workspace.id === ws)?.name ?? ws
	);
}

const filtered = $derived(
	appState.services.filter((service) =>
		service.name.toLowerCase().includes(filter.toLowerCase()),
	),
);
const downCount = $derived(
	appState.services.filter((service) => service.health.bucket === "down")
		.length,
);
const slowCount = $derived(
	appState.services.filter((service) => service.health.bucket === "slow")
		.length,
);

async function remove(id: string) {
	openMenuId = null;
	if (!confirm("Delete this service?")) return;
	const { error } = await api.api.services({ id }).delete();
	if (error) {
		console.error("Failed to delete service", error);
		return;
	}
	await appState.refresh();
}
</script>

<div class="list-page">
	<div class="toolbar">
		<div class="filter-input">
			<Input glyph="⌕" placeholder="filter services" bind:value={filter} />
		</div>
		<Button glyph="+" onclick={() => goto("/settings/services/add")} data-testid="add-service-btn">Add service</Button>
	</div>

	<div class="col-heads">
		<span class="col service">SERVICE</span>
		<span class="col ws">WORKSPACE</span>
		<span class="col codes">CODES</span>
		<span class="col every">EVERY</span>
		<span class="col health">HEALTH</span>
	</div>

	<div class="rows">
		{#each filtered as service (service.id)}
			<div class="row" data-testid="service-row" data-service-id={service.id}>
				<div class="col service">
					<ServiceMark text={service.mark} hue={service.hue} size="md" inset />
					<span class="name-stack">
						<span class="name">{service.name}</span>
						<span class="host">{service.host}</span>
					</span>
				</div>
				<span class="col ws">{workspaceName(service.ws)}</span>
				<span class="col codes">{service.codes}</span>
				<span class="col every">{service.every}</span>
				<span class="col health">
					<StatusDot ms={service.health.ms} size={6} />
					<Latency ms={service.health.ms} align="right" width={42} />
					<span class="menu-toggle" data-testid="service-menu-toggle" onclick={() => (openMenuId = openMenuId === service.id ? null : service.id)} role="button" tabindex="0" onkeydown={(e) => e.key === "Enter" && (openMenuId = service.id)}>
						⋮
					</span>
					{#if openMenuId === service.id}
						<div class="menu">
							<button type="button" data-testid="edit-service-btn" onclick={() => goto(`/settings/services/${service.id}`)}>Edit</button>
							<button type="button" class="danger" data-testid="delete-service-btn" onclick={() => remove(service.id)}>Delete</button>
						</div>
					{/if}
				</span>
			</div>
		{/each}
	</div>

	<div class="footer">
		<span>{appState.services.length} services</span>
		<span>·</span>
		<span class="down">{downCount} down</span>
		<span>·</span>
		<span class="slow">{slowCount} slow</span>
	</div>
</div>

<style>
	.list-page {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		padding: var(--sp-9) var(--sp-11);
	}
	.toolbar {
		display: flex;
		align-items: center;
		gap: var(--sp-8);
		padding-bottom: var(--sp-8);
	}
	.filter-input {
		flex: 1;
	}
	.col-heads {
		display: flex;
		gap: var(--sp-6);
		padding: 0 var(--sp-4) var(--sp-4);
		font-family: var(--font-mono);
		font-size: var(--t-mono-3xs);
		letter-spacing: var(--track-widest);
		color: var(--text-5);
	}
	.rows {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: var(--sp-1);
	}
	.row {
		display: flex;
		align-items: center;
		gap: var(--sp-6);
		padding: var(--sp-3) var(--sp-4);
		border-radius: var(--r-row);
	}
	.row:hover {
		background: var(--accent-row-quiet);
	}
	.col.service {
		width: 132px;
		flex: none;
		display: flex;
		align-items: center;
		gap: var(--sp-6);
		min-width: 0;
	}
	.name-stack {
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.name {
		font-family: var(--font-display);
		font-size: var(--t-label);
		color: var(--text-1);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.host {
		font-family: var(--font-mono);
		font-size: 8px;
		color: var(--text-5);
	}
	.col.ws {
		width: 90px;
		flex: none;
		font-family: var(--font-display);
		font-size: 10px;
		letter-spacing: var(--track-wide);
		color: var(--text-3);
	}
	.col.codes,
	.col.every {
		width: 52px;
		flex: none;
		font-family: var(--font-mono);
		font-size: var(--t-mono-xs);
		color: var(--text-3);
	}
	.col.health {
		flex: 1;
		position: relative;
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: var(--sp-4);
	}
	.menu-toggle {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--text-dim);
		cursor: pointer;
		padding: 0 4px;
	}
	.menu {
		position: absolute;
		top: 100%;
		right: 0;
		z-index: 10;
		background: var(--bg-panel);
		border: var(--stroke-hair) solid var(--border-mid);
		border-radius: var(--r-row);
		display: flex;
		flex-direction: column;
		overflow: hidden;
		min-width: 90px;
	}
	.menu button {
		background: none;
		border: none;
		padding: var(--sp-5) var(--sp-7);
		text-align: left;
		font-family: var(--font-display);
		font-size: var(--t-label);
		color: var(--text-2);
		cursor: pointer;
	}
	.menu button:hover {
		background: var(--accent-row-quiet);
	}
	.menu button.danger {
		color: var(--health-down);
	}
	.footer {
		flex: none;
		display: flex;
		gap: var(--sp-9);
		padding-top: var(--sp-6);
		border-top: var(--stroke-hair) solid var(--border-hair);
		font-family: var(--font-mono);
		font-size: var(--t-mono-2xs);
		color: var(--text-4);
	}
	.down {
		color: var(--health-down);
	}
	.slow {
		color: var(--health-slow);
	}
</style>
