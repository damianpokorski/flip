import type { NewWorkspace, Workspace, WorkspacePatch } from "@flip/store";
import { workspacesStore } from "@flip/store";

export type { NewWorkspace, Workspace, WorkspacePatch };

// Thin wrapper over @flip/store's YAML-backed accessors — no business logic here, that
// belongs in WorkspacesService.
export class WorkspacesRepository {
	findAll(): Promise<Workspace[]> {
		return workspacesStore.findAll();
	}

	findById(id: string): Promise<Workspace | undefined> {
		return workspacesStore.findById(id);
	}

	create(data: NewWorkspace): Promise<Workspace> {
		return workspacesStore.create(data);
	}

	update(id: string, data: WorkspacePatch): Promise<Workspace | undefined> {
		return workspacesStore.update(id, data);
	}

	delete(id: string): Promise<Workspace | undefined> {
		return workspacesStore.delete(id);
	}

	reorder(orderedIds: string[]): Promise<Workspace[]> {
		return workspacesStore.reorder(orderedIds);
	}

	readRaw(): Promise<{ content: string; updatedAt: string }> {
		return workspacesStore.readRaw();
	}
}
