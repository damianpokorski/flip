import { z } from "zod";

export const ConfigSchema = z.object({
	healthCheckIntervalMs: z.number().int().positive().default(30_000),
	healthCheckTimeoutMs: z.number().int().positive().default(5_000),
});
export type Config = z.infer<typeof ConfigSchema>;
