<script lang="ts">
// Not consumed anywhere this pass — mobile settings (the only place this appears in the
// source design) is deferred to a future pass. Built now for completeness of the ported
// component library.
let {
	name,
	sub,
	glyph,
	glyphHue,
	meta,
	touch = false,
	onclick,
}: {
	name: string;
	sub?: string;
	glyph: string;
	glyphHue: string;
	meta?: string;
	touch?: boolean;
	onclick?: () => void;
} = $props();
</script>

<div class="row" class:touch {onclick} role="button" tabindex="0" onkeydown={(e) => e.key === "Enter" && onclick?.()}>
	<span class="glyph" style:color={glyphHue}>{glyph}</span>
	<div class="info">
		<span class="name">{name}</span>
		{#if sub}<span class="sub">{sub}</span>{/if}
	</div>
	{#if meta}<span class="meta">{meta}</span>{/if}
	<span class="chevron">›</span>
</div>

<style>
	.row {
		min-height: var(--h-row);
		box-sizing: border-box;
		display: flex;
		align-items: center;
		gap: var(--sp-9);
		padding: 7px var(--sp-8);
		border-bottom: var(--stroke-hair) solid var(--border-hair);
		cursor: pointer;
	}
	.row.touch {
		min-height: var(--h-touch-row);
		padding: 10px 13px;
	}
	.glyph {
		width: 26px;
		height: 26px;
		flex: none;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--r-md);
		background: var(--bg-tile);
		border: var(--stroke-hair) solid var(--border-hair);
		font-family: var(--font-mono);
		font-size: 13px;
	}
	.row.touch .glyph {
		width: 32px;
		height: 32px;
		font-size: 15px;
	}
	.info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.name {
		font-family: var(--font-display);
		font-size: var(--t-label);
		letter-spacing: var(--track-normal);
		color: var(--text-1);
	}
	.row.touch .name {
		font-size: var(--t-display-sm);
	}
	.sub {
		font-family: var(--font-mono);
		font-size: var(--t-mono-2xs);
		color: var(--text-5);
	}
	.meta {
		font-family: var(--font-mono);
		font-size: var(--t-mono-xs);
		color: var(--text-4);
	}
	.chevron {
		font-family: var(--font-mono);
		font-size: 14px;
		color: var(--text-faint);
	}
</style>
