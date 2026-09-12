import { Elysia, t } from "elysia";
import { ConfigRepository } from "../db/ConfigRepository";
import { ConfigService } from "../services/ConfigService";

const ConfigModel = t.Object({
	healthCheckTimeoutMs: t.Number(),
	maxParallelFrameLoads: t.Number(),
	proxyDomain: t.Nullable(t.String()),
	proxyPort: t.Number(),
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
	.get("/raw", () => service.readRaw(), {
		response: "RawFile",
		detail: { summary: "Get config.yaml's live file text", tags: ["config"] },
	});
