import { v7 as uuidv7 } from "uuid";
import type {
	NewService,
	Service,
	ServicesRepository,
} from "../db/ServicesRepository";
import type { WorkspacesRepository } from "../db/WorkspacesRepository";
import { BadRequestError, NotFoundError } from "../errors";
import { notifyDataChanged } from "../events";
import type { HealthStatus } from "./HealthCheckService";

export interface ServiceBody {
	name: string;
	mark: string;
	hue: Service["hue"];
	host: string;
	url: string;
	healthCheckUrl?: string | null;
	ws: string;
	pin?: string | null;
	codes?: string;
	every?: string;
	target?: Service["target"];
	proxyHeaders?: boolean;
	hidden?: boolean;
}

const toApiService = (
	{ position: _, ...service }: Service,
	health: HealthStatus,
) => ({
	...service,
	health,
});

const UNKNOWN_HEALTH: HealthStatus = {
	ms: null,
	lastCheckedAt: null,
	bucket: "down",
};

export class ServicesService {
	constructor(
		private readonly repo: ServicesRepository,
		private readonly workspaces: WorkspacesRepository,
		private readonly getHealth: (id: string) => HealthStatus = () =>
			UNKNOWN_HEALTH,
	) {}

	async getAll() {
		const services = await this.repo.findAll();
		return services.map((service) =>
			toApiService(service, this.getHealth(service.id)),
		);
	}

	async getById(id: string) {
		const service = await this.repo.findById(id);
		if (!service) throw new NotFoundError("Service not found");
		return toApiService(service, this.getHealth(id));
	}

	async create(data: ServiceBody) {
		await this.assertValidWorkspaceId(data.ws);
		await this.assertPinAvailable(data.pin, null);
		const newService: NewService = {
			id: uuidv7(),
			healthCheckUrl: null,
			pin: null,
			codes: "200",
			every: "30s",
			target: "frame",
			proxyHeaders: false,
			hidden: false,
			...data,
		};
		const service = await this.repo.create(newService);
		notifyDataChanged();
		return toApiService(service, this.getHealth(service.id));
	}

	async update(id: string, data: ServiceBody) {
		await this.getById(id);
		await this.assertValidWorkspaceId(data.ws);
		await this.assertPinAvailable(data.pin, id);
		const service = await this.repo.update(id, data);
		notifyDataChanged();
		// biome-ignore lint/style/noNonNullAssertion: getById above already confirmed existence
		return toApiService(service!, this.getHealth(id));
	}

	async delete(id: string) {
		await this.getById(id);
		const service = await this.repo.delete(id);
		notifyDataChanged();
		// biome-ignore lint/style/noNonNullAssertion: getById above already confirmed existence
		return toApiService(service!, this.getHealth(id));
	}

	async reorder(ids: string[]) {
		const current = await this.repo.findAll();
		const currentIds = new Set(current.map((service) => service.id));
		const sameSet =
			ids.length === currentIds.size && ids.every((id) => currentIds.has(id));
		if (!sameSet) {
			throw new BadRequestError(
				"ids must be exactly the set of existing service ids",
			);
		}
		const services = await this.repo.reorder(ids);
		notifyDataChanged();
		return services.map((service) =>
			toApiService(service, this.getHealth(service.id)),
		);
	}

	readRaw() {
		return this.repo.readRaw();
	}

	private async assertValidWorkspaceId(ws: string) {
		const workspace = await this.workspaces.findById(ws);
		if (!workspace) throw new BadRequestError(`Unknown workspace id: ${ws}`);
	}

	private async assertPinAvailable(
		pin: string | null | undefined,
		excludeId: string | null,
	) {
		if (!pin) return;
		const services = await this.repo.findAll();
		const conflict = services.find(
			(service) => service.pin === pin && service.id !== excludeId,
		);
		if (conflict) {
			throw new BadRequestError(
				`Pin \`${pin} is already used by "${conflict.name}"`,
			);
		}
	}
}
