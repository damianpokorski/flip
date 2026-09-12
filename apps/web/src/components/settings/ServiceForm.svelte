<script lang="ts">
import type { TileHue } from "@flip/store";
import type { ProbeResult } from "$lib/api";
import { createApi } from "$lib/api";
import Badge from "../core/Badge.svelte";
import Button from "../core/Button.svelte";
import Input from "../core/Input.svelte";
import KeyCap from "../core/KeyCap.svelte";
import ServiceMark from "../service/ServiceMark.svelte";
import Latency from "../status/Latency.svelte";
import FieldLabel from "./FieldLabel.svelte";
import Toggle from "./Toggle.svelte";

const TILE_HUES: TileHue[] = [
	"sapphire",
	"blue",
	"mauve",
	"green",
	"yellow",
	"peach",
	"pink",
	"teal",
	"sky",
	"lavender",
	"flamingo",
	"rosewater",
];

let {
	label,
	url = $bindable(""),
	name = $bindable(""),
	mark = $bindable(""),
	hue = $bindable<TileHue>("sapphire"),
	host = $bindable(""),
	healthCheckUrl = $bindable<string | null>(null),
	source = $bindable<"external" | "local">("external"),
	localSlug = $bindable<string | null>(null),
	ws = $bindable<string>(""),
	pin = $bindable<string | null>(null),
	codes = $bindable("200"),
	every = $bindable("30s"),
	target = $bindable<"frame" | "external">("frame"),
	proxyHeaders = $bindable(false),
	lazyLoad = $bindable(false),
	proxyAvailable = false,
	sites = [],
	workspaces,
	onsave,
	oncancel,
}: {
	label: string;
	url?: string;
	name?: string;
	mark?: string;
	hue?: TileHue;
	host?: string;
	healthCheckUrl?: string | null;
	source?: "external" | "local";
	localSlug?: string | null;
	ws?: string;
	pin?: string | null;
	codes?: string;
	every?: string;
	target?: "frame" | "external";
	proxyHeaders?: boolean;
	lazyLoad?: boolean;
	proxyAvailable?: boolean;
	sites?: { slug: string; inUse: boolean }[];
	workspaces: { id: string; name: string }[];
	onsave: () => void;
	oncancel: () => void;
} = $props();

let markTouched = $state(false);
let probing = $state(false);
let probeResult = $state<ProbeResult | null>(null);
let probeError = $state(false);

$effect(() => {
	if (!markTouched && name.length > 0) {
		mark = name.slice(0, 2).toUpperCase();
	}
});

$effect(() => {
	if (source === "external" && !host && url) {
		try {
			host = new URL(url).host;
		} catch {
			// not a valid absolute URL yet — leave host as-is
		}
	}
});

$effect(() => {
	if (source === "local" && !host && localSlug) {
		host = localSlug;
	}
});

function selectSite(slug: string) {
	localSlug = slug;
}

async function probe() {
	if (!url) return;
	probing = true;
	probeError = false;
	try {
		const api = createApi();
		const { data, error } = await api.api.services.probe.post({ url });
		if (error) throw error;
		probeResult = data;
		// A probe that finds a service non-embeddable would normally fall back to opening it
		// externally — but if FLIP's own header-stripping proxy is configured, suggest routing
		// through it instead, so the service can stay embedded.
		if (!data.embeddable && proxyAvailable) {
			target = "frame";
			proxyHeaders = true;
		} else {
			target = data.suggestedTarget;
		}
		if (!name && data.title) name = data.title;
	} catch {
		probeResult = null;
		probeError = true;
	} finally {
		probing = false;
	}
}

function selectWorkspace(id: string) {
	ws = id;
}

const probeHint = $derived.by(() => {
	if (probing) return "probing…";
	if (probeError) return "couldn't reach that URL";
	if (!probeResult) return null;
	const parts = [`${probeResult.statusCode ?? "no response"}`];
	if (probeResult.title) parts.push(`page title "${probeResult.title}"`);
	parts.push(probeResult.embeddable ? "embeds fine" : "refuses to embed");
	return `probed · ${parts.join(" · ")}`;
});
</script>

