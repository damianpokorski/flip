import { cors } from "@elysiajs/cors";
import staticPlugin from "@elysiajs/static";
import { env } from "@flip/env/server";
import { configStore, initDataFiles, servicesStore, workspacesStore } from "@flip/store";
import Elysia from "elysia";
import { caddyProxyService, healthCheckService } from "./controllers/services";
import { notifyDataChanged } from "./events";
import { router } from "./router";

// Extra safety net in front of apps/bootstrap (which already runs this in production/Docker
// before the server starts) — ensures DATA_DIR and its default YAML files exist even when
// running `bun run dev:server` directly against a fresh checkout.
await initDataFiles();

// Watch services.yaml/workspaces.yaml/config.yaml for hand-edits and push them out over SSE
// — @flip/store only reloads its in-memory cache once something is actually watching, so
// this has to run once per process, not per-request.
servicesStore.watch();
workspacesStore.watch();
configStore.watch();
servicesStore.onChange((services) => {
  notifyDataChanged();
  caddyProxyService.reload(services);
});
workspacesStore.onChange(notifyDataChanged);
configStore.onChange(notifyDataChanged);

// Skipped under e2e (DISABLE_HEALTH_CHECKS, set by apps/web/playwright.config.ts) — health
// checks are live fetches against each service's real URL, which would make screenshot/e2e
// runs depend on real network timing and third-party reachability.
if (!process.env.DISABLE_HEALTH_CHECKS) healthCheckService.start();
await caddyProxyService.start();

const shutdown = async (signal: NodeJS.Signals) => {
  console.log(`[server] ${signal} received, shutting down`);
  healthCheckService.stop();
  await caddyProxyService.stop();
  process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

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
    .get("/*", () => Bun.file(`${publicDir}/index.html`)) as unknown as typeof fullstack;
}

// Loopback-only: PORT is never meant to be reached except by the embedded Caddy proxy on the
// same host, which is now the sole entrypoint (see CaddyProxyService). Binding 0.0.0.0 here
// would let a stray container port-publish or LAN request bypass Caddy entirely.
fullstack.listen({ port: env.PORT, hostname: "127.0.0.1" }, () =>
  console.log(`Server running on port ${env.PORT} (internal-only, fronted by Caddy)`),
);
