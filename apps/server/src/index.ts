import { cors } from "@elysiajs/cors";
import staticPlugin from "@elysiajs/static";
import { env } from "@flip/env/server";
import { configStore, initDataFiles, panelsStore } from "@flip/store";
import Elysia from "elysia";
import { healthCheckService } from "./controllers/panels";
import { notifyDataChanged } from "./events";
import { router } from "./router";

// Extra safety net in front of apps/bootstrap (which already runs this in production/Docker
// before the server starts) — ensures DATA_DIR and its default YAML files exist even when
// running `bun run dev:server` directly against a fresh checkout.
await initDataFiles();

// Watch panels.yaml/config.yaml for hand-edits and push them out over SSE — @flip/store
// only reloads its in-memory cache once something is actually watching, so this has to
// run once per process, not per-request.
panelsStore.watch();
configStore.watch();
panelsStore.onChange(notifyDataChanged);
configStore.onChange(notifyDataChanged);

healthCheckService.start();

let fullstack = new Elysia({});

fullstack.use(
	router.use(
		cors({
			origin: env.CORS_ORIGIN,
			methods: "*",
		}),
	),
);

// Conditionally load static assets from a public dir if defined — the production Docker
// image serves the built SvelteKit SPA from here; local dev serves it via `vite dev` instead.
const publicDir = process.env.PUBLIC_DIR;
if (publicDir) {
	console.log(`Serving static assets from ${publicDir}`);
	fullstack = fullstack
		.use(staticPlugin({ assets: publicDir, prefix: "/" }))
		.get("/*", () =>
			Bun.file(`${publicDir}/index.html`),
		) as unknown as typeof fullstack;
}

fullstack.listen(env.PORT, () =>
	console.log(`Server running on port ${env.PORT}`),
);
