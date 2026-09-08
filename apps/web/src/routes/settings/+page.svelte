<script lang="ts">
// On desktop, +page.ts always redirects away before this ever renders. On mobile, this is
// the Settings entry list: 3 rows for the routes that actually exist (Shortcuts is dropped
// from the list entirely — meaningless without a keyboard, still reachable by URL directly;
// Health checks/Embedding aren't their own pages, they're fields inside the service form).
import { goto } from "$app/navigation";
import { appState } from "$lib/app-state.svelte";
import SettingsRow from "../../components/settings/SettingsRow.svelte";
</script>

{#if appState.isMobile}
	<div class="rows">
		<SettingsRow
			touch
			glyph="▦"
			glyphHue="var(--tile-sapphire)"
			name="Services"
			sub="names, urls, icons, health"
			meta={String(appState.services.length)}
			onclick={() => goto("/settings/services")}
		/>
		<SettingsRow
			touch
			glyph="⬓"
			glyphHue="var(--tile-mauve)"
			name="Workspaces"
			sub="grouping and order"
			meta={String(appState.workspaces.length)}
			onclick={() => goto("/settings/workspaces")}
		/>
		<SettingsRow
			touch
			glyph="≡"
			glyphHue="var(--tile-lavender)"
			name="Config as code"
			sub="the whole setup as YAML"
			meta="read only"
			onclick={() => goto("/settings/config")}
		/>
	</div>
{/if}

<style>
	.rows {
		display: flex;
		flex-direction: column;
		gap: 1px;
		border-radius: var(--r-xl);
		overflow: hidden;
		background: var(--bg-panel);
		border: var(--stroke-hair) solid var(--border-hair);
		margin: var(--sp-10) var(--sp-11);
	}
</style>
