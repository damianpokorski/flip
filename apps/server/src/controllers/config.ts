import { Elysia, t } from "elysia";
import { ConfigRepository } from "../db/ConfigRepository";
import { ConfigService } from "../services/ConfigService";

// Written as an explicit literal tuple (not THEMES.map(...)) so TypeScript infers a proper
// tuple of distinct TLiteral schemas — mapping over the const array collapses to a generic
// TLiteral<Theme>[] and TypeBox can't derive the union type from that. Keep in sync with
// packages/store/src/schemas/config.ts's THEMES.
const ThemeModel = t.Union([
	t.Literal("catppuccin-mocha"),
	t.Literal("rose-pine"),
	t.Literal("rose-pine-dawn"),
	t.Literal("tokyo-night"),
	t.Literal("tokyo-night-light"),
	t.Literal("kanagawa"),
	t.Literal("kanagawa-lotus"),
	t.Literal("nord"),
	t.Literal("dracula"),
]);

const ConfigModel = t.Object({
	healthCheckTimeoutMs: t.Number(),
	maxParallelFrameLoads: t.Number(),
	proxyDomain: t.Nullable(t.String()),
	proxyPort: t.Number(),
	uiScale: t.Number(),
	theme: ThemeModel,
});

const RawFileModel = t.Object({
	content: t.String(),
	updatedAt: t.String(),
});

const service = new ConfigService(new ConfigRepository());

export const configController = new Elysia({ prefix: "/config" })
	.model({ Config: ConfigModel, RawFile: RawFileModel })
	.get("/", () => service.get(), {
		response: "Config",
		detail: { summary: "Get app configuration", tags: ["config"] },
	})
	.patch("/", ({ body }) => service.update(body), {
		body: t.Object({ theme: ThemeModel }),
		response: "Config",
		detail: { summary: "Update app configuration", tags: ["config"] },
	})
	.get("/raw", () => service.readRaw(), {
		response: "RawFile",
		detail: { summary: "Get config.yaml's live file text", tags: ["config"] },
	});
