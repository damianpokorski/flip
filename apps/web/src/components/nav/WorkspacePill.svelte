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

<div class="pill" class:active {onclick} role="button" tabindex="0" onkeydown={(e) => e.key === "Enter" && onclick?.()}>
	<span class="marker"></span>
	<span class="label">{label}</span>
</div>

<style>
	.pill {
		position: relative;
		width: var(--size-spine-tile);
		height: var(--size-spine-tile);
		flex: none;
		border-radius: var(--r-md);
		background: var(--bg-tile);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: background var(--dur-instant) var(--ease-out);
	}
	.pill.active {
		background: var(--accent-fill-strong);
	}
	.label {
		font-family: var(--font-display);
		font-size: var(--t-label-sm);
		font-weight: var(--w-medium);
		letter-spacing: var(--track-wide);
		color: var(--text-4);
	}
	.pill.active .label {
		color: var(--accent);
	}
	.marker {
		position: absolute;
		left: -10px;
		top: 8px;
		width: 3px;
		height: 16px;
		border-radius: 2px;
		background: transparent;
	}
	.pill.active .marker {
		background: var(--accent);
	}
</style>
