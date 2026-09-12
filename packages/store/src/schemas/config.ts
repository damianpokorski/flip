import { z } from "zod";

export const ConfigSchema = z.object({
	healthCheckTimeoutMs: z.number().int().positive().default(5_000),
	maxParallelFrameLoads: z.number().int().positive().default(3),
	uiScale: z.number().min(0.5).max(2).default(1),
});
export type Config = z.infer<typeof ConfigSchema>;
