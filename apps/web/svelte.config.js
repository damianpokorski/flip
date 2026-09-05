import adapter from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),

	kit: {
		// FLIP is a client-only SPA — the Elysia server serves the built static output
		// and provides the JSON API, so there's no SvelteKit server runtime involved.
		adapter: adapter({
			fallback: "index.html",
		}),
	},
};

export default config;
