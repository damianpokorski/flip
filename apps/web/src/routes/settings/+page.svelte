<script lang="ts">
import { onMount } from "svelte";
import { type DndEvent, dragHandle, dragHandleZone } from "svelte-dnd-action";
import {
	type ConfigData,
	createApi,
	type PanelBody,
	type PanelData,
} from "$lib/api";
import PanelForm from "../../components/PanelForm.svelte";

const api = createApi();

// --- Config ---
let configLoading = $state(true);
let healthCheckIntervalMs = $state(30_000);
let healthCheckTimeoutMs = $state(5_000);
let configSaved = $state(false);

async function loadConfig() {
	configLoading = true;
	const { data, error }: { data: ConfigData | null; error: unknown } =
		await api.api.config.get();
	if (!error && data) {
		healthCheckIntervalMs = data.healthCheckIntervalMs;
		healthCheckTimeoutMs = data.healthCheckTimeoutMs;
	}
	configLoading = false;
}

async function saveConfig() {
	const { error } = await api.api.config.put({
		healthCheckIntervalMs,
		healthCheckTimeoutMs,
	});
	if (error) {
		console.error("Failed to save config", error);
		return;
	}
	configSaved = true;
	setTimeout(() => (configSaved = false), 2000);
}

// --- Panels ---
let panels = $state<PanelData[]>([]);
let panelsLoading = $state(true);
let editingId = $state<string | null>(null);
let addingNew = $state(false);

let fTitle = $state("");
let fUrl = $state("");
let fHidden = $state(false);
let fHealthCheckUrl = $state<string | null>(null);
let fCustomIntervalEnabled = $state(false);
let fHealthCheckIntervalMs = $state(30_000);

async function loadPanels() {
	panelsLoading = true;
	const { data, error } = await api.api.panels.get();
	if (error) {
		console.error("Failed to load panels", error);
		panelsLoading = false;
		return;
	}
	panels = data;
	panelsLoading = false;
}

onMount(() => {
	loadConfig();
	loadPanels();
});

const dragDisabled = () => addingNew || editingId !== null;

function handleDndConsider(e: CustomEvent<DndEvent<PanelData>>) {
	panels = e.detail.items;
}

async function handleDndFinalize(e: CustomEvent<DndEvent<PanelData>>) {
	panels = e.detail.items;
	const { error } = await api.api.panels.reorder.patch({
		ids: panels.map((panel) => panel.id),
	});
	if (error) {
		console.error("Failed to reorder panels", error);
		await loadPanels();
	}
}

function openEdit(panel: PanelData) {
	addingNew = false;
	editingId = panel.id;
	fTitle = panel.title;
	fUrl = panel.url;
	fHidden = panel.hidden;
	fHealthCheckUrl = panel.healthCheckUrl;
	fCustomIntervalEnabled = panel.healthCheckIntervalMs != null;
	fHealthCheckIntervalMs = panel.healthCheckIntervalMs ?? healthCheckIntervalMs;
}

function openAdd() {
	editingId = null;
	addingNew = true;
	fTitle = "";
	fUrl = "";
	fHidden = false;
	fHealthCheckUrl = null;
	fCustomIntervalEnabled = false;
	fHealthCheckIntervalMs = healthCheckIntervalMs;
}

function cancel() {
	editingId = null;
	addingNew = false;
}

function buildBody(): PanelBody {
	return {
		title: fTitle,
		url: fUrl,
		hidden: fHidden,
		healthCheckUrl: fHealthCheckUrl,
		healthCheckIntervalMs: fCustomIntervalEnabled
			? fHealthCheckIntervalMs
			: null,
	};
}

async function save() {
	const body = buildBody();
	if (addingNew) {
		const { error } = await api.api.panels.post(body);
		if (error) {
			console.error(error);
			return;
		}
	} else if (editingId !== null) {
		const { error } = await api.api.panels({ id: editingId }).put(body);
		if (error) {
			console.error(error);
			return;
		}
	}
	cancel();
	await loadPanels();
}

async function remove(id: string) {
	if (!confirm("Delete this panel?")) return;
	const { error } = await api.api.panels({ id }).delete();
	if (error) {
		console.error(error);
		return;
	}
	await loadPanels();
}
</script>

