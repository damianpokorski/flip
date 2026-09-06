<script lang="ts">
import { bucketFor } from "@flip/store/health-bucket";

let { ms, size = 5 }: { ms: number | null; size?: number } = $props();

const BUCKET_VAR = {
	fast: "var(--health-fast)",
	ok: "var(--health-ok)",
	slow: "var(--health-slow)",
	down: "var(--health-down)",
} as const;
</script>

<span class="dot" style:width="{size}px" style:height="{size}px" style:background={BUCKET_VAR[bucketFor(ms)]}></span>

<style>
	.dot {
		flex: none;
		border-radius: var(--r-dot);
	}
</style>
