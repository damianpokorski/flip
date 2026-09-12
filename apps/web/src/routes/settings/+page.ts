import { redirect } from "@sveltejs/kit";
import { appState } from "$lib/app-state.svelte";

export const ssr = false;

// On mobile, /settings is a real entry-list screen (rendered by +page.svelte); on desktop it
// has no UI of its own and always redirects straight into the first tab.
export function load() {
	if (!appState.isMobile) redirect(307, "/settings/services");
}
