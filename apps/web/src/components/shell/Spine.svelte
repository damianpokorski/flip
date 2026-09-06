<script lang="ts">
import { goto } from "$app/navigation";
import { page } from "$app/state";
import { appState } from "$lib/app-state.svelte";
import IconButton from "../core/IconButton.svelte";
import WorkspacePill from "../nav/WorkspacePill.svelte";

const onShellRoute = $derived(page.url.pathname === "/");
const onSettingsRoute = $derived(page.url.pathname.startsWith("/settings"));

function selectWorkspace(id: string) {
	appState.setActiveWorkspace(id);
	goto("/");
}
</script>

<div class="spine">
	<IconButton glyph="⌕" label="Search services" onclick={() => appState.openHud()} />
	<div class="divider"></div>
	{#each appState.workspaces as workspace (workspace.id)}
		<div data-testid="spine-workspace-pill" data-workspace-id={workspace.id}>
			<WorkspacePill
				label={workspace.label}
				active={workspace.id === appState.activeWs && onShellRoute}
				onclick={() => selectWorkspace(workspace.id)}
			/>
		</div>
	{/each}
	<span class="spacer"></span>
	<div class="add-workspace" onclick={() => goto("/settings/workspaces")} role="button" tabindex="0" onkeydown={(e) => e.key === "Enter" && goto("/settings/workspaces")}>
		+
	</div>
	<IconButton glyph="⚙" label="Settings" tone={onSettingsRoute ? "accent" : "quiet"} onclick={() => goto("/settings/services")} />
</div>

<style>
	.spine {
		width: var(--w-spine);
		flex: none;
		background: var(--bg-spine);
		border-right: var(--stroke-hair) solid var(--border-hair);
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: var(--sp-8) 0;
		gap: var(--sp-6);
		height: 100%;
		box-sizing: border-box;
	}
	.divider {
		width: var(--sp-11);
		height: 1px;
		background: var(--border-soft);
		margin: var(--sp-2) 0;
	}
	.spacer {
		flex: 1;
	}
	.add-workspace {
		width: var(--size-spine-tile);
		height: var(--size-spine-tile);
		border-radius: var(--r-md);
		border: 1px dashed var(--border-dashed);
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: var(--font-mono);
		font-size: 13px;
		color: var(--text-dim);
		cursor: pointer;
	}
</style>
