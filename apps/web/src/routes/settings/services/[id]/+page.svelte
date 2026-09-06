<script lang="ts">
import type { TileHue } from "@flip/store";
import { onMount } from "svelte";
import { goto } from "$app/navigation";
import { page } from "$app/state";
import { createApi } from "$lib/api";
import { appState } from "$lib/app-state.svelte";
import ServiceForm from "../../../../components/settings/ServiceForm.svelte";

const api = createApi();
// biome-ignore lint/style/noNonNullAssertion: this route only matches when :id is present
const id = page.params.id!;

let loaded = $state(false);
let url = $state("");
let name = $state("");
let mark = $state("");
let hue = $state<TileHue>("sapphire");
let host = $state("");
let healthCheckUrl = $state<string | null>(null);
let ws = $state("");
let pin = $state<string | null>(null);
let codes = $state("200");
let every = $state("30s");
let target = $state<"frame" | "external">("frame");
let proxyHeaders = $state(false);

onMount(async () => {
	await appState.refresh();
	const service = appState.services.find((s) => s.id === id);
	if (!service) {
		goto("/settings/services");
		return;
	}
	url = service.url;
	name = service.name;
	mark = service.mark;
	hue = service.hue;
	host = service.host;
	healthCheckUrl = service.healthCheckUrl;
	ws = service.ws;
	pin = service.pin;
	codes = service.codes;
	every = service.every;
	target = service.target;
	proxyHeaders = service.proxyHeaders;
	loaded = true;
});

async function save() {
	const { error } = await api.api.services({ id }).put({
		name,
		mark,
		hue,
		host,
		url,
		healthCheckUrl,
		ws,
		pin,
		codes,
		every,
		target,
		proxyHeaders,
	});
	if (error) {
		console.error("Failed to update service", error);
		return;
	}
	await appState.refresh();
	goto("/settings/services");
}
</script>

<div class="edit-page">
	{#if loaded}
		<ServiceForm
			label="Save changes"
			bind:url
			bind:name
			bind:mark
			bind:hue
			bind:host
			bind:healthCheckUrl
			bind:ws
			bind:pin
			bind:codes
			bind:every
			bind:target
			bind:proxyHeaders
			proxyAvailable={!!appState.proxyDomain}
			workspaces={appState.workspaces}
			onsave={save}
			oncancel={() => goto("/settings/services")}
		/>
	{/if}
</div>

<style>
	.edit-page {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
	}
</style>
