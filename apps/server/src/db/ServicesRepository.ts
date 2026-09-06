import type { NewService, Service, ServicePatch } from "@flip/store";
import { servicesStore } from "@flip/store";

export type { NewService, Service, ServicePatch };

// Thin wrapper over @flip/store's YAML-backed accessors — no business logic here, that
// belongs in ServicesService.
export class ServicesRepository {
	findAll(): Promise<Service[]> {
		return servicesStore.findAll();
	}

	findById(id: string): Promise<Service | undefined> {
		return servicesStore.findById(id);
	}

	create(data: NewService): Promise<Service> {
		return servicesStore.create(data);
	}

	update(id: string, data: ServicePatch): Promise<Service | undefined> {
		return servicesStore.update(id, data);
	}

	delete(id: string): Promise<Service | undefined> {
		return servicesStore.delete(id);
	}

	reorder(orderedIds: string[]): Promise<Service[]> {
		return servicesStore.reorder(orderedIds);
	}

	reassignWorkspace(
		fromWorkspaceId: string,
		toWorkspaceId: string,
	): Promise<void> {
		return servicesStore.reassignWorkspace(fromWorkspaceId, toWorkspaceId);
	}

	readRaw(): Promise<{ content: string; updatedAt: string }> {
		return servicesStore.readRaw();
	}
}
