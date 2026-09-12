import { treaty } from "@elysia/eden";
import type { router } from "server/src/router";

// Same-origin in both dev and prod now: the embedded Caddy proxy fronts everything (in dev,
// splitting /api/* to Bun and the rest to Vite; see CaddyProxyService.ts), so the page's own
// origin is always the right place to send API calls — no more direct-to-Bun dev special case.
export const resolveServerUrl = () => window.location.origin;

export const createApi = () => treaty<typeof router>(resolveServerUrl());

type ApiClient = ReturnType<typeof createApi>;

export type ServiceData = NonNullable<
	Awaited<ReturnType<ApiClient["api"]["services"]["get"]>>["data"]
>[number];
export type ServiceBody = Parameters<ApiClient["api"]["services"]["post"]>[0];
export type HealthStatus = ServiceData["health"];

export type WorkspaceData = NonNullable<
	Awaited<ReturnType<ApiClient["api"]["workspaces"]["get"]>>["data"]
>[number];
export type WorkspaceBody = Parameters<
	ApiClient["api"]["workspaces"]["post"]
>[0];

export type ProbeResult = NonNullable<
	Awaited<ReturnType<ApiClient["api"]["services"]["probe"]["post"]>>["data"]
>;

export type ConfigData = NonNullable<
	Awaited<ReturnType<ApiClient["api"]["config"]["get"]>>["data"]
>;

export type RawFile = NonNullable<
	Awaited<ReturnType<ApiClient["api"]["services"]["raw"]["get"]>>["data"]
>;

export type SiteData = NonNullable<
	Awaited<ReturnType<ApiClient["api"]["sites"]["get"]>>["data"]
>[number];
