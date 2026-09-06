<script lang="ts">
import { onMount } from "svelte";
import {
	type DndEvent,
	dndzone,
	dragHandle,
	dragHandleZone,
} from "svelte-dnd-action";
import type { ServiceData, WorkspaceData } from "$lib/api";
import { createApi } from "$lib/api";
import { appState } from "$lib/app-state.svelte";
import Badge from "../../../components/core/Badge.svelte";
import Input from "../../../components/core/Input.svelte";
import ServiceMark from "../../../components/service/ServiceMark.svelte";

const api = createApi();

type CardItem = { id: string; service: ServiceData };
type ColumnItem = { id: string; workspace: WorkspaceData };

let columnItems = $state<ColumnItem[]>([]);
let columnCards = $state<Record<string, CardItem[]>>({});
let dragStatus = $state<string | null>(null);
let addingWorkspace = $state(false);
let newWorkspaceName = $state("");
let newWorkspaceLabel = $state("");
// Suppresses the rebuild effect below while a drag gesture is in progress — canonical data
// (appState.services) can change underneath us mid-drag via SSE health ticks, and rebuilding
// columnItems/columnCards from scratch at that moment would yank the arrays svelte-dnd-action
// is tracking out from under it. Cleared once the gesture settles, so the next rebuild picks
// up fresh post-drag data.
let dragActive = $state(false);

onMount(() => {
	appState.refresh();
});

// Rebuild the board from canonical data whenever it changes underneath us — cheap enough
// at personal-install scale, and keeps the board correct after any API round trip.
$effect(() => {
	if (dragActive) return;
	columnItems = appState.workspaces.map((workspace) => ({
		id: workspace.id,
		workspace,
	}));
	const next: Record<string, CardItem[]> = {};
	for (const workspace of appState.workspaces) {
		next[workspace.id] = appState.services
			.filter((service) => service.ws === workspace.id)
			.map((service) => ({ id: service.id, service }));
	}
	columnCards = next;
});

function handleCardConsider(
	workspaceId: string,
	e: CustomEvent<DndEvent<CardItem>>,
) {
	dragActive = true;
	columnCards = { ...columnCards, [workspaceId]: e.detail.items };
}

async function handleCardFinalize(
	workspaceId: string,
	e: CustomEvent<DndEvent<CardItem>>,
) {
	columnCards = { ...columnCards, [workspaceId]: e.detail.items };

	// A service now belongs to exactly one column — the moved card is whichever item in the
	// destination zone doesn't already have that workspace as its `ws` (a re-drop into the
	// same column is a no-op, since every existing card there already matches).
	const moved = e.detail.items.find((item) => item.service.ws !== workspaceId);
	if (moved) {
		const toName =
			appState.workspaces.find((w) => w.id === workspaceId)?.name ??
			workspaceId;
		dragStatus = `${moved.service.name} → ${toName}`;
		const { error } = await api.api
			.services({ id: moved.service.id })
			.put({ ...moved.service, ws: workspaceId });
		if (error) console.error("Failed to update service workspace", error);
		await appState.refresh();
	}
	dragActive = false;
}

function handleColumnConsider(e: CustomEvent<DndEvent<ColumnItem>>) {
	dragActive = true;
	columnItems = e.detail.items;
}

async function handleColumnFinalize(e: CustomEvent<DndEvent<ColumnItem>>) {
	columnItems = e.detail.items;
	const { error } = await api.api.workspaces.reorder.patch({
		ids: columnItems.map((item) => item.id),
	});
	if (error) {
		console.error("Failed to reorder workspaces", error);
		await appState.refresh();
	}
	dragActive = false;
}

async function addWorkspace() {
	if (!newWorkspaceName || !newWorkspaceLabel) return;
	const { error } = await api.api.workspaces.post({
		name: newWorkspaceName,
		label: newWorkspaceLabel,
	});
	if (error) {
		console.error("Failed to create workspace", error);
		return;
	}
	newWorkspaceName = "";
	newWorkspaceLabel = "";
	addingWorkspace = false;
	await appState.refresh();
}
</script>

