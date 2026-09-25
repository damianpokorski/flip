import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";

// Served from https://damianpokorski.github.io/flip/ (GitHub Pages project site), so every
// internal link and asset must live under `base`. Drop `base` if a custom domain is added.
export default defineConfig({
	site: "https://damianpokorski.github.io",
	base: "/flip",
	integrations: [
		starlight({
			title: "FLIP",
			description:
				"Fast Local Iframe Panel(s) - a self-hosted dashboard shell for your homelab.",
			favicon: "/favicon.svg",
			social: [
				{
					icon: "github",
					label: "GitHub",
					href: "https://github.com/damianpokorski/flip",
				},
			],
			customCss: [
				"@fontsource/oswald/500.css",
				"@fontsource/oswald/600.css",
				"@fontsource/fira-code/400.css",
				"./src/styles/flip.css",
			],
			// `autogenerate.directory` matches on the file's on-disk path inside .articles/ (so the
			// numbered folder names), not on the published slug, which has the numeric prefixes
			// stripped in content.config.ts.
			sidebar: [
				{
					label: "Getting started",
					items: [{ autogenerate: { directory: "01-getting-started" } }],
				},
				{
					label: "Guides",
					items: [{ autogenerate: { directory: "02-guides" } }],
				},
				{
					label: "Concepts",
					items: [{ autogenerate: { directory: "03-concepts" } }],
				},
				{
					label: "Reference",
					items: [{ autogenerate: { directory: "04-reference" } }],
				},
			],
		}),
	],
});
