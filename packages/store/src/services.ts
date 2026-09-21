import { isMap, isSeq } from "yaml";
import {
	combinedConfigFile,
	ensureBlockStyle,
	findServiceLocation,
	findWorkspaceIndex,
} from "./combined-file";
import type { CombinedConfig } from "./schemas/config";
import type { Service } from "./schemas/service";

export type NewService = Service;
export type ServicePatch = Partial<Omit<Service, "id">>;

// Flattens every workspace's nested services into one list, synthesizing `ws` from each
// service's parent workspace — the wire/domain `Service` shape still has `ws`, even though it
// isn't stored on disk (see schemas/service.ts's OnDiskServiceSchema).
function flattenServices(config: CombinedConfig): Service[] {
	return config.workspaces.flatMap((workspace) =>
		workspace.services.map((service) => ({ ...service, ws: workspace.id })),
	);
}

export const servicesStore = {
	async findAll(): Promise<Service[]> {
		const config = await combinedConfigFile.read();
		return flattenServices(config);
	},

	async findById(id: string): Promise<Service | undefined> {
		const config = await combinedConfigFile.read();
		return flattenServices(config).find((service) => service.id === id);
	},

	async create(input: NewService): Promise<Service> {
		const config = await combinedConfigFile.mutate((doc) => {
			const wsIndex = findWorkspaceIndex(doc, input.ws);
			if (wsIndex === -1) return;
			const { ws: _ws, ...onDiskFields } = input;
			ensureBlockStyle(doc, ["workspaces", wsIndex, "services"]);
			doc.addIn(["workspaces", wsIndex, "services"], onDiskFields);
		});
		// biome-ignore lint/style/noNonNullAssertion: we just inserted this id above
		return flattenServices(config).find((service) => service.id === input.id)!;
	},

	async update(id: string, patch: ServicePatch): Promise<Service | undefined> {
		const config = await combinedConfigFile.mutate((doc) => {
			const location = findServiceLocation(doc, id);
			if (!location) return;
			const { wsIndex, svcIndex, workspaceId } = location;
			const { ws: newWs, ...rest } = patch;
			for (const [key, value] of Object.entries(rest)) {
				doc.setIn(["workspaces", wsIndex, "services", svcIndex, key], value);
			}
			if (newWs !== undefined && newWs !== workspaceId) {
				const newWsIndex = findWorkspaceIndex(doc, newWs);
				if (newWsIndex === -1) return;
				// Move the raw YAML node (not a plain-JS round trip) so any comment on this
				// service's entry survives the move to its new workspace.
				const node = doc.getIn(
					["workspaces", wsIndex, "services", svcIndex],
					true,
				);
				doc.deleteIn(["workspaces", wsIndex, "services", svcIndex]);
				ensureBlockStyle(doc, ["workspaces", newWsIndex, "services"]);
				doc.addIn(["workspaces", newWsIndex, "services"], node);
			}
		});
		return flattenServices(config).find((service) => service.id === id);
	},

	async delete(id: string): Promise<Service | undefined> {
		let deleted: Service | undefined;
		await combinedConfigFile.mutate((doc) => {
			const location = findServiceLocation(doc, id);
			if (!location) return;
			const { wsIndex, svcIndex, workspaceId } = location;
			const data = doc.toJS() as CombinedConfig;
			// biome-ignore lint/style/noNonNullAssertion: location above already confirmed existence
			const onDiskService = data.workspaces[wsIndex]!.services[svcIndex]!;
			deleted = { ...onDiskService, ws: workspaceId };
			doc.deleteIn(["workspaces", wsIndex, "services", svcIndex]);
		});
		return deleted;
	},

	// Reorders the services within a single workspace — `orderedIds` must be exactly that
	// workspace's current service ids (validated by ServicesService.reorder). Reshuffles the
	// seq's existing item nodes in place, rather than replacing the array with fresh plain-JS
	// objects, so every entry's comments survive the reorder.
	async reorder(workspaceId: string, orderedIds: string[]): Promise<Service[]> {
		const config = await combinedConfigFile.mutate((doc) => {
			const wsIndex = findWorkspaceIndex(doc, workspaceId);
			if (wsIndex === -1) return;
			const seq = doc.getIn(["workspaces", wsIndex, "services"], true);
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
		return flattenServices(config).filter(
			(service) => service.ws === workspaceId,
		);
	},
};