<div class="page">
	<header>
		<a class="back-btn" href="/">&#8592; Back</a>
		<h1>Settings</h1>
	</header>

	<!-- Configuration section -->
	<h2 class="section-title">Health check defaults</h2>
	{#if configLoading}
		<p class="hint">Loading…</p>
	{:else}
		<div class="card form-card">
			<div class="fields">
				<label>
					Check interval ({Math.round(healthCheckIntervalMs / 1000)}s)
					<input type="range" bind:value={healthCheckIntervalMs} min="5000" max="300000" step="5000" />
				</label>
				<label>
					Timeout ({Math.round(healthCheckTimeoutMs / 1000)}s)
					<input type="range" bind:value={healthCheckTimeoutMs} min="1000" max="30000" step="1000" />
				</label>
			</div>
			<div class="row-actions">
				{#if configSaved}<span class="saved-hint">Saved</span>{/if}
				<button class="action-btn primary" data-testid="save-config-btn" onclick={saveConfig}>Save</button>
			</div>
		</div>
	{/if}

	<!-- Panels section -->
	<div class="section-header">
		<h2 class="section-title">Panels</h2>
		<button class="add-btn" data-testid="add-panel-btn" onclick={openAdd} disabled={addingNew || editingId !== null}>
			+ Add panel
		</button>
	</div>

	{#if panelsLoading}
		<p class="hint">Loading…</p>
	{:else}
		{#if addingNew}
			<div class="card form-card">
				<PanelForm
					label="New panel"
					bind:title={fTitle}
					bind:url={fUrl}
					bind:hidden={fHidden}
					bind:healthCheckUrl={fHealthCheckUrl}
					bind:customIntervalEnabled={fCustomIntervalEnabled}
					bind:healthCheckIntervalMs={fHealthCheckIntervalMs}
					onsave={save}
					oncancel={cancel}
				/>
			</div>
		{/if}

		<div
			class="panel-list"
			use:dragHandleZone={{
				items: panels,
				dragDisabled: dragDisabled(),
				flipDurationMs: 150,
				dropTargetStyle: {},
				dropTargetClasses: ["drop-target"],
			}}
			onconsider={handleDndConsider}
			onfinalize={handleDndFinalize}
		>
			{#each panels as panel (panel.id)}
				<div class="card" class:editing={editingId === panel.id}>
					{#if editingId === panel.id}
						<PanelForm
							label="Editing — {panel.title}"
							bind:title={fTitle}
							bind:url={fUrl}
							bind:hidden={fHidden}
							bind:healthCheckUrl={fHealthCheckUrl}
							bind:customIntervalEnabled={fCustomIntervalEnabled}
							bind:healthCheckIntervalMs={fHealthCheckIntervalMs}
							onsave={save}
							oncancel={cancel}
						/>
					{:else}
						<div class="panel-row" data-testid="panel-row" data-panel-id={panel.id}>
							<span class="drag-handle" class:disabled={dragDisabled()} use:dragHandle>⠿</span>
							<div class="panel-info">
								<span class="panel-title">{panel.title}</span>
								<span class="panel-meta">{panel.url}</span>
								<div class="panel-badges">
									<span class="badge" class:up={panel.health.status === "up"} class:down={panel.health.status === "down"}>
										{panel.health.status}
									</span>
									{#if panel.hidden}<span class="badge muted">hidden</span>{/if}
								</div>
							</div>
							<div class="panel-actions">
								<button class="action-btn" data-testid="edit-panel-btn" onclick={() => openEdit(panel)} disabled={addingNew || editingId !== null}>
									Edit
								</button>
								<button class="action-btn danger" data-testid="delete-panel-btn" onclick={() => remove(panel.id)} disabled={addingNew || editingId !== null}>
									Delete
								</button>
							</div>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	:global(body) {
		margin: 0;
		background: var(--ctp-base);
		color: var(--ctp-text);
		font-family: sans-serif;
	}

	.page {
		min-height: 100%;
		overflow-y: auto;
		background: var(--ctp-base);
		padding: 1.5rem;
		box-sizing: border-box;
		max-width: 720px;
		margin: 0 auto;
	}

	header {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	h1 {
		margin: 0;
		font-size: 1.4rem;
		color: var(--ctp-text);
		flex: 1;
	}

	.section-header {
		display: flex;
		align-items: center;
		margin-bottom: 0.75rem;
	}

	.section-title {
		margin: 1.5rem 0 0.75rem;
		font-size: 1rem;
		font-weight: 600;
		color: var(--ctp-overlay2);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		flex: 1;
	}
	.section-header .section-title {
		margin-bottom: 0;
		margin-top: 0;
	}

	.back-btn {
		background: var(--ctp-surface0);
		color: var(--ctp-text);
		border: none;
		border-radius: 8px;
		padding: 0.5rem 1rem;
		font-size: 1rem;
		cursor: pointer;
		text-decoration: none;
	}
	.back-btn:hover {
		background: var(--ctp-surface1);
	}

	.add-btn {
		background: var(--ctp-mauve);
		color: var(--ctp-base);
		border: none;
		border-radius: 8px;
		padding: 0.5rem 1rem;
		font-size: 1rem;
		cursor: pointer;
	}
	.add-btn:hover {
		background: var(--ctp-mauve-dim);
	}
	.add-btn:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.card {
		background: var(--ctp-mantle);
		border-radius: 6px;
		box-shadow: 0 0 0 1px var(--ctp-surface0);
		margin-bottom: 0.75rem;
		overflow: hidden;
	}
	.card.editing,
	.form-card {
		box-shadow: 0 0 0 1px color-mix(in srgb, var(--ctp-mauve) 50%, transparent);
	}

	.panel-row {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.75rem 1rem;
	}
	.panel-info {
		flex: 1;
		min-width: 0;
	}
	.drag-handle {
		color: var(--ctp-overlay0);
		cursor: grab;
		flex-shrink: 0;
		padding: 0.25rem;
	}
	.drag-handle.disabled {
		cursor: default;
		opacity: 0.3;
	}
	.panel-list.drop-target {
		outline: 2px solid color-mix(in srgb, var(--ctp-mauve) 70%, transparent);
		outline-offset: 2px;
		border-radius: 6px;
	}
	.panel-title {
		display: block;
		color: var(--ctp-text);
		font-size: 1.05rem;
		font-weight: 600;
	}
	.panel-meta {
		display: block;
		font-size: 0.8rem;
		color: var(--ctp-overlay0);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		margin-top: 2px;
	}
	.panel-badges {
		display: flex;
		gap: 0.4rem;
		flex-wrap: wrap;
		margin-top: 0.4rem;
	}
	.badge {
		font-size: 0.72rem;
		background: var(--ctp-surface0);
		color: var(--ctp-overlay2);
		border-radius: 4px;
		padding: 2px 6px;
		text-transform: capitalize;
	}
	.badge.up {
		color: var(--ctp-green);
	}
	.badge.down {
		color: var(--ctp-red);
	}
	.badge.muted {
		color: var(--ctp-overlay0);
	}

	.panel-actions {
		display: flex;
		gap: 0.5rem;
		flex-shrink: 0;
	}

	.hint {
		color: var(--ctp-overlay0);
		font-size: 0.8rem;
	}

	.saved-hint {
		font-size: 0.8rem;
		color: var(--ctp-green);
		margin-right: auto;
	}

	input[type="range"] {
		width: 100%;
		accent-color: var(--ctp-mauve);
	}

	.row-actions {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		border-top: 1px solid var(--ctp-surface0);
	}

	.action-btn {
		background: var(--ctp-surface0);
		color: var(--ctp-text);
		border: none;
		border-radius: 6px;
		padding: 0.4rem 1rem;
		font-size: 0.9rem;
		cursor: pointer;
	}
	.action-btn:hover {
		background: var(--ctp-surface1);
	}
	.action-btn.primary {
		background: var(--ctp-mauve);
		color: var(--ctp-base);
	}
	.action-btn.primary:hover {
		background: var(--ctp-mauve-dim);
	}
	.action-btn.danger {
		background: var(--ctp-red);
		color: var(--ctp-base);
	}
	.action-btn.danger:hover {
		background: var(--ctp-red-dim);
	}
	.action-btn:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.fields {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-size: 0.8rem;
		color: var(--ctp-overlay2);
	}
</style>
