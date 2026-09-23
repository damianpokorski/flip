import path from "node:path";
import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

// Anchored to this file's location (not the caller's cwd), so it resolves to the same
// place whether invoked from a workspace subdirectory in dev or from the Docker image
// root — repo-root/data in dev, overridden to /data in the Docker image.
const DEFAULT_DATA_DIR = path.resolve(import.meta.dir, "../../../data");

export const env = createEnv({
	server: {
		DATA_DIR: z.string().default(DEFAULT_DATA_DIR),
		// Unset (the default) means: no CORS headers in production — the SPA is served same-origin
		// through Caddy, so cross-origin access has no legitimate use — and Vite's dev origin
		// (http://localhost:5173) in development, where the SPA and API are separate origins.
		CORS_ORIGIN: z.url().optional(),
		NODE_ENV: z
			.enum(["development", "production", "test"])
			.default("development"),
		// Bun/Elysia's own listen port — internal-only. The embedded Caddy proxy (below) is now
		// the sole externally-reachable entrypoint in both dev and prod, so this is never meant
		// to be published/reached directly (see apps/server/src/index.ts's loopback bind).
		PORT: z.coerce.number().int().positive().default(3000),
		HEALTH_CHECK_INTERVAL_MS: z.coerce
			.number()
			.int()
			.positive()
			.default(30_000),
		HEALTH_CHECK_TIMEOUT_MS: z.coerce.number().int().positive().default(5_000),
		// Base domain for FLIP's embedded per-service header-stripping proxy, e.g.
		// "flip.home.lan" — a service with `proxyHeaders: true` is addressed at
		// "<id>.<PROXY_DOMAIN>:<port>", where <port> is Caddy's fixed published port (80 in
		// production, 8080 in dev — see CaddyProxyService.resolveProxyPort; not an env var).
		// Requires a one-time wildcard DNS record (*.flip.home.lan -> this host) as manual
		// network setup — see README. Unset (the default) disables only this per-service
		// subdomain feature — the embedded Caddy proxy itself always runs regardless of this
		// variable, since it's also the sole entrypoint for FLIP's own UI/API traffic
		// (root/unmatched requests -> PORT).
		PROXY_DOMAIN: z.string().optional(),
		// Caddy's own admin API — always loopback-only, never published/exposed regardless of
		// this value. Configurable (rather than truly hardcoded) purely so a machine that
		// already has something else bound to the default 2019 (a real thing that happens —
		// e.g. another dev tool) can still run FLIP locally without a port fight.
		CADDY_ADMIN_PORT: z.coerce.number().int().positive().default(2019),
	},
	runtimeEnv: process.env,
	skipValidation: !!process.env.SKIP_ENV_VALIDATION,
	emptyStringAsUndefined: true,
});
