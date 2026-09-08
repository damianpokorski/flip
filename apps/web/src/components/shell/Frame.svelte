<script lang="ts">
import type { ServiceData } from "$lib/api";
import { appState } from "$lib/app-state.svelte";
import { workspaceLabel } from "$lib/workspace";
import Badge from "../core/Badge.svelte";
import IconButton from "../core/IconButton.svelte";
import Latency from "../status/Latency.svelte";

// Mobile's MobileTopBar renders its own chrome around the same iframe stack, so the topbar
// here is skippable without touching mount/viewport logic at all.
let { topbar = true }: { topbar?: boolean } = $props();

const active = $derived(appState.activeService);
// All non-hidden, embeddable services stay mounted regardless of workspace — switching
// workspaces via the Spine must never unmount/reload another workspace's iframe, which is
// the actual point of the product. Only `target: "external"` services never get an iframe.
const embeddedServices = $derived(
	appState.visibleServices.filter((service) => service.target === "frame"),
);

const iframeEls: Record<string, HTMLIFrameElement> = {};

// A plain action instead of `bind:this={iframeEls[service.id]}` — binding into a dynamic
// object property isn't a reactive target Svelte can verify, which triggers a
// binding_property_non_reactive warning even though the assignment itself works fine.
function registerFrame(node: HTMLIFrameElement, id: string) {
	iframeEls[id] = node;
	return {
		destroy() {
			delete iframeEls[id];
		},
	};
}

// Falls back to the raw URL whenever the proxy isn't actually configured server-side, even
// if a stale `proxyHeaders: true` is set on the service — fail-open to "works like today,"
// never fail-closed to a broken iframe.
function frameSrc(service: ServiceData): string {
	if (service.proxyHeaders && appState.proxyDomain) {
		return `http://${service.id}.${appState.proxyDomain}:${appState.proxyPort}/`;
	}
	return service.url;
}

// Exported (plain function, not a prop) so MobileTopBar's own reload/open-external buttons
// can drive the same iframe stack via `bind:this` instead of duplicating this logic.
export function reload() {
	const service = active;
	if (!service) return;
	const el = iframeEls[service.id];
	if (!el) return;
	// Cross-origin iframes block `.contentWindow.location.reload()` — resetting `src`
	// (via a detour through about:blank, since re-assigning the same URL is a no-op in
	// most browsers) works regardless of origin.
	const src = el.src;
	el.src = "about:blank";
	requestAnimationFrame(() => {
		el.src = src;
	});
}

export function openExternally() {
	if (active) window.open(active.url, "_blank", "noopener,noreferrer");
}
</script>

<div class="frame">
	{#if active && topbar}
		<div class="topbar">
			<span class="name">{active.name}</span>
			<span class="host">{active.host}</span>
			<Latency ms={active.health.ms} withDot size="2xs" />
			<span class="spacer"></span>
			<Badge tone="quiet">{workspaceLabel(appState.workspaces, active.ws)}</Badge>
			<IconButton glyph="⟳" label="Reload frame" onclick={reload} />
			<IconButton glyph="⇱" label="Open in a new tab" onclick={openExternally} />
		</div>
	{/if}

	<div class="viewport">
		{#if embeddedServices.length === 0}
			<div class="empty">
				<p>No services configured yet.</p>
				<a href="/settings/services/add">Add your first service →</a>
			</div>
		{/if}
		<!-- All embeddable services stay mounted; switching is a pure visibility toggle so
		     embedded apps never reload or lose session/scroll state. -->
		{#each embeddedServices as service (service.id)}
			<iframe
				use:registerFrame={service.id}
				title={service.name}
				src={frameSrc(service)}
				class="service-frame"
				class:active={service.id === appState.activeServiceId}
				data-testid="service-iframe"
				data-service-id={service.id}
			></iframe>
		{/each}
	</div>
</div>

<style>
	.frame {
		flex: 1;
		min-width: 0;
		min-height: 0;
		display: flex;
		flex-direction: column;
		background: var(--bg-app);
		position: relative;
		overflow: hidden;
	}
	.topbar {
		height: 34px;
		flex: none;
		display: flex;
		align-items: center;
		gap: var(--sp-8);
		padding: 0 var(--sp-6) 0 var(--sp-9);
		border-bottom: var(--stroke-hair) solid var(--border-hair);
	}
	.name {
		font-family: var(--font-display);
		font-size: var(--t-label);
		letter-spacing: var(--track-normal);
		color: var(--text-1);
	}
	.host {
		font-family: var(--font-mono);
		font-size: var(--t-mono-2xs);
		color: var(--text-5);
	}
	.spacer {
		flex: 1;
	}
	.viewport {
		position: relative;
		flex: 1;
		min-height: 0;
	}
	.empty {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		gap: var(--sp-5);
		align-items: center;
		justify-content: center;
		color: var(--text-4);
		font-family: var(--font-display);
	}
	.empty a {
		color: var(--accent);
	}
	.service-frame {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		border: none;
		opacity: 0;
		pointer-events: none;
		z-index: 0;
	}
	.service-frame.active {
		opacity: 1;
		pointer-events: auto;
		z-index: 1;
	}
</style>
