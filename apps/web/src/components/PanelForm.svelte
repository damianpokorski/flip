<script lang="ts">
let {
	label,
	title = $bindable(""),
	url = $bindable(""),
	hidden = $bindable(false),
	healthCheckUrl = $bindable(null),
	customIntervalEnabled = $bindable(false),
	healthCheckIntervalMs = $bindable(30_000),
	onsave,
	oncancel,
}: {
	label: string;
	title?: string;
	url?: string;
	hidden?: boolean;
	healthCheckUrl?: string | null;
	customIntervalEnabled?: boolean;
	healthCheckIntervalMs?: number;
	onsave: () => void;
	oncancel: () => void;
} = $props();
</script>

<p class="form-label">{label}</p>
<div class="fields">
	<label>Title<input data-testid="panel-title-input" bind:value={title} placeholder="Grafana" /></label>
	<label>URL<input data-testid="panel-url-input" bind:value={url} placeholder="https://…" /></label>
	<label class="checkbox-row">
		<input type="checkbox" bind:checked={hidden} />
		Hidden from switcher
	</label>
	<label>
		Health check URL (optional — defaults to the panel URL)
		<input
			data-testid="panel-healthcheck-url-input"
			value={healthCheckUrl ?? ""}
			oninput={(e) => (healthCheckUrl = e.currentTarget.value || null)}
			placeholder="https://…/health"
		/>
	</label>
	<label class="checkbox-row">
		<input type="checkbox" bind:checked={customIntervalEnabled} />
		Custom health check interval
	</label>
	{#if customIntervalEnabled}
		<label>
			Check every ({Math.round(healthCheckIntervalMs / 1000)}s)
			<input type="range" bind:value={healthCheckIntervalMs} min="5000" max="300000" step="5000" />
		</label>
	{/if}
</div>

<div class="row-actions">
	<button class="action-btn" data-testid="panel-cancel-btn" onclick={oncancel}>Cancel</button>
	<button class="action-btn primary" data-testid="panel-save-btn" onclick={onsave}>Save</button>
</div>

<style>
	.form-label {
		margin: 0;
		padding: 0.75rem 1rem 0;
		color: var(--ctp-overlay2);
		font-size: 0.85rem;
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
	label.checkbox-row {
		flex-direction: row;
		align-items: center;
		gap: 0.5rem;
		color: var(--ctp-text);
		font-size: 0.9rem;
		margin-top: 0.25rem;
	}

	input:not([type="checkbox"]) {
		background: var(--ctp-mantle);
		border: 1px solid var(--ctp-surface1);
		border-radius: 4px;
		color: var(--ctp-text);
		font-size: 0.95rem;
		padding: 0.4rem 0.6rem;
		outline: none;
		width: 100%;
		box-sizing: border-box;
	}
	input:not([type="checkbox"]):focus {
		border-color: color-mix(in srgb, var(--ctp-mauve) 60%, transparent);
	}

	input[type="range"] {
		width: 100%;
		accent-color: var(--ctp-mauve);
		padding: 0;
		border: none;
		background: none;
	}

	input[type="checkbox"] {
		appearance: none;
		-webkit-appearance: none;
		width: 1rem;
		height: 1rem;
		border: 1px solid var(--ctp-surface1);
		border-radius: 3px;
		background: var(--ctp-mantle);
		cursor: pointer;
		flex-shrink: 0;
		position: relative;
	}
	input[type="checkbox"]:checked {
		background: var(--ctp-mauve);
		border-color: var(--ctp-mauve);
	}
	input[type="checkbox"]:checked::after {
		content: "";
		position: absolute;
		inset: 0;
		background: url("data:image/svg+xml,%3Csvg viewBox='0 0 10 10' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1.5 5l2.5 2.5 4.5-4.5' stroke='%231e1e2e' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")
			center / 0.65rem no-repeat;
	}
	input[type="checkbox"]:focus-visible {
		outline: 2px solid color-mix(in srgb, var(--ctp-mauve) 60%, transparent);
		outline-offset: 1px;
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
		color: var(--ctp-text);
	}
	.action-btn.primary {
		background: var(--ctp-mauve);
		color: var(--ctp-base);
	}
	.action-btn.primary:hover {
		background: var(--ctp-mauve-dim);
		color: var(--ctp-base);
	}
</style>
