<script lang="ts">
import { onMount } from "svelte";
import type { RawFile } from "$lib/api";
import { createApi } from "$lib/api";
import { appState } from "$lib/app-state.svelte";
import StatusDot from "../../../components/status/StatusDot.svelte";

const api = createApi();

let files = $state<Record<string, RawFile | null>>({
	"services.yaml": null,
	"workspaces.yaml": null,
	"config.yaml": null,
});

onMount(async () => {
	await appState.refresh();
	const [services, workspaces, config] = await Promise.all([
		api.api.services.raw.get(),
		api.api.workspaces.raw.get(),
		api.api.config.raw.get(),
	]);
	files = {
		"services.yaml": services.error ? null : services.data,
		"workspaces.yaml": workspaces.error ? null : workspaces.data,
		"config.yaml": config.error ? null : config.data,
	};
});

function classifyLine(line: string): string {
	const trimmed = line.trim();
	if (trimmed.startsWith("#")) return "var(--text-5)";
	if (trimmed.startsWith("-")) return "var(--code-list)";
	if (/^\S+:\s*$/.test(trimmed) && !/^\s/.test(line))
		return "var(--code-key-top)";
	if (/^[\w.-]+:\s*$/.test(trimmed)) return "var(--code-key)";
	if (/^[\w.-]+:\s*\S/.test(trimmed)) return "var(--code-value)";
	return "var(--code-inline)";
}

function relativeTime(iso: string): string {
	const ms = Date.now() - new Date(iso).getTime();
	const minutes = Math.floor(ms / 60_000);
	if (minutes < 1) return "just now";
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	return `${Math.floor(hours / 24)}d ago`;
}

async function copy(content: string) {
	await navigator.clipboard.writeText(content);
}
</script>

<div class="config-page">
	<div class="summary">
		<StatusDot ms={20} />
		<span class="ok">valid · {appState.services.length} services · {appState.workspaces.length} workspaces</span>
	</div>

	{#each Object.entries(files) as [filename, file] (filename)}
		<section class="file-section">
			<div class="section-head">
				<span class="filename">{filename}</span>
				<span class="spacer"></span>
				{#if file}<span class="saved">saved {relativeTime(file.updatedAt)}</span>{/if}
				<button type="button" class="copy-btn" disabled={!file} onclick={() => file && copy(file.content)}>Copy</button>
			</div>
			<div class="code-block">
				{#if file}
					{@const lines = file.content.split("\n")}
					<div class="gutter">
						{#each lines as _, i (i)}<span class="line-num">{i + 1}</span>{/each}
					</div>
					<div class="code">
						{#each lines as line, i (i)}<span class="line" style:color={classifyLine(line)}>{line || " "}</span>{/each}
					</div>
				{:else}
					<span class="loading">loading…</span>
				{/if}
			</div>
		</section>
	{/each}
</div>

<style>
	.config-page {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: var(--sp-9);
		padding: var(--sp-9) var(--sp-11);
	}
	.summary {
		display: flex;
		align-items: center;
		gap: var(--sp-5);
	}
	.ok {
		font-family: var(--font-mono);
		font-size: var(--t-mono-2xs);
		color: var(--health-fast);
	}
	.file-section {
		display: flex;
		flex-direction: column;
		gap: var(--sp-4);
	}
	.section-head {
		display: flex;
		align-items: center;
		gap: var(--sp-6);
	}
	.filename {
		font-family: var(--font-mono);
		font-size: var(--t-mono-xs);
		color: var(--text-3);
	}
	.spacer {
		flex: 1;
	}
	.saved {
		font-family: var(--font-mono);
		font-size: var(--t-mono-2xs);
		color: var(--text-4);
	}
	.copy-btn {
		background: var(--bg-tile);
		border: var(--stroke-hair) solid var(--border-mid);
		border-radius: var(--r-sm);
		color: var(--text-3);
		font-family: var(--font-display);
		font-size: 10px;
		letter-spacing: var(--track-wide);
		text-transform: uppercase;
		padding: 2px var(--sp-6);
		cursor: pointer;
	}
	.copy-btn:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.code-block {
		border-radius: var(--r-md);
		background: var(--bg-panel);
		border: var(--stroke-hair) solid var(--border-soft);
		padding: var(--sp-7) 0;
		display: flex;
		max-height: 320px;
		overflow: auto;
	}
	.gutter {
		flex: none;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		padding-right: var(--sp-5);
		padding-left: var(--sp-6);
	}
	.line-num {
		font-family: var(--font-mono);
		font-size: var(--t-mono-3xs);
		line-height: var(--lh-code);
		height: var(--lh-code);
		color: var(--code-gutter);
	}
	.code {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		padding-right: var(--sp-8);
	}
	.line {
		font-family: var(--font-mono);
		font-size: var(--t-mono-xs);
		line-height: var(--lh-code);
		height: var(--lh-code);
		white-space: pre;
	}
	.loading {
		padding: 0 var(--sp-8);
		font-family: var(--font-mono);
		font-size: var(--t-mono-2xs);
		color: var(--text-4);
	}
</style>
