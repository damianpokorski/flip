import { defineConfig } from "vite-plus";

export default defineConfig({
	lint: {
		ignorePatterns: [
			"node_modules/**",
			"**/node_modules/**",
			"apps/web/.svelte-kit/**",
			"apps/web/build/**",
			"apps/web/.output/**",
			"apps/server/dist/**",
		],
		options: {
			typeAware: false,
			typeCheck: false,
		},
	},
	fmt: {
		ignorePatterns: [
			"node_modules/**",
			"**/node_modules/**",
			"apps/web/.svelte-kit/**",
			"apps/web/build/**",
			"apps/web/.output/**",
			"apps/server/dist/**",
		],
		singleQuote: false,
		semi: true,
		sortPackageJson: true,
	},
	staged: {
		"*.{js,ts,jsx,tsx,vue,svelte,json,jsonc,css,md}": "vp check --fix",
	},
});
