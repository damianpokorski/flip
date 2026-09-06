import { Elysia, t } from "elysia";
import { ServicesRepository } from "../db/ServicesRepository";
import { WorkspacesRepository } from "../db/WorkspacesRepository";
import { errorPlugin } from "../errors";
import { WorkspacesService } from "../services/WorkspacesService";

const WorkspaceBodyModel = t.Object({
	name: t.String(),
	label: t.String(),
});

const WorkspaceModel = t.Object({
	id: t.String(),
	name: t.String(),
	label: t.String(),
});

const RawFileModel = t.Object({
	content: t.String(),
	updatedAt: t.String(),
});

const models = {
	Workspace: WorkspaceModel,
	WorkspaceBody: WorkspaceBodyModel,
	WorkspaceList: t.Array(WorkspaceModel),
	RawFile: RawFileModel,
};

const repository = new WorkspacesRepository();
const servicesRepository = new ServicesRepository();
const service = new WorkspacesService(repository, servicesRepository);

export const workspacesController = new Elysia({ prefix: "/workspaces" })
	.use(errorPlugin)
	.model(models)
	.get("/", () => service.getAll(), {
		response: "WorkspaceList",
		detail: { summary: "List all workspaces", tags: ["workspaces"] },
	})
	.get("/raw", () => service.readRaw(), {
		response: "RawFile",
		detail: {
			summary: "Get workspaces.yaml's live file text",
			tags: ["workspaces"],
		},
	})
	.patch("/reorder", ({ body }) => service.reorder(body.ids), {
		body: t.Object({ ids: t.Array(t.String()) }),
		response: { 200: "WorkspaceList", 400: "BadRequestError" },
		detail: { summary: "Reorder workspaces", tags: ["workspaces"] },
	})
	.get("/:id", ({ params: { id } }) => service.getById(id), {
		params: t.Object({ id: t.String() }),
		response: { 200: "Workspace", 404: "NotFoundError" },
		detail: { summary: "Get a workspace by id", tags: ["workspaces"] },
	})
	.post("/", ({ body }) => service.create(body), {
		body: "WorkspaceBody",
		response: "Workspace",
		detail: { summary: "Create a new workspace", tags: ["workspaces"] },
	})
	.put("/:id", ({ params: { id }, body }) => service.update(id, body), {
		params: t.Object({ id: t.String() }),
		body: "WorkspaceBody",
		response: { 200: "Workspace", 404: "NotFoundError" },
		detail: { summary: "Update a workspace", tags: ["workspaces"] },
	})
	.delete("/:id", ({ params: { id } }) => service.delete(id), {
		params: t.Object({ id: t.String() }),
		response: {
			200: "Workspace",
			400: "BadRequestError",
			404: "NotFoundError",
		},
		detail: { summary: "Delete a workspace", tags: ["workspaces"] },
	});
