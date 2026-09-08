<script lang="ts">
import { onMount } from "svelte";
import "../app.css";
import {
	appState,
	HUD_GRID_COLUMNS,
	MOBILE_BREAKPOINT_QUERY,
} from "$lib/app-state.svelte";
import Hud from "../components/shell/Hud.svelte";
import Spine from "../components/shell/Spine.svelte";

const { children } = $props();

function isTypingTarget(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false;
	const tag = target.tagName;
	return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
}

function onKeydown(e: KeyboardEvent) {
	if (e.key === "`" && !e.repeat && !isTypingTarget(e.target)) {
		e.preventDefault();
		if (appState.hudOpen) appState.closeHud();
		else appState.openHud();
		return;
	}
	if (!appState.hudOpen) return;

	if (e.key === "ArrowRight") {
		appState.moveCursor(1);
		e.preventDefault();
	} else if (e.key === "ArrowLeft") {
		appState.moveCursor(-1);
		e.preventDefault();
	} else if (e.key === "ArrowDown") {
		appState.moveCursor(HUD_GRID_COLUMNS);
		e.preventDefault();
	} else if (e.key === "ArrowUp") {
		appState.moveCursor(-HUD_GRID_COLUMNS);
		e.preventDefault();
	} else if (e.key === "Enter") {
		appState.pickCursor();
		e.preventDefault();
	} else if (e.key === "Escape") {
		appState.closeHud();
	} else if (e.key === "Backspace") {
		appState.setQuery(appState.query.slice(0, -1));
	} else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
		appState.setQuery(appState.query + e.key);
	}
}

function openServiceFromUrl() {
	const name = new URLSearchParams(window.location.search).get("service");
	if (!name) return;
	const match = appState.services.find(
		(service) =>
			service.target === "frame" &&
			service.name.toLowerCase() === name.toLowerCase(),
	);
	if (!match) return;
	if (match.ws !== appState.activeWs) appState.setActiveWorkspace(match.ws);
	appState.openService(match.id);
}

onMount(() => {
	appState.refresh().then(openServiceFromUrl);
	appState.connectSse();

	// Live-updates appState.isMobile on resize (real phones don't cross this, but a resized
	// desktop dev window does) — the initial value is set synchronously in app-state.svelte.ts
	// itself so there's no flash of the wrong shell before this listener ever attaches.
	const mobileQuery = window.matchMedia(MOBILE_BREAKPOINT_QUERY);
	const onMobileChange = (e: MediaQueryListEvent) => {
		appState.isMobile = e.matches;
	};
	mobileQuery.addEventListener("change", onMobileChange);
	return () => mobileQuery.removeEventListener("change", onMobileChange);
});
</script>

<svelte:window onkeydown={onKeydown} />

<div class="shell">
	{#if !appState.isMobile}
		<Spine />
	{/if}
	<main>
		{@render children()}
	</main>
	{#if appState.hudOpen && !appState.isMobile}
		<Hud />
	{/if}
</div>

<style>
	.shell {
		position: relative;
		display: flex;
		height: 100svh;
		overflow: hidden;
	}
	main {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
</style>
