import { Elysia, t } from "elysia";
import { PanelsRepository } from "../db/PanelsRepository";
import { errorPlugin } from "../errors";
import { HealthCheckService } from "../services/HealthCheckService";
import { PanelsService } from "../services/PanelsService";

const HealthModel = t.Object({
	status: t.Union([t.Literal("up"), t.Literal("down"), t.Literal("unknown")]),
	latencyMs: t.Nullable(t.Number()),
	lastCheckedAt: t.Nullable(t.String()),
});

const PanelBodyModel = t.Object({
	title: t.String(),
	url: t.String(),
	hidden: t.Optional(t.Boolean()),
	healthCheckUrl: t.Optional(t.Nullable(t.String())),
	healthCheckIntervalMs: t.Optional(t.Nullable(t.Number())),
});

const PanelModel = t.Object({
	id: t.String(),
	title: t.String(),
	url: t.String(),
	hidden: t.Boolean(),
	healthCheckUrl: t.Nullable(t.String()),
	healthCheckIntervalMs: t.Nullable(t.Number()),
	health: HealthModel,
});

const models = {
	Panel: PanelModel,
	PanelBody: PanelBodyModel,
	PanelList: t.Array(PanelModel),
};

const repository = new PanelsRepository();
// Exported so apps/server/src/index.ts can start the background scheduler once at boot —
// service/repository/health-checker are all manually instantiated module-scope singletons,
// no DI container, matching the rest of the codebase's layering.
export const healthCheckService = new HealthCheckService(repository);
const service = new PanelsService(repository, (id) =>
	healthCheckService.getStatus(id),
);

export const panelsController = new Elysia({ prefix: "/panels" })
	.use(errorPlugin)
	.model(models)
	.get("/", () => service.getAll(), {
		response: "PanelList",
		detail: { summary: "List all panels", tags: ["panels"] },
	})
	.patch("/reorder", ({ body }) => service.reorder(body.ids), {
		body: t.Object({ ids: t.Array(t.String()) }),
		response: { 200: "PanelList", 400: "BadRequestError" },
		detail: { summary: "Reorder panels", tags: ["panels"] },
	})
	.get("/:id", ({ params: { id } }) => service.getById(id), {
		params: t.Object({ id: t.String() }),
		response: { 200: "Panel", 404: "NotFoundError" },
		detail: { summary: "Get a panel by id", tags: ["panels"] },
	})
	.post("/", ({ body }) => service.create(body), {
		body: "PanelBody",
		response: "Panel",
		detail: { summary: "Create a new panel", tags: ["panels"] },
	})
	.put("/:id", ({ params: { id }, body }) => service.update(id, body), {
		params: t.Object({ id: t.String() }),
		body: "PanelBody",
		response: { 200: "Panel", 404: "NotFoundError" },
		detail: { summary: "Update a panel", tags: ["panels"] },
	})
	.delete("/:id", ({ params: { id } }) => service.delete(id), {
		params: t.Object({ id: t.String() }),
		response: { 200: "Panel", 404: "NotFoundError" },
		detail: { summary: "Delete a panel", tags: ["panels"] },
	});
