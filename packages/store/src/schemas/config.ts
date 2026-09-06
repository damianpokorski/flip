import { z } from "zod";

export const ConfigSchema = z.object({
	healthCheckTimeoutMs: z.number().int().positive().default(5_000),
});
export type Config = z.infer<typeof ConfigSchema>;
