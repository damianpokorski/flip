import { openapi } from "@elysia/openapi";
import { Elysia } from "elysia";
import { z } from "zod";
import { configController } from "./controllers/config";
import { eventsController } from "./controllers/events";
import { healthController } from "./controllers/health";
import { servicesController } from "./controllers/services";
import { sitesController } from "./controllers/sites";
import { workspacesController } from "./controllers/workspaces";
import { errorPlugin } from "./errors";

export const router = new Elysia({ prefix: "/api" })
	.use(errorPlugin)
	.use(
		openapi({
			documentation: {
				info: { title: "FLIP API", version: "1.0.0" },
			},
			mapJsonSchema: { zod: z.toJSONSchema },
		}),
	)
	.get("/", () => "OK")
	.use(healthController)
	.use(configController)
	.use(servicesController)
	.use(sitesController)
	.use(workspacesController)
	.use(eventsController);
