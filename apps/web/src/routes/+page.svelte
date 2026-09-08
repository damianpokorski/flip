<script lang="ts">
import { appState } from "$lib/app-state.svelte";
import Frame from "../components/shell/Frame.svelte";
import MobileTopBar from "../components/shell/MobileTopBar.svelte";
import RecentsBar from "../components/shell/RecentsBar.svelte";
import Sidebar from "../components/shell/Sidebar.svelte";
import Switcher from "../components/shell/Switcher.svelte";

let frame: Frame | undefined = $state();
// Deliberately local, not appState: nothing outside this page needs to know the switcher is
// open, and it's not appState.hudOpen — that flag's only consumer is the desktop Hud guard.
let switcherOpen = $state(false);
</script>

<div class="workspace-view" class:mobile={appState.isMobile}>
	{#if !appState.isMobile}
		<Sidebar />
	{:else}
		<MobileTopBar
			onReload={() => frame?.reload()}
			onOpenExternally={() => frame?.openExternally()}
		/>
	{/if}

	<Frame bind:this={frame} topbar={!appState.isMobile} />

	{#if appState.isMobile}
		<RecentsBar
			onOpenSwitcher={() => {
				appState.setQuery("");
				switcherOpen = true;
			}}
		/>
		{#if switcherOpen}
			<Switcher
				onClose={() => (switcherOpen = false)}
				onPick={(id) => {
					appState.openService(id);
					switcherOpen = false;
				}}
			/>
		{/if}
	{/if}
</div>

<style>
	.workspace-view {
		flex: 1;
		min-height: 0;
		display: flex;
		position: relative;
	}
	.workspace-view.mobile {
		flex-direction: column;
	}
</style>
