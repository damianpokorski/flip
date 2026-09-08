<script lang="ts">
let {
	label,
	active = false,
	onclick,
}: {
	label: string;
	active?: boolean;
	onclick?: () => void;
} = $props();
</script>

<span
	class="chip"
	class:active
	{onclick}
	role="button"
	tabindex="0"
	onkeydown={(e) => e.key === "Enter" && onclick?.()}
>
	{label}
</span>

<style>
	.chip {
		display: inline-flex;
		align-items: center;
		padding: var(--sp-7) 13px;
		border-radius: var(--r-md);
		background: var(--bg-tile);
		border: var(--stroke-hair) solid var(--border-hair);
		color: var(--text-4);
		font-family: var(--font-display);
		font-size: var(--t-label-xs);
		font-weight: var(--w-medium);
		letter-spacing: var(--track-head);
		text-transform: uppercase;
		white-space: nowrap;
		cursor: pointer;
		transition: background var(--dur-instant) var(--ease-out);
	}
	.chip.active {
		background: var(--accent-fill);
		border-color: var(--accent-line);
		color: var(--accent);
	}
</style>
