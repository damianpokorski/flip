<script lang="ts">
let {
	glyph,
	size = "desktop",
	tone = "quiet",
	label,
	onclick,
}: {
	glyph: string;
	size?: "desktop" | "touch";
	tone?: "quiet" | "accent";
	label: string;
	onclick?: () => void;
} = $props();
</script>

<button
  type="button"
  class="icon-btn"
  class:touch={size === "touch"}
  class:accent={tone === "accent"}
  aria-label={label}
  {onclick}
>
  {glyph}
</button>

<style>
  .icon-btn {
    width: var(--size-spine-tile);
    height: var(--size-spine-tile);
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--r-md);
    background: var(--bg-tile);
    border: var(--stroke-hair) solid var(--border-soft);
    color: var(--text-4);
    font-family: var(--font-mono);
    font-size: 24px;
    cursor: pointer;
    transition: background var(--dur-instant) var(--ease-out);
  }
  .icon-btn.touch {
    width: var(--h-touch);
    height: var(--h-touch);
  }
  .icon-btn.accent {
    background: var(--accent-fill-strong);
    border-color: var(--accent-line-strong);
    color: var(--accent);
  }
  .icon-btn:hover {
    background: var(--accent-row-quiet);
  }
</style>
