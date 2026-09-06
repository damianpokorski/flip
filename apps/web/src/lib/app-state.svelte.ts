import { replaceState } from "$app/navigation";
import type { HealthStatus, ServiceData, WorkspaceData } from "./api";
import { createApi, resolveServerUrl } from "./api";

const HUD_GRID_COLUMNS = 8;
const HUD_GRID_MAX = 24;

class AppState {
	services = $state<ServiceData[]>([]);
	workspaces = $state<WorkspaceData[]>([]);
	activeWs = $state<string | null>(null);
	activeServiceId = $state<string | null>(null);
	sidebarCollapsed = $state(false);
	hudOpen = $state(false);
	query = $state("");
	cursor = $state(0);
	// Env-derived facts about the embedded header-stripping proxy — immutable for the
	// process's lifetime, so a one-time fetch in refresh() is enough, no SSE update needed.
	proxyDomain = $state<string | null>(null);
	proxyPort = $state(8080);

	private eventSource: EventSource | undefined;

	get visibleServices(): ServiceData[] {
		return this.services.filter((service) => !service.hidden);
	}

	get servicesInActiveWorkspace(): ServiceData[] {
		const ws = this.activeWs;
		if (!ws) return [];
		return this.visibleServices.filter((service) => service.ws === ws);
	}

	get activeService(): ServiceData | undefined {
		return this.services.find((service) => service.id === this.activeServiceId);
	}

	// Every service, alphabetical, across all workspaces — the HUD isn't workspace-scoped,
	// filtered by name or mark once a query is typed.
	get hudTiles(): ServiceData[] {
		const q = this.query.trim().toLowerCase();
		const sorted = [...this.visibleServices].sort((a, b) =>
			a.name.localeCompare(b.name),
		);
		const filtered = q
			? sorted.filter(
					(service) =>
						service.name.toLowerCase().includes(q) ||
						service.mark.toLowerCase().includes(q),
				)
			: sorted;
		return filtered.slice(0, HUD_GRID_MAX);
	}

	get hudTyping(): boolean {
		return this.query.length > 0;
	}

	async refresh() {
		const api = createApi();
		const [servicesRes, workspacesRes, configRes] = await Promise.all([
			api.api.services.get(),
			api.api.workspaces.get(),
			api.api.config.get(),
		]);
		if (servicesRes.error) {
			console.error("Failed to load services", servicesRes.error);
		} else {
			this.services = servicesRes.data;
		}
		if (workspacesRes.error) {
			console.error("Failed to load workspaces", workspacesRes.error);
		} else {
			this.workspaces = workspacesRes.data;
		}
		if (configRes.error) {
			console.error("Failed to load config", configRes.error);
		} else {
			this.proxyDomain = configRes.data.proxyDomain;
			this.proxyPort = configRes.data.proxyPort;
		}

		if (
			!this.activeWs ||
			!this.workspaces.some((workspace) => workspace.id === this.activeWs)
		) {
			this.activeWs = this.workspaces[0]?.id ?? null;
		}
		const inWs = this.servicesInActiveWorkspace;
		if (
			!this.activeServiceId ||
			!inWs.some((service) => service.id === this.activeServiceId)
		) {
			this.activeServiceId = inWs[0]?.id ?? null;
		}
	}

	applyHealthPatch(patch: Record<string, HealthStatus>) {
		this.services = this.services.map((service) =>
			patch[service.id] ? { ...service, health: patch[service.id] } : service,
		);
	}

	connectSse() {
		if (this.eventSource) return;
		const source = new EventSource(`${resolveServerUrl()}/api/events`);
		source.addEventListener("change", () => {
			this.refresh();
		});
		source.addEventListener("health", (event) => {
			try {
				this.applyHealthPatch(JSON.parse((event as MessageEvent).data));
			} catch (err) {
				console.error("Failed to parse health event", err);
			}
		});
		this.eventSource = source;
	}

	openHud() {
		this.hudOpen = true;
		this.query = "";
		this.cursor = 0;
	}

	closeHud() {
		this.hudOpen = false;
	}

	setQuery(query: string) {
		this.query = query;
		this.cursor = 0;
	}

	setActiveWorkspace(id: string) {
		this.activeWs = id;
		this.sidebarCollapsed = false;
		const inWs = this.servicesInActiveWorkspace;
		if (!inWs.some((service) => service.id === this.activeServiceId)) {
			this.activeServiceId = inWs[0]?.id ?? this.activeServiceId;
		}
	}

	moveCursor(delta: number) {
		this.cursor = Math.min(
			Math.max(this.cursor + delta, 0),
			Math.max(this.hudTiles.length - 1, 0),
		);
	}

	pickCursor() {
		const target = this.hudTiles[this.cursor];
		if (target) this.openService(target.id);
		else this.closeHud();
	}

	// The single place a service gets "opened" from anywhere in the UI (Sidebar, HUD).
	// `target: "external"` services never occupy the Frame — they open in a new tab and
	// leave whatever was active untouched, so there's no placeholder state to manage.
	openService(id: string) {
		const service = this.services.find((s) => s.id === id);
		if (!service) return;
		if (service.target === "external") {
			window.open(service.url, "_blank", "noopener,noreferrer");
		} else {
			this.activeServiceId = id;
			this.sidebarCollapsed = true;
			const url = new URL(window.location.href);
			url.searchParams.set("service", service.name);
			replaceState(url, {});
		}
		this.closeHud();
	}
}

export const appState = new AppState();
export { HUD_GRID_COLUMNS };
