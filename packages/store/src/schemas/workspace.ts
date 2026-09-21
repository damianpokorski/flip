import { z } from "zod";
import { OnDiskServicesSchema } from "./service";

// The domain/wire shape. `position` doesn't exist here (or on disk): a workspace's order is
// implicit in its position within the top-level `workspaces` array in config.yaml.
export const WorkspaceSchema = z.object({
	// A slug derived from `name` at creation time — immutable afterward, so
	// services' `ws` references never dangle from a later rename.
	id: z.string(),
	name: z.string().min(1),
	label: z.string().length(2),
});
export type Workspace = z.infer<typeof WorkspaceSchema>;

// The on-disk shape — a workspace plus its nested services (see schemas/service.ts's
// OnDiskServiceSchema for why `ws` isn't stored on the service itself).
export const OnDiskWorkspaceSchema = WorkspaceSchema.extend({
	services: OnDiskServicesSchema,
});
export type OnDiskWorkspace = z.infer<typeof OnDiskWorkspaceSchema>;

// The legacy flat workspaces.yaml shape (a global `position`, no nested services) — kept only
// so migrate-legacy-config.ts can parse a pre-migration file; nothing else should reference this.
export const LegacyWorkspaceSchema = WorkspaceSchema.extend({
	position: z.number().int(),
});
export type LegacyWorkspace = z.infer<typeof LegacyWorkspaceSchema>;

export const LegacyWorkspacesFileSchema = z
	.array(LegacyWorkspaceSchema)
	.default([]);
export type LegacyWorkspacesFile = z.infer<typeof LegacyWorkspacesFileSchema>;
