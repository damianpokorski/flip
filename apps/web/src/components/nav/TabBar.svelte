<script lang="ts">
type Tab = string | { name: string; disabled?: boolean };

let {
	tabs,
	active,
	onselect,
}: {
	tabs: Tab[];
	active: string;
	onselect?: (name: string) => void;
} = $props();

const nameOf = (tab: Tab) => (typeof tab === "string" ? tab : tab.name);
const isDisabled = (tab: Tab) => typeof tab === "object" && !!tab.disabled;
</script>

<div class="tabbar">
	{#each tabs as tab (nameOf(tab))}
		{@const name = nameOf(tab)}
		{@const disabled = isDisabled(tab)}
		<div
			class="tab"
			class:on={name === active}
			class:disabled
			role="button"
			tabindex={disabled ? -1 : 0}
			onclick={disabled ? undefined : () => onselect?.(name)}
			onkeydown={(e) => !disabled && e.key === "Enter" && onselect?.(name)}
		>
			<span>{name}</span>
		</div>
	{/each}
</div>

<style>
	.tabbar {
		display: flex;
		gap: var(--sp-10);
	}
	.tab {
		padding: 0 0 var(--sp-5);
		border-bottom: var(--stroke-tab) solid transparent;
		cursor: pointer;
		transition: border-color var(--dur-fast) var(--ease-out);
	}
	.tab span {
		font-family: var(--font-display);
		font-size: var(--t-label);
		letter-spacing: var(--track-wider);
		text-transform: uppercase;
		color: var(--text-3);
	}
	.tab.on {
		border-bottom-color: var(--accent);
	}
	.tab.on span {
		color: var(--text-1);
	}
	.tab.disabled {
		cursor: default;
	}
	.tab.disabled span {
		color: var(--text-dim);
	}
</style>
