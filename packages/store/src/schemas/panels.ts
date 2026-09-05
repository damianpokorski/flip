import { z } from "zod";

export const PanelSchema = z.object({
	id: z.string(),
	title: z.string().min(1),
	url: z.string().url(),
	position: z.number().int(),
	hidden: z.boolean().default(false),
	healthCheckUrl: z.string().url().nullable().default(null),
	healthCheckIntervalMs: z.number().int().positive().nullable().default(null),
});
export type Panel = z.infer<typeof PanelSchema>;

export const PanelsFileSchema = z.array(PanelSchema).default([]);
export type PanelsFile = z.infer<typeof PanelsFileSchema>;
