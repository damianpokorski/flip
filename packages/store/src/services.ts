import { DEFAULT_SERVICES_YAML } from "./defaults";
import { YamlFile } from "./fs-yaml";
import { type Service, ServicesFileSchema } from "./schemas/service";

const servicesFile = new YamlFile(
	"services.yaml",
	ServicesFileSchema,
	DEFAULT_SERVICES_YAML,
);

export type NewService = Omit<Service, "position">;
export type ServicePatch = Partial<Omit<Service, "id" | "position">>;

export const servicesStore = {
	ensureExists: () => servicesFile.ensureExists(),
	onChange: (listener: (services: Service[]) => void) =>
		servicesFile.onChange(listener),
	watch: () => servicesFile.watch(),
	readRaw: () => servicesFile.readRaw(),

	async findAll(): Promise<Service[]> {
		const services = await servicesFile.read();
		return [...services].sort((a, b) => a.position - b.position);
	},

	async findById(id: string): Promise<Service | undefined> {
		const services = await servicesFile.read();
		return services.find((service) => service.id === id);
	},

	async create(input: NewService): Promise<Service> {
		const services = await servicesFile.mutate((doc) => {
			const current = (doc.toJS() ?? []) as Service[];
			const position =
				current.length === 0
					? 0
					: Math.max(...current.map((service) => service.position)) + 1;
			doc.add({ ...input, position });
		});
		// biome-ignore lint/style/noNonNullAssertion: we just inserted this id above
		return services.find((service) => service.id === input.id)!;
	},

	async update(id: string, patch: ServicePatch): Promise<Service | undefined> {
		const services = await servicesFile.mutate((doc) => {
			const current = (doc.toJS() ?? []) as Service[];
			const index = current.findIndex((service) => service.id === id);
			if (index === -1) return;
			for (const [key, value] of Object.entries(patch)) {
				doc.setIn([index, key], value);
			}
		});
		return services.find((service) => service.id === id);
	},

	async delete(id: string): Promise<Service | undefined> {
		let deleted: Service | undefined;
		await servicesFile.mutate((doc) => {
			const current = (doc.toJS() ?? []) as Service[];
			const index = current.findIndex((service) => service.id === id);
			if (index === -1) return;
			deleted = current[index];
			doc.deleteIn([index]);
		});
		return deleted;
	},

	async reorder(orderedIds: string[]): Promise<Service[]> {
		const services = await servicesFile.mutate((doc) => {
			const current = (doc.toJS() ?? []) as Service[];
			const indexById = new Map(
				current.map((service, index) => [service.id, index]),
			);
			orderedIds.forEach((id, position) => {
				const index = indexById.get(id);
				if (index !== undefined) doc.setIn([index, "position"], position);
			});
		});
		return [...services].sort((a, b) => a.position - b.position);
	},

	// Reassigns every service pointing at `fromWorkspaceId` to `toWorkspaceId` — used when a
	// workspace is deleted, so member services survive with a valid `ws` rather than the
	// deletion being refused (refusal only happens when there's no other workspace left).
	async reassignWorkspace(
		fromWorkspaceId: string,
		toWorkspaceId: string,
	): Promise<void> {
		await servicesFile.mutate((doc) => {
			const current = (doc.toJS() ?? []) as Service[];
			current.forEach((service, index) => {
				if (service.ws !== fromWorkspaceId) return;
				doc.setIn([index, "ws"], toWorkspaceId);
			});
		});
	},
};