<p class="form-label">{label}</p>
<div class="fields">
	<Toggle
		bind:on={() => source === "local", (v: boolean) => (source = v ? "local" : "external")}
		label="Serve a local folder instead of a URL"
		hint="hosts a folder mounted under DATA_DIR/sites/"
	/>

	{#if source === "external"}
		<div>
			<FieldLabel>Service url</FieldLabel>
			<Input
				size="lg"
				focused
				bind:value={url}
				placeholder="https://nas.home.lan"
				suffix={probeResult ? latencySuffix : undefined}
				data-testid="service-url-input"
			/>
			<div class="probe-row">
				<button type="button" class="probe-btn" data-testid="service-probe-btn" onclick={probe} disabled={!url || probing}>probe</button>
				{#if probeHint}<span class="hint">{probeHint}</span>{/if}
			</div>
		</div>
	{:else}
		<div>
			<FieldLabel>Local folder</FieldLabel>
			{#if sites.length === 0}
				<p class="hint">No folders found under DATA_DIR/sites — mount one and reopen this form.</p>
			{:else}
				<div class="badges" role="radiogroup" data-testid="service-site-picker">
					{#each sites as site (site.slug)}
						<span
							data-testid="service-site-toggle"
							data-slug={site.slug}
							onclick={() => selectSite(site.slug)}
							role="radio"
							aria-checked={localSlug === site.slug}
							tabindex="0"
							onkeydown={(e) => e.key === "Enter" && selectSite(site.slug)}
						>
							<Badge tone={localSlug === site.slug ? "accent" : "neutral"}>
								{site.slug}{site.inUse && site.slug !== localSlug ? " · in use" : ""}
							</Badge>
						</span>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	{#snippet latencySuffix()}
		<Latency ms={probeResult?.ms ?? null} withDot size="2xs" />
	{/snippet}

	<div class="row">
		<div class="grow">
			<FieldLabel>Name</FieldLabel>
			<Input size="sm" bind:value={name} data-testid="service-name-input" />
		</div>
		<div class="tile-preview">
			<FieldLabel>Tile</FieldLabel>
			<div class="tile-row">
				<ServiceMark text={mark || "??"} {hue} size="lg" inset />
				<Input size="sm" bind:value={mark} placeholder="AB" data-testid="service-mark-input" />
			</div>
		</div>
		<div>
			<FieldLabel>Colour</FieldLabel>
			<div class="swatches">
				{#each TILE_HUES as h (h)}
					<span
						class="swatch"
						style:background="var(--tile-{h})"
						style:box-shadow={h === hue ? "var(--ring-swatch)" : "none"}
						onclick={() => (hue = h)}
						role="button"
						tabindex="0"
						onkeydown={(e) => e.key === "Enter" && (hue = h)}
					></span>
				{/each}
			</div>
		</div>
	</div>

	<div class="row">
		<div class="grow">
			<FieldLabel>Workspace</FieldLabel>
			<div class="badges" role="radiogroup">
				{#each workspaces as workspace (workspace.id)}
					<span
						data-testid="service-workspace-toggle"
						data-workspace-id={workspace.id}
						onclick={() => selectWorkspace(workspace.id)}
						role="radio"
						aria-checked={ws === workspace.id}
						tabindex="0"
						onkeydown={(e) => e.key === "Enter" && selectWorkspace(workspace.id)}
					>
						<Badge tone={ws === workspace.id ? "accent" : "neutral"}>{workspace.id}</Badge>
					</span>
				{/each}
			</div>
		</div>
		<div class="narrow">
			<FieldLabel>Ok codes</FieldLabel>
			<Input size="sm" bind:value={codes} />
		</div>
		<div class="narrow">
			<FieldLabel>Interval</FieldLabel>
			<Input size="sm" bind:value={every} />
		</div>
	</div>

	<div>
		<FieldLabel>Health check url (optional override)</FieldLabel>
		<Input
			size="sm"
			bind:value={() => healthCheckUrl ?? "", (v: string) => (healthCheckUrl = v || null)}
			placeholder="defaults to the service url"
		/>
	</div>

	<Toggle
		bind:on={() => target === "external", (v: boolean) => (target = v ? "external" : "frame")}
		label="Open in a new tab instead of the frame"
		hint="auto-set when a probe sees X-Frame-Options"
	/>

	{#if proxyAvailable && source === "external"}
		<Toggle
			bind:on={proxyHeaders}
			label="Route through FLIP's header-stripping proxy"
			hint="lets a service that blocks iframing embed anyway"
		/>
	{/if}

	<Toggle
		bind:on={lazyLoad}
		label="Don't preload in the background"
		hint="loads only once you open it, instead of on startup"
	/>
</div>

<div class="row-actions">
	<span class="pin-preview">
		<span class="hint">pin as</span>
		<KeyCap>`{pin ?? "-"}</KeyCap>
	</span>
	<span class="spacer"></span>
	<Button variant="ghost" onclick={oncancel} data-testid="service-cancel-btn">Cancel</Button>
	<Button
		onclick={onsave}
		disabled={!ws || (source === "local" ? !localSlug : !url)}
		data-testid="service-save-btn">{label}</Button
	>
</div>

<style>
	.form-label {
		margin: 0;
		padding: var(--sp-8) var(--sp-11) 0;
		color: var(--text-3);
		font-family: var(--font-mono);
		font-size: var(--t-mono-2xs);
	}
	.fields {
		display: flex;
		flex-direction: column;
		gap: var(--sp-9);
		padding: var(--sp-9) var(--sp-11);
	}
	.row {
		display: flex;
		gap: var(--sp-10);
	}
	.grow {
		flex: 1;
		min-width: 0;
	}
	.narrow {
		width: 84px;
		flex: none;
	}
	.tile-preview {
		width: 110px;
		flex: none;
	}
	.tile-row {
		display: flex;
		align-items: center;
		gap: var(--sp-6);
	}
	.swatches {
		display: flex;
		gap: var(--sp-3);
		flex-wrap: wrap;
	}
	.swatch {
		width: 16px;
		height: 16px;
		border-radius: var(--r-xs);
		cursor: pointer;
	}
	.badges {
		display: flex;
		gap: var(--sp-3);
		flex-wrap: wrap;
	}
	.probe-row {
		display: flex;
		align-items: center;
		gap: var(--sp-6);
		padding-top: var(--sp-4);
	}
	.probe-btn {
		background: var(--bg-tile);
		border: var(--stroke-hair) solid var(--border-mid);
		border-radius: var(--r-row);
		color: var(--text-3);
		font-family: var(--font-mono);
		font-size: var(--t-mono-2xs);
		padding: 2px var(--sp-6);
		cursor: pointer;
	}
	.probe-btn:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.hint {
		font-family: var(--font-mono);
		font-size: var(--t-mono-2xs);
		color: var(--text-4);
	}
	.row-actions {
		display: flex;
		align-items: center;
		gap: var(--sp-7);
		padding: var(--sp-9) var(--sp-11);
		border-top: var(--stroke-hair) solid var(--border-hair);
	}
	.pin-preview {
		display: flex;
		align-items: center;
		gap: var(--sp-5);
	}
	.spacer {
		flex: 1;
	}
</style>
