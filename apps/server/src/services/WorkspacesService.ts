import type {
	NewWorkspace,
	Workspace,
	WorkspacesRepository,
} from "../db/WorkspacesRepository";
import { BadRequestError, NotFoundError } from "../errors";
import { notifyDataChanged } from "../events";

export interface WorkspaceBody {
	name: string;
	label: string;
}

export class WorkspacesService {
	constructor(private readonly repo: WorkspacesRepository) {}

	getAll() {
		return this.repo.findAll();
	}

	async getById(id: string) {
		const workspace = await this.repo.findById(id);
		if (!workspace) throw new NotFoundError("Workspace not found");
		return workspace;
	}

	async create(data: NewWorkspace) {
		const workspace = await this.repo.create(data);
		notifyDataChanged();
		return workspace;
	}

	async update(id: string, data: WorkspaceBody) {
		await this.getById(id);
		const workspace = await this.repo.update(id, data);
		notifyDataChanged();
		// biome-ignore lint/style/noNonNullAssertion: getById above already confirmed existence
		return workspace!;
	}

	// Reassigns member services to the next remaining workspace (by order) rather than
	// refusing the deletion — except when this is the last workspace left, since a service
	// always belongs to exactly one workspace and there'd be nowhere valid to reassign to.
	// The reassignment and the deletion happen as one atomic write (see
	// workspacesStore.deleteWithCascade) — there's no window where services have moved but
	// the workspace hasn't been removed yet, or vice versa.
	async delete(id: string) {
		const workspace = await this.getById(id);
		const [fallback] = (await this.repo.findAll()).filter((w) => w.id !== id);
		if (!fallback) {
			throw new BadRequestError("Cannot delete the only remaining workspace");
		}
		const deleted = await this.repo.deleteWithCascade(id, fallback.id);
		notifyDataChanged();
		return deleted ?? workspace;
	}

	async reorder(ids: string[]) {
		const current = await this.repo.findAll();
		const currentIds = new Set(current.map((workspace) => workspace.id));
		const sameSet =
			ids.length === currentIds.size && ids.every((id) => currentIds.has(id));
		if (!sameSet) {
			throw new BadRequestError(
				"ids must be exactly the set of existing workspace ids",
			);
		}
		const workspaces = await this.repo.reorder(ids);
		notifyDataChanged();
		return workspaces;
	}
}

export type { Workspace };
