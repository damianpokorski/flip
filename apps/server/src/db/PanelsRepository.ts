import type { NewPanel, Panel, PanelPatch } from "@flip/store";
import { panelsStore } from "@flip/store";

export type { NewPanel, Panel, PanelPatch };

// Thin wrapper over @flip/store's YAML-backed accessors — no business logic here, that
// belongs in PanelsService.
export class PanelsRepository {
	findAll(): Promise<Panel[]> {
		return panelsStore.findAll();
	}

	findById(id: string): Promise<Panel | undefined> {
		return panelsStore.findById(id);
	}

	create(data: NewPanel): Promise<Panel> {
		return panelsStore.create(data);
	}

	update(id: string, data: PanelPatch): Promise<Panel | undefined> {
		return panelsStore.update(id, data);
	}

	delete(id: string): Promise<Panel | undefined> {
		return panelsStore.delete(id);
	}

	reorder(orderedIds: string[]): Promise<Panel[]> {
		return panelsStore.reorder(orderedIds);
	}
}
