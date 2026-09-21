import { z } from "zod";
import { OnDiskWorkspaceSchema } from "./workspace";

export const ConfigSchema = z.object({
	healthCheckTimeoutMs: z.number().int().positive().default(5_000),
	maxParallelFrameLoads: z.number().int().positive().default(3),
	uiScale: z.number().min(0.5).max(2).default(1),
});
export type Config = z.infer<typeof ConfigSchema>;

// The combined config.yaml shape: the scalar settings above, plus every workspace (nested with
// its own services) — see OnDiskWorkspaceSchema/OnDiskServiceSchema. This is the one schema
// backing the single YamlFile instance all of servicesStore/workspacesStore/configStore share.
export const CombinedConfigSchema = ConfigSchema.extend({
	workspaces: z.array(OnDiskWorkspaceSchema).default([]),
});
export type CombinedConfig = z.infer<typeof CombinedConfigSchema>;
