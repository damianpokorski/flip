<script lang="ts">
import Frame from "../components/shell/Frame.svelte";
import Sidebar from "../components/shell/Sidebar.svelte";
</script>

<div class="workspace-view">
	<Sidebar />
	<Frame />
</div>

<style>
	.workspace-view {
		flex: 1;
		min-height: 0;
		display: flex;
	}
</style>
