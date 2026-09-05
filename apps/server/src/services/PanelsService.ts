import { v7 as uuidv7 } from "uuid";
import type { NewPanel, Panel, PanelsRepository } from "../db/PanelsRepository";
import { BadRequestError, NotFoundError } from "../errors";
import { notifyDataChanged } from "../events";
import type { HealthStatus } from "./HealthCheckService";

export interface PanelBody {
	title: string;
	url: string;
	hidden?: boolean;
	healthCheckUrl?: string | null;
	healthCheckIntervalMs?: number | null;
}

const toApiPanel = (
	{ position: _, ...panel }: Panel,
	health: HealthStatus,
) => ({
	...panel,
	health,
});

const UNKNOWN_HEALTH: HealthStatus = {
	status: "unknown",
	latencyMs: null,
	lastCheckedAt: null,
};

export class PanelsService {
	constructor(
		private readonly repo: PanelsRepository,
		private readonly getHealth: (id: string) => HealthStatus = () =>
			UNKNOWN_HEALTH,
	) {}

	async getAll() {
		const panels = await this.repo.findAll();
		return panels.map((panel) => toApiPanel(panel, this.getHealth(panel.id)));
	}

	async getById(id: string) {
		const panel = await this.repo.findById(id);
		if (!panel) throw new NotFoundError("Panel not found");
		return toApiPanel(panel, this.getHealth(id));
	}

	async create(data: PanelBody) {
		const newPanel: NewPanel = {
			id: uuidv7(),
			hidden: false,
			healthCheckUrl: null,
			healthCheckIntervalMs: null,
			...data,
		};
		const panel = await this.repo.create(newPanel);
		notifyDataChanged();
		return toApiPanel(panel, this.getHealth(panel.id));
	}

	async update(id: string, data: PanelBody) {
		await this.getById(id);
		const panel = await this.repo.update(id, data);
		notifyDataChanged();
		// biome-ignore lint/style/noNonNullAssertion: getById above already confirmed existence
		return toApiPanel(panel!, this.getHealth(id));
	}

	async delete(id: string) {
		await this.getById(id);
		const panel = await this.repo.delete(id);
		notifyDataChanged();
		// biome-ignore lint/style/noNonNullAssertion: getById above already confirmed existence
		return toApiPanel(panel!, this.getHealth(id));
	}

	async reorder(ids: string[]) {
		const current = await this.repo.findAll();
		const currentIds = new Set(current.map((panel) => panel.id));
		const sameSet =
			ids.length === currentIds.size && ids.every((id) => currentIds.has(id));
		if (!sameSet) {
			throw new BadRequestError(
				"ids must be exactly the set of existing panel ids",
			);
		}
		const panels = await this.repo.reorder(ids);
		notifyDataChanged();
		return panels.map((panel) => toApiPanel(panel, this.getHealth(panel.id)));
	}
}
