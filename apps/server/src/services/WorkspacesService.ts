import type { ServicesRepository } from "../db/ServicesRepository";
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
	constructor(
		private readonly repo: WorkspacesRepository,
		private readonly services: ServicesRepository,
	) {}

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

	// Reassigns member services to the next remaining workspace (by position) rather than
	// refusing the deletion — except when this is the last workspace left, since `ws` is
	// required and there'd be nowhere valid to reassign to.
	async delete(id: string) {
		const workspace = await this.getById(id);
		const [fallback] = (await this.repo.findAll()).filter((w) => w.id !== id);
		if (!fallback) {
			throw new BadRequestError("Cannot delete the only remaining workspace");
		}
		await this.services.reassignWorkspace(id, fallback.id);
		await this.repo.delete(id);
		notifyDataChanged();
		return workspace;
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

	readRaw() {
		return this.repo.readRaw();
	}
}

export type { Workspace };
