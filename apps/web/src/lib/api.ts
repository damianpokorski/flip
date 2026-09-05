import { treaty } from "@elysia/eden";
import type { router } from "server/src/router";

export const resolveServerUrl = () =>
	import.meta.env.DEV ? "http://localhost:3000" : window.location.origin;

export const createApi = () => treaty<typeof router>(resolveServerUrl());

type ApiClient = ReturnType<typeof createApi>;

export type PanelData = NonNullable<
	Awaited<ReturnType<ApiClient["api"]["panels"]["get"]>>["data"]
>[number];
export type PanelBody = Parameters<ApiClient["api"]["panels"]["post"]>[0];
export type HealthStatus = PanelData["health"];
export type ConfigData = NonNullable<
	Awaited<ReturnType<ApiClient["api"]["config"]["get"]>>["data"]
>;
export type ConfigBody = Parameters<ApiClient["api"]["config"]["put"]>[0];
