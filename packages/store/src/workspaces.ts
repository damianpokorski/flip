import { DEFAULT_WORKSPACES_YAML } from "./defaults";
import { YamlFile } from "./fs-yaml";
import { type Workspace, WorkspacesFileSchema } from "./schemas/workspace";

const workspacesFile = new YamlFile(
	"workspaces.yaml",
	WorkspacesFileSchema,
	DEFAULT_WORKSPACES_YAML,
);

export type NewWorkspace = Omit<Workspace, "id" | "position">;
export type WorkspacePatch = Partial<Omit<Workspace, "id" | "position">>;

function slugify(name: string): string {
	return (
		name
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "") || "workspace"
	);
}

export const workspacesStore = {
	ensureExists: () => workspacesFile.ensureExists(),
	onChange: (listener: (workspaces: Workspace[]) => void) =>
		workspacesFile.onChange(listener),
	watch: () => workspacesFile.watch(),
	readRaw: () => workspacesFile.readRaw(),

	async findAll(): Promise<Workspace[]> {
		const workspaces = await workspacesFile.read();
		return [...workspaces].sort((a, b) => a.position - b.position);
	},

	async findById(id: string): Promise<Workspace | undefined> {
		const workspaces = await workspacesFile.read();
		return workspaces.find((workspace) => workspace.id === id);
	},

	// The slug is derived here (not by the caller) so a collision can be de-duped against
	// the live file content under the same lock the write itself uses.
	async create(input: NewWorkspace): Promise<Workspace> {
		let id = "";
		const workspaces = await workspacesFile.mutate((doc) => {
			const current = (doc.toJS() ?? []) as Workspace[];
			const existingIds = new Set(current.map((workspace) => workspace.id));
			const base = slugify(input.name);
			id = base;
			let suffix = 2;
			while (existingIds.has(id)) {
				id = `${base}-${suffix}`;
				suffix += 1;
			}
			const position =
				current.length === 0
					? 0
					: Math.max(...current.map((workspace) => workspace.position)) + 1;
			doc.add({ ...input, id, position });
		});
		// biome-ignore lint/style/noNonNullAssertion: we just inserted this id above
		return workspaces.find((workspace) => workspace.id === id)!;
	},

	async update(
		id: string,
		patch: WorkspacePatch,
	): Promise<Workspace | undefined> {
		const workspaces = await workspacesFile.mutate((doc) => {
			const current = (doc.toJS() ?? []) as Workspace[];
			const index = current.findIndex((workspace) => workspace.id === id);
			if (index === -1) return;
			for (const [key, value] of Object.entries(patch)) {
				doc.setIn([index, key], value);
			}
		});
		return workspaces.find((workspace) => workspace.id === id);
	},

	async delete(id: string): Promise<Workspace | undefined> {
		let deleted: Workspace | undefined;
		await workspacesFile.mutate((doc) => {
			const current = (doc.toJS() ?? []) as Workspace[];
			const index = current.findIndex((workspace) => workspace.id === id);
			if (index === -1) return;
			deleted = current[index];
			doc.deleteIn([index]);
		});
		return deleted;
	},

	async reorder(orderedIds: string[]): Promise<Workspace[]> {
		const workspaces = await workspacesFile.mutate((doc) => {
			const current = (doc.toJS() ?? []) as Workspace[];
			const indexById = new Map(
				current.map((workspace, index) => [workspace.id, index]),
			);
			orderedIds.forEach((id, position) => {
				const index = indexById.get(id);
				if (index !== undefined) doc.setIn([index, "position"], position);
			});
		});
		return [...workspaces].sort((a, b) => a.position - b.position);
	},
};
