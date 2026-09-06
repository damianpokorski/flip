<script lang="ts">
let {
	on = $bindable(false),
	label,
	hint,
}: {
	on?: boolean;
	label: string;
	hint?: string;
} = $props();
</script>

<div class="toggle" role="switch" aria-checked={on} tabindex="0" onclick={() => (on = !on)} onkeydown={(e) => e.key === "Enter" && (on = !on)}>
	<span class="track" class:on>
		<span class="thumb" class:on></span>
	</span>
	<span class="label">{label}</span>
	<span class="spacer"></span>
	{#if hint}<span class="hint">{hint}</span>{/if}
</div>

<style>
	.toggle {
		display: flex;
		align-items: center;
		gap: var(--sp-5);
		padding: var(--sp-6) var(--sp-8);
		border-radius: var(--r-md);
		background: var(--bg-panel);
		border: var(--stroke-hair) solid var(--border-hair);
		cursor: pointer;
	}
	.track {
		width: 26px;
		height: 14px;
		flex: none;
		position: relative;
		border-radius: 8px;
		background: var(--ctp-surface-0);
		transition: background var(--dur-fast) var(--ease-out);
	}
	.track.on {
		background: var(--accent-fill-strong);
		border: var(--stroke-hair) solid var(--accent-line);
	}
	.thumb {
		position: absolute;
		left: 2px;
		top: 2px;
		width: 10px;
		height: 10px;
		border-radius: var(--r-dot);
		background: var(--text-5);
		transition: left var(--dur-fast) var(--ease-out);
	}
	.thumb.on {
		left: 13px;
		background: var(--accent);
	}
	.label {
		font-family: var(--font-display);
		font-size: var(--t-label);
		color: var(--text-2);
	}
	.spacer {
		flex: 1;
	}
	.hint {
		font-family: var(--font-mono);
		font-size: var(--t-mono-2xs);
		color: var(--text-4);
	}
</style>
