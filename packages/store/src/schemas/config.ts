import { z } from "zod";

export const ConfigSchema = z.object({
	healthCheckTimeoutMs: z.number().int().positive().default(5_000),
	maxParallelFrameLoads: z.number().int().positive().default(3),
});
export type Config = z.infer<typeof ConfigSchema>;
