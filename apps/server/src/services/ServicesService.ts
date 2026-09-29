import { hueFor } from "@flip/store/hue";
import { InjectionSchema } from "@flip/store/schemas/service";
import { v7 as uuidv7 } from "uuid";
import type {
	NewService,
	Service,
	ServicesRepository,
} from "../db/ServicesRepository";
import type { WorkspacesRepository } from "../db/WorkspacesRepository";
import {
	BadRequestError,
	NotFoundError,
	UnprocessableEntityError,
} from "../errors";
import { notifyDataChanged } from "../events";
import type { HealthStatus } from "./HealthCheckService";
import { renderSeedPage } from "./seed-page";

export interface ServiceBody {
	name: string;
	mark: string;
	hue: Service["hue"];
	host: string;
	url: string;
	healthCheckUrl?: string | null;
	source?: Service["source"];
	localSlug?: string | null;
	ws: string;
	pin?: string | null;
	codes?: string;
	every?: string;
	target?: Service["target"];
	proxyHeaders?: boolean;
	inject?: Service["inject"];
	hidden?: boolean;
	lazyLoad?: boolean;
}

const toApiService = (
	service: Service,
	health: HealthStatus,
	proxyHost: string | null,
) => ({
	...service,
	// Unguessable, stable-across-restarts subdomain label for the header-stripping proxy — null
	// when the service isn't proxied. The web app composes `<proxyHost>.<proxyDomain>:<proxyPort>`
	// from it.
	proxyHost,
	// `service.hue` is only ever unset (null/undefined) on disk — every consumer of the API
	// response gets an always-concrete colour, resolved here rather than at every render site.
	// `hueAuto` is what tells the settings form the colour was derived rather than picked.
	hue: service.hue ?? hueFor(service.name),
	hueAuto: service.hue == null,
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
		private readonly getProxyLabel: (id: string) => Promise<string> = (id) =>
			Promise.resolve(id),
	) {}

	private async toApi(service: Service) {
		return toApiService(
			service,
			this.getHealth(service.id),
			service.proxyHeaders ? await this.getProxyLabel(service.id) : null,
		);
	}

	async getAll() {
		const services = await this.repo.findAll();
		return Promise.all(services.map((service) => this.toApi(service)));
	}

	async getById(id: string) {
		const service = await this.repo.findById(id);
		if (!service) throw new NotFoundError("Service not found");
		return this.toApi(service);
	}

	async create(data: ServiceBody) {
		const normalized = this.normalizeSource(data);
		this.assertValidProxyUrl(normalized);
		this.assertValidInjections(normalized);
		await this.assertValidWorkspaceId(normalized.ws);
		await this.assertPinAvailable(normalized.pin, null);
		const newService: NewService = {
			id: uuidv7(),
			healthCheckUrl: null,
			source: "external",
			pin: null,
			codes: "200",
			every: "30s",
			target: "frame",
			proxyHeaders: false,
			inject: [],
			hidden: false,
			lazyLoad: false,
			...normalized,
		};
		const service = await this.repo.create(newService);
		notifyDataChanged();
		return this.toApi(service);
	}

	async update(id: string, data: ServiceBody) {
		await this.getById(id);
		const normalized = this.normalizeSource(data);
		this.assertValidProxyUrl(normalized);
		this.assertValidInjections(normalized);
		await this.assertValidWorkspaceId(normalized.ws);
		await this.assertPinAvailable(normalized.pin, id);
		const service = await this.repo.update(id, normalized);
		notifyDataChanged();
		// biome-ignore lint/style/noNonNullAssertion: getById above already confirmed existence
		return this.toApi(service!);
	}

	async delete(id: string) {
		await this.getById(id);
		const service = await this.repo.delete(id);
		notifyDataChanged();
		// biome-ignore lint/style/noNonNullAssertion: getById above already confirmed existence
		return this.toApi(service!);
	}

	// Served on the proxied origin via Caddy's /__flip/seed rewrite — see renderSeedPage. Reads
	// the service fresh on every frame load, so an edited injection applies on the next load
	// without waiting on a Caddy reload.
	async seedPage(id: string, next: string | undefined) {
		const service = await this.repo.findById(id);
		if (!service) throw new NotFoundError("Service not found");
		return renderSeedPage(service.inject, next);
	}

	async reorder(workspaceId: string, ids: string[]) {
		await this.assertValidWorkspaceId(workspaceId);
		const current = await this.repo.findAll();
		const currentIds = new Set(
			current
				.filter((service) => service.ws === workspaceId)
				.map((service) => service.id),
		);
		const sameSet =
			ids.length === currentIds.size && ids.every((id) => currentIds.has(id));
		if (!sameSet) {
			throw new BadRequestError(
				"ids must be exactly this workspace's existing service ids",
			);
		}
		const services = await this.repo.reorder(workspaceId, ids);
		notifyDataChanged();
		return Promise.all(services.map((service) => this.toApi(service)));
	}

	// source: "local" services don't take a user-typed url — it's derived from localSlug so
	// the iframe always points at this server's own /api/sites/<slug>/ route, and proxying
	// through Caddy (meant for embedding remote origins) never applies to them.
	private normalizeSource(
		data: ServiceBody,
	): ServiceBody & { localSlug: string | null } {
		if (data.source !== "local") return { ...data, localSlug: null };
		const { localSlug } = data;
		if (!localSlug) {
			throw new BadRequestError('localSlug is required when source is "local"');
		}
		return {
			...data,
			localSlug,
			url: `/api/sites/${localSlug}/`,
			proxyHeaders: false,
			inject: [],
		};
	}

	// Scheme and format only — a homelab dashboard legitimately targets private LAN hosts, so no
	// host filtering. Only proxied services matter: their url becomes a Caddy upstream.
	private assertValidProxyUrl(data: ServiceBody) {
		if (!data.proxyHeaders) return;
		let protocol: string;
		try {
			protocol = new URL(data.url).protocol;
		} catch {
			throw new UnprocessableEntityError(
				"url must be a valid absolute URL when proxyHeaders is enabled",
			);
		}
		if (protocol !== "http:" && protocol !== "https:") {
			throw new UnprocessableEntityError(
				"url must use http or https when proxyHeaders is enabled",
			);
		}
	}

	// Same rules the on-disk schema enforces (header/cookie name tokens, no line breaks, no Host
	// override) — checked up front so a bad row is a 422 with a readable message instead of the
	// store's write-time parse failing. These values end up inside the Caddyfile.
	private assertValidInjections(data: ServiceBody) {
		for (const [index, injection] of (data.inject ?? []).entries()) {
			const result = InjectionSchema.safeParse(injection);
			if (!result.success) {
				const issue = result.error.issues[0];
				throw new UnprocessableEntityError(
					`inject[${index}].${issue?.path.join(".") ?? ""} ${issue?.message ?? "is invalid"}`,
				);
			}
		}
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
