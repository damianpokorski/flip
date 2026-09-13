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

// Tracks whether ` is physically still held down, so a digit pressed during that hold can be
// read as the "jump to pinned service" chord instead of a search-query keystroke. A quick tap
// (keydown immediately followed by keyup) clears this before any subsequent key is pressed, so
// normal typing into the HUD's query is unaffected.
let backtickHeld = false;

function onKeydown(e: KeyboardEvent) {
	if (e.key === "`" && !isTypingTarget(e.target)) {
		// preventDefault on every repeat too, not just the first press — otherwise holding `
		// down auto-repeats the keystroke into the (open) HUD's query via the generic
		// single-char branch below.
		e.preventDefault();
		if (!e.repeat) {
			backtickHeld = true;
			if (appState.hudOpen) appState.closeHud();
			else appState.openHud();
		}
		return;
	}
	if (backtickHeld && /^[0-9]$/.test(e.key)) {
		e.preventDefault();
		const pinned = appState.services.find((service) => service.pin === e.key);
		if (pinned) appState.openService(pinned.id);
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

function onKeyup(e: KeyboardEvent) {
	if (e.key === "`") backtickHeld = false;
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

$effect(() => {
	document.documentElement.style.setProperty(
		"--ui-scale",
		String(appState.uiScale),
	);
});

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

<svelte:window onkeydown={onKeydown} onkeyup={onKeyup} />

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
