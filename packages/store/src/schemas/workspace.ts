import { z } from "zod";

export const WorkspaceSchema = z.object({
	// A slug derived from `name` at creation time — immutable afterward, so
	// services' `ws` references never dangle from a later rename.
	id: z.string(),
	name: z.string().min(1),
	label: z.string().length(2),
	position: z.number().int(),
});
export type Workspace = z.infer<typeof WorkspaceSchema>;

export const WorkspacesFileSchema = z.array(WorkspaceSchema).default([]);
export type WorkspacesFile = z.infer<typeof WorkspacesFileSchema>;
