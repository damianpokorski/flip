<script lang="ts">
import type { Snippet } from "svelte";

let {
	children,
	variant = "primary",
	size = "md",
	glyph,
	disabled = false,
	onclick,
	...rest
}: {
	children: Snippet;
	variant?: "primary" | "ghost";
	size?: "sm" | "md";
	glyph?: string;
	disabled?: boolean;
	onclick?: () => void;
	[key: string]: unknown;
} = $props();
</script>

<button
	type="button"
	class="btn"
	class:primary={variant === "primary"}
	class:sm={size === "sm"}
	{disabled}
	onclick={disabled ? undefined : onclick}
	{...rest}
>
	{#if glyph}<span class="glyph">{glyph}</span>{/if}
	{@render children()}
</button>

<style>
	.btn {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-4);
		padding: 5px var(--sp-10);
		border: var(--stroke-hair) solid transparent;
		border-radius: var(--r-row);
		background: transparent;
		color: var(--text-3);
		font-family: var(--font-display);
		font-size: var(--t-label);
		font-weight: var(--w-medium);
		letter-spacing: var(--track-wide);
		text-transform: uppercase;
		cursor: pointer;
		transition: background var(--dur-instant) var(--ease-out);
	}
	.btn.sm {
		padding: 4px var(--sp-7);
		font-size: var(--t-label-sm);
	}
	.btn.primary {
		border-color: var(--accent-line);
		background: var(--accent-fill);
		color: var(--accent);
	}
	.btn:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.glyph {
		font-family: var(--font-mono);
		font-size: var(--t-label);
	}
</style>
