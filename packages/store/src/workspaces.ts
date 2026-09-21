import { isMap, isSeq } from "yaml";
import {
	combinedConfigFile,
	ensureBlockStyle,
	findWorkspaceIndex,
} from "./combined-file";
import type { CombinedConfig } from "./schemas/config";
import type { OnDiskWorkspace, Workspace } from "./schemas/workspace";

export type NewWorkspace = Omit<Workspace, "id">;
export type WorkspacePatch = Partial<Omit<Workspace, "id">>;

function slugify(name: string): string {
	return (
		name
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "") || "workspace"
	);
}

function toApiWorkspace({
	services: _services,
	...workspace
}: OnDiskWorkspace): Workspace {
	return workspace;
}

export const workspacesStore = {
	async findAll(): Promise<Workspace[]> {
		const config = await combinedConfigFile.read();
		return config.workspaces.map(toApiWorkspace);
	},

	async findById(id: string): Promise<Workspace | undefined> {
		const config = await combinedConfigFile.read();
		const found = config.workspaces.find((workspace) => workspace.id === id);
		return found ? toApiWorkspace(found) : undefined;
	},

	// The slug is derived here (not by the caller) so a collision can be de-duped against
	// the live file content under the same lock the write itself uses.
	async create(input: NewWorkspace): Promise<Workspace> {
		let id = "";
		const config = await combinedConfigFile.mutate((doc) => {
			const data = doc.toJS() as CombinedConfig;
			const existingIds = new Set(data.workspaces.map((w) => w.id));
			const base = slugify(input.name);
			id = base;
			let suffix = 2;
			while (existingIds.has(id)) {
				id = `${base}-${suffix}`;
				suffix += 1;
			}
			doc.addIn(["workspaces"], { ...input, id, services: [] });
		});
		// biome-ignore lint/style/noNonNullAssertion: we just inserted this id above
		return toApiWorkspace(config.workspaces.find((w) => w.id === id)!);
	},

	async update(
		id: string,
		patch: WorkspacePatch,
	): Promise<Workspace | undefined> {
		const config = await combinedConfigFile.mutate((doc) => {
			const wsIndex = findWorkspaceIndex(doc, id);
			if (wsIndex === -1) return;
			for (const [key, value] of Object.entries(patch)) {
				doc.setIn(["workspaces", wsIndex, key], value);
			}
		});
		const found = config.workspaces.find((workspace) => workspace.id === id);
		return found ? toApiWorkspace(found) : undefined;
	},

	async reorder(orderedIds: string[]): Promise<Workspace[]> {
		const config = await combinedConfigFile.mutate((doc) => {
			const seq = doc.get("workspaces", true);
			if (!isSeq(seq)) return;
			const byId = new Map(
				seq.items.map((item) => [
					isMap(item) ? item.get("id") : undefined,
					item,
				]),
			);
			const reordered = orderedIds
				.map((id) => byId.get(id))
				.filter((item) => item !== undefined);
			seq.items = reordered;
		});
		return config.workspaces.map(toApiWorkspace);
	},

	// Reassigns `id`'s services onto `fallbackId`'s list and removes `id`, in one atomic write —
	// used when a workspace is deleted (WorkspacesService.delete), so there's never a window
	// where services have been reassigned but the workspace hasn't been removed yet, or vice
	// versa (the two used to be separate mutate() calls against separate files).
	async deleteWithCascade(
		id: string,
		fallbackId: string,
	): Promise<Workspace | undefined> {
		let deleted: Workspace | undefined;
		await combinedConfigFile.mutate((doc) => {
			const fromIndex = findWorkspaceIndex(doc, id);
			if (fromIndex === -1) return;
			const data = doc.toJS() as CombinedConfig;
			// biome-ignore lint/style/noNonNullAssertion: fromIndex above already confirmed existence
			deleted = toApiWorkspace(data.workspaces[fromIndex]!);
			const toIndex = findWorkspaceIndex(doc, fallbackId);
			if (toIndex !== -1) {
				const fromSeq = doc.getIn(["workspaces", fromIndex, "services"], true);
				const toSeq = doc.getIn(["workspaces", toIndex, "services"], true);
				if (isSeq(fromSeq) && isSeq(toSeq)) {
					ensureBlockStyle(doc, ["workspaces", toIndex, "services"]);
					toSeq.items.push(...fromSeq.items);
				}
			}
			doc.deleteIn(["workspaces", fromIndex]);
		});
		return deleted;
	},
};
