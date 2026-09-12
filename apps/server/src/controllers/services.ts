import { Elysia, t } from "elysia";
import { ServicesRepository } from "../db/ServicesRepository";
import { WorkspacesRepository } from "../db/WorkspacesRepository";
import { errorPlugin } from "../errors";
import { CaddyProxyService } from "../services/CaddyProxyService";
import { HealthCheckService } from "../services/HealthCheckService";
import { ProbeService } from "../services/ProbeService";
import { ServicesService } from "../services/ServicesService";

const HealthModel = t.Object({
  ms: t.Nullable(t.Number()),
  lastCheckedAt: t.Nullable(t.String()),
  bucket: t.Union([t.Literal("fast"), t.Literal("ok"), t.Literal("slow"), t.Literal("down")]),
});

// Written as an explicit literal tuple (not TILE_HUES.map(...)) so TypeScript infers a
// proper tuple of distinct TLiteral schemas — mapping over the const array collapses to a
// generic TLiteral<TileHue>[] and TypeBox can't derive the union type from that.
const TileHueModel = t.Union([
  t.Literal("sapphire"),
  t.Literal("blue"),
  t.Literal("mauve"),
  t.Literal("green"),
  t.Literal("yellow"),
  t.Literal("peach"),
  t.Literal("pink"),
  t.Literal("teal"),
  t.Literal("sky"),
  t.Literal("lavender"),
  t.Literal("flamingo"),
  t.Literal("rosewater"),
]);

const ServiceSourceModel = t.Union([t.Literal("external"), t.Literal("local")]);

const ServiceBodyModel = t.Object({
  name: t.String(),
  mark: t.String(),
  hue: TileHueModel,
  host: t.String(),
  url: t.String(),
  healthCheckUrl: t.Optional(t.Nullable(t.String())),
  source: t.Optional(ServiceSourceModel),
  localSlug: t.Optional(t.Nullable(t.String())),
  ws: t.String(),
  pin: t.Optional(t.Nullable(t.String())),
  codes: t.Optional(t.String()),
  every: t.Optional(t.String()),
  target: t.Optional(t.Union([t.Literal("frame"), t.Literal("external")])),
  proxyHeaders: t.Optional(t.Boolean()),
  hidden: t.Optional(t.Boolean()),
});

const ServiceModel = t.Object({
  id: t.String(),
  name: t.String(),
  mark: t.String(),
  hue: TileHueModel,
  host: t.String(),
  url: t.String(),
  healthCheckUrl: t.Nullable(t.String()),
  source: ServiceSourceModel,
  localSlug: t.Nullable(t.String()),
  ws: t.String(),
  pin: t.Nullable(t.String()),
  codes: t.String(),
  every: t.String(),
  target: t.Union([t.Literal("frame"), t.Literal("external")]),
  proxyHeaders: t.Boolean(),
  hidden: t.Boolean(),
  health: HealthModel,
});

const ProbeResultModel = t.Object({
  ms: t.Nullable(t.Number()),
  statusCode: t.Nullable(t.Number()),
  title: t.Nullable(t.String()),
  embeddable: t.Boolean(),
  suggestedTarget: t.Union([t.Literal("frame"), t.Literal("external")]),
});

const RawFileModel = t.Object({
  content: t.String(),
  updatedAt: t.String(),
});

const models = {
  Service: ServiceModel,
  ServiceBody: ServiceBodyModel,
  ServiceList: t.Array(ServiceModel),
  ProbeResult: ProbeResultModel,
  RawFile: RawFileModel,
};

const repository = new ServicesRepository();
const workspacesRepository = new WorkspacesRepository();
// Exported so apps/server/src/index.ts can start the background scheduler once at boot —
// service/repository/health-checker are all manually instantiated module-scope singletons,
// no DI container, matching the rest of the codebase's layering.
export const healthCheckService = new HealthCheckService(repository);
// Exported for the same reason as healthCheckService — apps/server/src/index.ts starts it
// once at boot and hooks the services-file watcher to call reload() on every change.
export const caddyProxyService = new CaddyProxyService(repository);
const service = new ServicesService(repository, workspacesRepository, (id) =>
  healthCheckService.getStatus(id),
);
const probeService = new ProbeService();

export const servicesController = new Elysia({ prefix: "/services" })
  .use(errorPlugin)
  .model(models)
  .get("/", () => service.getAll(), {
    response: "ServiceList",
    detail: { summary: "List all services", tags: ["services"] },
  })
  .get("/raw", () => service.readRaw(), {
    response: "RawFile",
    detail: {
      summary: "Get services.yaml's live file text",
      tags: ["services"],
    },
  })
  .post("/probe", ({ body }) => probeService.probe(body.url), {
    body: t.Object({ url: t.String() }),
    response: "ProbeResult",
    detail: { summary: "Probe a candidate service URL", tags: ["services"] },
  })
  .patch("/reorder", ({ body }) => service.reorder(body.ids), {
    body: t.Object({ ids: t.Array(t.String()) }),
    response: { 200: "ServiceList", 400: "BadRequestError" },
    detail: { summary: "Reorder services", tags: ["services"] },
  })
  .get("/:id", ({ params: { id } }) => service.getById(id), {
    params: t.Object({ id: t.String() }),
    response: { 200: "Service", 404: "NotFoundError" },
    detail: { summary: "Get a service by id", tags: ["services"] },
  })
  .post("/", ({ body }) => service.create(body), {
    body: "ServiceBody",
    response: { 200: "Service", 400: "BadRequestError" },
    detail: { summary: "Create a new service", tags: ["services"] },
  })
  .put("/:id", ({ params: { id }, body }) => service.update(id, body), {
    params: t.Object({ id: t.String() }),
    body: "ServiceBody",
    response: { 200: "Service", 400: "BadRequestError", 404: "NotFoundError" },
    detail: { summary: "Update a service", tags: ["services"] },
  })
  .delete("/:id", ({ params: { id } }) => service.delete(id), {
    params: t.Object({ id: t.String() }),
    response: { 200: "Service", 404: "NotFoundError" },
    detail: { summary: "Delete a service", tags: ["services"] },
  });
