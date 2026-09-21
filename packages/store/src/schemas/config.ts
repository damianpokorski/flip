import { z } from "zod";
import { OnDiskWorkspaceSchema } from "./workspace";

// The shell's colour palette. Each is a complete, self-contained theme (not a light/dark pair
// toggled independently) since some upstream palettes only publish one variant — see the
// "-light"/"-dawn"/"-lotus" entries for the ones that do. Keep in sync with the `[data-theme]`
// blocks in apps/web/src/styles/tokens/colors.css.
export const THEMES = [
	"catppuccin-mocha",
	"rose-pine",
	"rose-pine-dawn",
	"tokyo-night",
	"tokyo-night-light",
	"kanagawa",
	"kanagawa-lotus",
	"nord",
	"dracula",
] as const;
export const ThemeSchema = z.enum(THEMES);
export type Theme = z.infer<typeof ThemeSchema>;

export const ConfigSchema = z.object({
	healthCheckTimeoutMs: z.number().int().positive().default(5_000),
	maxParallelFrameLoads: z.number().int().positive().default(3),
	uiScale: z.number().min(0.5).max(2).default(1),
	// The shell's colour palette — see THEMES above. Settings → Appearance writes this.
	theme: ThemeSchema.default("catppuccin-mocha"),
});
export type Config = z.infer<typeof ConfigSchema>;

// The combined config.yaml shape: the scalar settings above, plus every workspace (nested with
// its own services) — see OnDiskWorkspaceSchema/OnDiskServiceSchema. This is the one schema
// backing the single YamlFile instance all of servicesStore/workspacesStore/configStore share.
export const CombinedConfigSchema = ConfigSchema.extend({
	workspaces: z.array(OnDiskWorkspaceSchema).default([]),
});
export type CombinedConfig = z.infer<typeof CombinedConfigSchema>;
