<script lang="ts">
import { goto } from "$app/navigation";
import { page } from "$app/state";
import { appState } from "$lib/app-state.svelte";
import IconButton from "../../components/core/IconButton.svelte";
import TabBar from "../../components/nav/TabBar.svelte";

const { children } = $props();

const TAB_ROUTES: Record<string, string> = {
	Services: "/settings/services",
	Workspaces: "/settings/workspaces",
	Shortcuts: "/settings/shortcuts",
	Config: "/settings/config",
};

const activeTab = $derived(
	page.url.pathname.startsWith("/settings/workspaces")
		? "Workspaces"
		: page.url.pathname.startsWith("/settings/shortcuts")
			? "Shortcuts"
			: page.url.pathname.startsWith("/settings/config")
				? "Config"
				: "Services",
);

// The mobile entry list (/settings itself) is its own screen with a back button, not a tab
// bar — every real sub-route (/settings/services etc.), even reached from mobile, keeps the
// desktop header as-is: those pages aren't in scope for a mobile redesign, per the source
// design's own note that "each row pushes the same route desktop uses."
const isMobileEntryList = $derived(
	appState.isMobile && page.url.pathname === "/settings",
);
</script>

<div class="page">
  <div class="head">
    {#if isMobileEntryList}
      <div class="title-row mobile">
        <IconButton glyph="←" size="touch" label="Back" onclick={() => goto("/")} />
        <span class="title mobile">SETTINGS</span>
      </div>
    {:else}
      <div class="title-row">
        <span class="title">SETTINGS</span>
      </div>
      <TabBar
        tabs={[
          "Services",
          "Workspaces",
          "Shortcuts",
          "Config",
          { name: "Account", disabled: true },
        ]}
        active={activeTab}
        onselect={(name) => {
          const path = TAB_ROUTES[name];
          if (path) goto(path);
        }}
      />
    {/if}
  </div>
  {@render children()}
</div>

<style>
  .page {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    background: var(--bg-app);
  }
  .head {
    flex: none;
    padding: var(--sp-9) var(--sp-11) 0;
    border-bottom: var(--stroke-hair) solid var(--border-hair);
  }
  .title-row {
    display: flex;
    align-items: baseline;
    gap: var(--sp-7);
    padding-bottom: var(--sp-8);
  }
  .title-row.mobile {
    align-items: center;
    gap: var(--sp-6);
    padding-bottom: var(--sp-9);
  }
  .title {
    font-family: var(--font-display);
    font-size: var(--t-display-sm);
    font-weight: var(--w-semibold);
    letter-spacing: var(--track-head);
    color: var(--text-1);
  }
  .title.mobile {
    font-size: var(--t-display-md);
  }
</style>
