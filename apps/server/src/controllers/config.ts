import { Elysia, t } from "elysia";
import { ConfigRepository } from "../db/ConfigRepository";
import { ConfigService } from "../services/ConfigService";

const ConfigModel = t.Object({
	healthCheckIntervalMs: t.Number(),
	healthCheckTimeoutMs: t.Number(),
});

const service = new ConfigService(new ConfigRepository());

export const configController = new Elysia({ prefix: "/config" })
	.model({ Config: ConfigModel })
	.get("/", () => service.get(), {
		response: "Config",
		detail: { summary: "Get app configuration", tags: ["config"] },
	})
	.put("/", ({ body }) => service.update(body), {
		body: "Config",
		response: "Config",
		detail: { summary: "Update app configuration", tags: ["config"] },
	});
