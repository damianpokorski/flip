<script lang="ts">
import type { Injection } from "@flip/store";
import type { InjectionKind } from "@flip/store/injection";
import { INJECT_PRESETS } from "@flip/store/injection";
import Badge from "../core/Badge.svelte";
import Input from "../core/Input.svelte";
import FieldLabel from "./FieldLabel.svelte";

let { rows = $bindable<Injection[]>([]) }: { rows?: Injection[] } = $props();

const KINDS: { kind: InjectionKind; label: string; placeholder: string }[] = [
	{ kind: "requestHeader", label: "request header", placeholder: "X-Header" },
	{ kind: "responseHeader", label: "response header", placeholder: "X-Header" },
	{ kind: "cookie", label: "cookie", placeholder: "name" },
	{ kind: "query", label: "query param", placeholder: "param" },
	{ kind: "localStorage", label: "localStorage", placeholder: "key" },
];

function placeholderFor(kind: InjectionKind): string {
	return KINDS.find((k) => k.kind === kind)?.placeholder ?? "key";
}

function addRow() {
	rows = [...rows, { kind: "requestHeader", key: "", value: "" }];
}

function removeRow(index: number) {
	rows = rows.filter((_, i) => i !== index);
}

// Copies each row so later edits never write back into the shared preset constant.
function applyPreset(presetRows: readonly Injection[]) {
	rows = [...rows, ...presetRows.map((row) => ({ ...row }))];
}
</script>

<div data-testid="service-inject">
	<FieldLabel>Inject</FieldLabel>
	{#if rows.length > 0}
		<div class="rows">
			{#each rows as row, i (i)}
				<div class="inject-row" data-testid="service-inject-row">
					<select class="kind" bind:value={row.kind} aria-label="Kind" data-testid="service-inject-kind">
						{#each KINDS as k (k.kind)}
							<option value={k.kind}>{k.label}</option>
						{/each}
					</select>
					<div class="key">
						<Input size="sm" bind:value={row.key} placeholder={placeholderFor(row.kind)} aria-label="Key" data-testid="service-inject-key" />
					</div>
					<div class="value">
						<Input size="sm" bind:value={row.value} placeholder="value" aria-label="Value" data-testid="service-inject-value" />
					</div>
					<button type="button" class="small-btn" onclick={() => removeRow(i)} data-testid="service-inject-remove">remove</button>
				</div>
			{/each}
		</div>
	{/if}
	<div class="actions">
		<button type="button" class="small-btn" onclick={addRow} data-testid="service-inject-add">+ add</button>
		{#each INJECT_PRESETS as preset (preset.id)}
			<span
				data-testid="service-inject-preset"
				data-preset-id={preset.id}
				onclick={() => applyPreset(preset.rows)}
				role="button"
				tabindex="0"
				onkeydown={(e) => e.key === "Enter" && applyPreset(preset.rows)}
			>
				<Badge tone="neutral">{preset.label}</Badge>
			</span>
		{/each}
	</div>
	<p class="hint">
		headers apply to every proxied request · cookies and localStorage are rewritten on every frame load · query params only on the first · stored as plaintext in config.yaml
	</p>
</div>

<style>
	.rows {
		display: flex;
		flex-direction: column;
		gap: var(--sp-5);
		padding-bottom: var(--sp-6);
	}
	.inject-row {
		display: flex;
		align-items: center;
		gap: var(--sp-6);
	}
	.kind {
		flex: none;
		width: 124px;
		background: none;
		border: none;
		border-bottom: var(--stroke-hair) solid var(--border-mid);
		padding: 4px 2px;
		color: var(--text-2);
		font-family: var(--font-mono);
		font-size: var(--t-mono-sm);
		cursor: pointer;
	}
	.kind:focus-visible {
		outline: none;
		border-bottom: var(--stroke-active) solid var(--accent);
	}
	.kind option {
		background: var(--bg-tile);
		color: var(--text-1);
	}
	.key {
		flex: 2;
		min-width: 0;
	}
	.value {
		flex: 3;
		min-width: 0;
	}
	.actions {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--sp-5);
	}
	.small-btn {
		flex: none;
		background: var(--bg-tile);
		border: var(--stroke-hair) solid var(--border-mid);
		border-radius: var(--r-row);
		color: var(--text-3);
		font-family: var(--font-mono);
		font-size: var(--t-mono-2xs);
		padding: 2px var(--sp-6);
		cursor: pointer;
	}
	.actions span {
		cursor: pointer;
	}
	.hint {
		margin: 0;
		padding-top: var(--sp-4);
		font-family: var(--font-mono);
		font-size: var(--t-mono-2xs);
		color: var(--text-4);
	}
</style>
