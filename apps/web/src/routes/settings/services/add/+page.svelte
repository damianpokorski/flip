<script lang="ts">
import type { TileHue } from "@flip/store";
import { onMount } from "svelte";
import { goto } from "$app/navigation";
import type { SiteData } from "$lib/api";
import { createApi } from "$lib/api";
import { appState } from "$lib/app-state.svelte";
import ServiceForm from "../../../../components/settings/ServiceForm.svelte";

const api = createApi();

let url = $state("");
let name = $state("");
let mark = $state("");
let hue = $state<TileHue>("sapphire");
let host = $state("");
let healthCheckUrl = $state<string | null>(null);
let source = $state<"external" | "local">("external");
let localSlug = $state<string | null>(null);
let ws = $state("");
let pin = $state<string | null>(null);
let codes = $state("200");
let every = $state("30s");
let target = $state<"frame" | "external">("frame");
let proxyHeaders = $state(false);
let sites = $state<SiteData[]>([]);

onMount(async () => {
	appState.refresh();
	const { data, error } = await api.api.sites.get();
	if (error) {
		console.error("Failed to load local sites", error);
		return;
	}
	sites = data;
});

async function save() {
	const { error } = await api.api.services.post({
		name,
		mark,
		hue,
		host,
		url,
		healthCheckUrl,
		source,
		localSlug,
		ws,
		pin,
		codes,
		every,
		target,
		proxyHeaders,
	});
	if (error) {
		console.error("Failed to create service", error);
		return;
	}
	await appState.refresh();
	goto("/settings/services");
}
</script>

<div class="add-page">
	<ServiceForm
		label="Add service"
		bind:url
		bind:name
		bind:mark
		bind:hue
		bind:host
		bind:healthCheckUrl
		bind:source
		bind:localSlug
		bind:ws
		bind:pin
		bind:codes
		bind:every
		bind:target
		bind:proxyHeaders
		proxyAvailable={!!appState.proxyDomain}
		{sites}
		workspaces={appState.workspaces}
		onsave={save}
		oncancel={() => goto("/settings/services")}
	/>
</div>

<style>
	.add-page {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
	}
</style>
