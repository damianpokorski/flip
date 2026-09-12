import { browser } from "$app/environment";
import { replaceState } from "$app/navigation";
import type { HealthStatus, ServiceData, WorkspaceData } from "./api";
import { createApi, resolveServerUrl } from "./api";

const HUD_GRID_COLUMNS = 8;
const HUD_GRID_MAX = 24;
const RECENTS_MAX = 4;
// If a started iframe never fires `onload` (unreachable/hanging service), treat its slot as
// free anyway after this long, so one bad service can't stall the whole background queue.
const FRAME_LOAD_SAFETY_TIMEOUT_MS = 15_000;

// Below this, the 46px spine + 184px sidebar stop being comfortably usable — phones (portrait
// and most landscape) fall under it, small laptop windows don't.
const MOBILE_BREAKPOINT_QUERY = "(max-width: 720px)";

class AppState {
  services = $state<ServiceData[]>([]);
  workspaces = $state<WorkspaceData[]>([]);
  activeWs = $state<string | null>(null);
  activeServiceId = $state<string | null>(null);
  sidebarCollapsed = $state(false);
  hudOpen = $state(false);
  query = $state("");
  cursor = $state(0);
  // Guarded by `browser` (not just deferred to onMount) since the static-adapter build's
  // fallback-page generation SSRs the root layout once, window-less — this must be correct
  // from the very first client render with no flash, not settle in after mount.
  isMobile = $state(browser && window.matchMedia(MOBILE_BREAKPOINT_QUERY).matches);
  // Session-only "last opened" — never persisted to YAML, same rationale as transient health
  // status: keeps the data files stable and doesn't need to survive a restart.
  recentServiceIds = $state<string[]>([]);
  // Env-derived facts about the embedded header-stripping proxy — immutable for the
  // process's lifetime, so a one-time fetch in refresh() is enough, no SSE update needed.
  proxyDomain = $state<string | null>(null);
  proxyPort = $state(8080);
  // Ids of services whose iframe has been assigned a real `src` — Frame.svelte reads this to
  // decide whether to render the live url or leave the iframe at its no-src default, which is
  // what makes lazy/staggered loading possible without ever unmounting an iframe.
  startedFrameIds = $state<Set<string>>(new Set());
  // From config.yaml — how many background (non-user-triggered) frame loads may be in
  // flight at once. Explicit user activation (openService/the initial active service) always
  // bypasses this cap; it only throttles automatic background preloading.
  maxParallelFrameLoads = $state(3);
  // Internal scheduler bookkeeping — not read from templates, so plain (non-reactive) fields.
  private loadingFrameIds = new Set<string>();
  private pendingFrameIds: string[] = [];
  private frameLoadTimers = new Map<string, ReturnType<typeof setTimeout>>();

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
    const sorted = [...this.visibleServices].sort((a, b) => a.name.localeCompare(b.name));
    const filtered = q
      ? sorted.filter(
          (service) =>
            service.name.toLowerCase().includes(q) || service.mark.toLowerCase().includes(q),
        )
      : sorted;
    return filtered.slice(0, HUD_GRID_MAX);
  }

  get hudTyping(): boolean {
    return this.query.length > 0;
  }

  // Most-recently-opened first, capped at RECENTS_MAX. Drops any id whose service was since
  // deleted rather than filtering at write time, so deletion doesn't need to reach in here.
  get recentServices(): ServiceData[] {
    const recents = this.recentServiceIds
      .map((id) => this.services.find((service) => service.id === id))
      .filter((service): service is ServiceData => service !== undefined);
    // Nothing explicitly opened yet this session (fresh load, or just landed in a workspace
    // via a chip/tab switch) — show whatever's actually on screen instead of an empty bar.
    // A computed fallback rather than seeding recentServiceIds itself, so it stays correct
    // no matter how activeServiceId ended up set, not just the initial refresh().
    if (recents.length === 0 && this.activeService) {
      return [this.activeService];
    }
    return recents;
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
      this.maxParallelFrameLoads = configRes.data.maxParallelFrameLoads;
    }

    if (!this.activeWs || !this.workspaces.some((workspace) => workspace.id === this.activeWs)) {
      this.activeWs = this.workspaces[0]?.id ?? null;
    }
    const inWs = this.servicesInActiveWorkspace;
    if (!this.activeServiceId || !inWs.some((service) => service.id === this.activeServiceId)) {
      this.activeServiceId = inWs[0]?.id ?? null;
    }

    // The visible frame always loads immediately, lazy or not — there's no placeholder state
    // for "the thing on screen hasn't started loading yet".
    if (this.activeServiceId) this.startFrame(this.activeServiceId);
    this.scheduleEagerFrames();
  }

  // Queues every eager (non-lazyLoad), embeddable, not-yet-started service for background
  // loading — called on every refresh() so services discovered via a later SSE update are
  // staggered in too, not just the initial batch. Already-started/queued ids are skipped, so
  // repeated calls never double-queue.
  private scheduleEagerFrames() {
    const activeWs = this.activeWs;
    // `services` arrives from the API already in `position` order (that field itself isn't
    // part of the wire shape) — a stable sort on workspace-affinity alone preserves that
    // relative order within each group, giving "active workspace first, by position" for free.
    const candidates = this.visibleServices
      .filter(
        (service) =>
          service.target === "frame" &&
          !service.lazyLoad &&
          !this.startedFrameIds.has(service.id) &&
          !this.pendingFrameIds.includes(service.id),
      )
      .sort((a, b) => (a.ws === activeWs ? 0 : 1) - (b.ws === activeWs ? 0 : 1));
    for (const service of candidates) this.enqueueFrame(service.id);
  }

  // Starts a frame immediately, bypassing the parallel-load cap — used for the visible
  // service and any explicit user activation (openService), where "wait behind the
  // background queue" would be a bad user experience.
  private startFrame(id: string) {
    if (this.startedFrameIds.has(id)) return;
    this.pendingFrameIds = this.pendingFrameIds.filter((pendingId) => pendingId !== id);
    this.startedFrameIds = new Set(this.startedFrameIds).add(id);
    this.loadingFrameIds.add(id);
    const timer = setTimeout(() => this.markFrameLoaded(id), FRAME_LOAD_SAFETY_TIMEOUT_MS);
    this.frameLoadTimers.set(id, timer);
  }

  // Starts a frame only if under the parallel-load cap, otherwise queues it — used for
  // automatic background preloading, never for a user-triggered open.
  private enqueueFrame(id: string) {
    if (this.startedFrameIds.has(id) || this.pendingFrameIds.includes(id)) return;
    if (this.loadingFrameIds.size < this.maxParallelFrameLoads) {
      this.startFrame(id);
    } else {
      this.pendingFrameIds.push(id);
    }
  }

  // Bound to the iframe's `onload` in Frame.svelte, and also fired by the safety timeout if
  // `onload` never comes — either way, frees a slot for the next queued background load.
  markFrameLoaded(id: string) {
    if (!this.loadingFrameIds.delete(id)) return;
    const timer = this.frameLoadTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.frameLoadTimers.delete(id);
    }
    const next = this.pendingFrameIds.shift();
    if (next) this.startFrame(next);
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
    this.cursor = Math.min(Math.max(this.cursor + delta, 0), Math.max(this.hudTiles.length - 1, 0));
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
    // Re-picking a service that's already in recents must not reorder the bar — only a
    // genuinely new pick moves to the front, so tapping back and forth between two open
    // services doesn't make their tiles keep swapping places.
    if (!this.recentServiceIds.includes(id)) {
      // Nothing's been explicitly recorded yet (cold load, or just landed in a workspace) —
      // recentServices was showing the current active service as a stand-in. Picking
      // something else must not make that stand-in vanish; carry it over as the next entry
      // instead of outright replacing it.
      const outgoing =
        this.recentServiceIds.length === 0 && this.activeServiceId && this.activeServiceId !== id
          ? [this.activeServiceId]
          : [];
      this.recentServiceIds = [id, ...outgoing, ...this.recentServiceIds].slice(0, RECENTS_MAX);
    }
    if (service.target === "external") {
      window.open(service.url, "_blank", "noopener,noreferrer");
    } else {
      // Explicit user intent always jumps the background queue — whether this service is
      // lazyLoad (never auto-started) or just hasn't reached the front of the stagger yet.
      this.startFrame(id);
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
export { HUD_GRID_COLUMNS, MOBILE_BREAKPOINT_QUERY };