<div class="board-page">
	<span class="hint">drag a service between columns · drag a column head to reorder workspaces</span>

	<div
		class="columns"
		use:dragHandleZone={{ items: columnItems, dragDisabled: false, flipDurationMs: 150, type: "columns" }}
		onconsider={handleColumnConsider}
		onfinalize={handleColumnFinalize}
	>
		{#each columnItems as { id, workspace } (id)}
			<div class="column" class:current={workspace.id === appState.activeWs}>
				<div class="column-head" use:dragHandle>
					<span class="column-name">{workspace.name}</span>
					<span class="column-count">{columnCards[workspace.id]?.length ?? 0}</span>
				</div>
				<div
					class="column-body"
					data-testid="workspace-column"
					data-workspace-id={workspace.id}
					use:dndzone={{ items: columnCards[workspace.id] ?? [], flipDurationMs: 150, type: "cards" }}
					onconsider={(e) => handleCardConsider(workspace.id, e)}
					onfinalize={(e) => handleCardFinalize(workspace.id, e)}
				>
					{#each columnCards[workspace.id] ?? [] as item (item.id)}
						<div class="card" data-testid="workspace-card" data-service-id={item.service.id}>
							<ServiceMark text={item.service.mark} hue={item.service.hue} size="xs" />
							<span class="card-name">{item.service.name}</span>
						</div>
					{/each}
				</div>
			</div>
		{/each}

		{#if addingWorkspace}
			<div class="column new-column">
				<Input size="sm" placeholder="Name" bind:value={newWorkspaceName} />
				<Input size="sm" placeholder="Label (2 chars)" maxlength={2} bind:value={newWorkspaceLabel} />
				<div class="new-actions">
					<button type="button" onclick={addWorkspace}>Add</button>
					<button type="button" onclick={() => (addingWorkspace = false)}>Cancel</button>
				</div>
			</div>
		{:else}
			<div class="add-column" onclick={() => (addingWorkspace = true)} role="button" tabindex="0" onkeydown={(e) => e.key === "Enter" && (addingWorkspace = true)}>
				+
			</div>
		{/if}
	</div>

	<div class="footer">
		{#if dragStatus}<Badge tone="drag">{dragStatus}</Badge>{/if}
		<span class="hint">a service belongs to exactly one workspace</span>
	</div>
</div>

<style>
	.board-page {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		gap: var(--sp-7);
		padding: var(--sp-9) var(--sp-11);
	}
	.hint {
		font-family: var(--font-mono);
		font-size: var(--t-mono-2xs);
		color: var(--text-4);
	}
	.columns {
		flex: 1;
		min-height: 0;
		display: flex;
		gap: var(--sp-6);
	}
	.column {
		width: var(--w-board-col);
		box-sizing: border-box;
		flex: none;
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
		padding: var(--sp-5) var(--sp-4);
		border-radius: var(--r-md);
		background: var(--bg-panel);
		border: var(--stroke-hair) solid var(--border-hair);
		min-height: 0;
		overflow: hidden;
	}
	.column.current {
		border-color: var(--accent-line);
	}
	.column-head {
		display: flex;
		align-items: baseline;
		gap: var(--sp-3);
		padding: 0 2px var(--sp-2);
		cursor: grab;
	}
	.column-name {
		font-family: var(--font-display);
		font-size: var(--t-label-sm);
		font-weight: var(--w-semibold);
		letter-spacing: var(--track-widest);
		color: var(--text-1);
	}
	.column.current .column-name {
		color: var(--accent);
	}
	.column-count {
		font-family: var(--font-mono);
		font-size: 8px;
		color: var(--text-5);
	}
	.column-body {
		flex: 1;
		min-height: 40px;
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
		overflow-y: auto;
	}
	.card {
		display: flex;
		align-items: center;
		gap: var(--sp-4);
		padding: var(--sp-2) var(--sp-3);
		border-radius: var(--r-sm);
		background: var(--bg-tile);
		border: 1px dashed transparent;
	}
	.card-name {
		flex: 1;
		min-width: 0;
		font-family: var(--font-display);
		font-size: 10px;
		letter-spacing: var(--track-tight);
		color: var(--text-1);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.add-column {
		width: 40px;
		box-sizing: border-box;
		flex: none;
		border-radius: var(--r-md);
		border: 1px dashed var(--border-dashed);
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: var(--font-mono);
		font-size: 14px;
		color: var(--text-dim);
		cursor: pointer;
	}
	.new-column {
		width: 140px;
		gap: var(--sp-5);
	}
	.new-actions {
		display: flex;
		gap: var(--sp-4);
	}
	.new-actions button {
		background: var(--bg-tile);
		border: var(--stroke-hair) solid var(--border-mid);
		border-radius: var(--r-sm);
		color: var(--text-2);
		font-family: var(--font-display);
		font-size: 10px;
		padding: 3px var(--sp-4);
		cursor: pointer;
	}
	.footer {
		flex: none;
		display: flex;
		align-items: center;
		gap: var(--sp-7);
	}
</style>
