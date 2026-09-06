<script lang="ts">
import type { Snippet } from "svelte";

let {
	value = $bindable(""),
	placeholder,
	glyph,
	size = "md",
	focused = false,
	suffix,
	autofocus = false,
	ref = $bindable<HTMLInputElement | undefined>(undefined),
	...rest
}: {
	value?: string;
	placeholder?: string;
	glyph?: string;
	size?: "lg" | "md" | "sm";
	focused?: boolean;
	suffix?: Snippet;
	autofocus?: boolean;
	ref?: HTMLInputElement;
	[key: string]: unknown;
} = $props();

let domFocused = $state(false);
let showFocused = $derived(focused || domFocused);
</script>

<div class="input" class:focused={showFocused} class:lg={size === "lg"} class:sm={size === "sm"}>
	{#if glyph}<span class="glyph">{glyph}</span>{/if}
	<!-- svelte-ignore a11y_autofocus -->
	<input
		bind:this={ref}
		bind:value
		{placeholder}
		{autofocus}
		onfocus={() => (domFocused = true)}
		onblur={() => (domFocused = false)}
		{...rest}
	/>
	{#if showFocused}<span class="caret"></span>{/if}
	{@render suffix?.()}
</div>

<style>
	.input {
		display: flex;
		align-items: center;
		gap: var(--sp-5);
		padding: 4px 2px;
		border-bottom: var(--stroke-hair) solid var(--border-mid);
		transition: box-shadow var(--dur-fast) var(--ease-out);
	}
	.input.lg {
		padding: 5px 2px 7px;
	}
	.input.focused {
		border-bottom: var(--stroke-active) solid var(--accent);
		box-shadow: var(--glow-input);
	}
	.glyph {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--text-dim);
	}
	.input.focused .glyph {
		color: var(--accent);
	}
	input {
		flex: 1;
		min-width: 0;
		background: none;
		border: none;
		outline: none;
		padding: 0;
		font-family: var(--font-mono);
		font-size: var(--t-mono-md);
		letter-spacing: var(--track-normal);
		color: var(--text-1);
	}
	.input.lg input {
		font-size: var(--t-mono-lg);
	}
	.input.sm input {
		font-size: var(--t-mono-sm);
	}
	input::placeholder {
		color: var(--text-dim);
	}
	.caret {
		width: var(--stroke-active);
		height: 13px;
		background: var(--accent);
		flex: none;
	}
	.input.lg .caret {
		height: 15px;
	}
</style>
