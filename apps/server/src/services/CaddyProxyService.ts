import os from "node:os";
import path from "node:path";
import { env } from "@flip/env/server";
import type { Service, ServicesRepository } from "../db/ServicesRepository";

const BOOTSTRAP_CONFIG_PATH = path.join(
	os.tmpdir(),
	"flip-caddy-bootstrap.json",
);
// Matches Vite/SvelteKit's own default dev-server port — never configured elsewhere in the
// repo, so not worth promoting to an env var just for this.
const VITE_DEV_PORT = 5173;

export interface BuildCaddyfileOptions {
	services: Service[];
	// "prod": one process (PORT) already serves both the SPA and /api — a single root
	// reverse_proxy is enough. "dev": the SPA (Vite) and API (Bun) are two separate
	// processes/ports, so the root block itself has to split by path.
	mode: "dev" | "prod";
	appPort: number;
	proxyPort: number;
	domain: string | undefined;
	adminPort: number;
}

// Caddy's admin API forwards a POST body to whichever config adapter matches its Content-Type
// — Caddyfile syntax here, so we never have to hand-author Caddy's internal JSON config tree.
// Emits, in order: a root/catch-all block (always present, regardless of PROXY_DOMAIN — this is
// what makes Caddy the sole entrypoint for FLIP's own UI/API) and then one exact-host block per
// proxy-enabled service when a domain is configured. Caddy's Caddyfile adapter sorts routes by
// host-matcher specificity regardless of block order, so the exact per-service hosts always win
// over the bare-port catch-all for their own subdomain, even though they share the same port.
export function buildCaddyfile({
	services,
	mode,
	appPort,
	proxyPort,
	domain,
	adminPort,
}: BuildCaddyfileOptions): string {
	// 127.0.0.1 for Bun specifically, not "localhost" — Bun binds the IPv4 loopback explicitly
	// (see index.ts), and "localhost" can resolve to ::1 first on a dual-stack host; if
	// something else happens to be listening on the same port number over IPv6, that ambiguity
	// would silently proxy traffic to the wrong process instead of failing loudly. Vite's own
	// bind address isn't controlled here (and has been observed IPv6-only in some setups), so
	// its target is left as "localhost" to follow whatever it actually resolves to.
	// http:// is load-bearing, not decorative: a bare "host:port" address is ambiguous to
	// Caddy's Caddyfile adapter, which responds by attaching a stub TLS connection policy to
	// the whole shared server "just in case" — even under the global auto_https off below,
	// which only suppresses automatic *certificate* management, not this policy attachment.
	// That stub alone makes Caddy wrap the entire port-8080 listener in TLS, breaking every
	// site sharing it (root included) the instant any one of them has a bare hostname:port
	// address. An explicit http:// scheme tells the adapter this address is unambiguously
	// plain HTTP, so it never contributes a TLS policy in the first place. Confirmed via
	// Caddy's own admin API (GET /config/): a bare per-service address produced
	// "tls_connection_policies":[{}] on srv0 and broke root-domain requests with "Client sent
	// an HTTP request to an HTTPS server" even though automatic_https.disable was true.
	const rootBlock =
		mode === "dev"
			? `http://:${proxyPort} {
	handle /api/* {
		reverse_proxy 127.0.0.1:${appPort}
	}
	handle {
		reverse_proxy localhost:${VITE_DEV_PORT}
	}
}`
			: `http://:${proxyPort} {
	reverse_proxy 127.0.0.1:${appPort}
}`;

	const serviceBlocks = domain
		? services
				.filter((service) => service.proxyHeaders)
				.map((service) => {
					// Origin only (scheme+host+port) — dropping any path is the whole point of
					// subdomain routing: the proxied app is served at its own root, so its own
					// root-absolute asset references keep working unmodified.
					const upstream = new URL(service.url).origin;
					// header_down is a reverse_proxy sub-directive, not a standalone one — it
					// has to be nested inside reverse_proxy's own block to be recognized.
					// header_up Host rewrites the outbound Host header to the real upstream's own
					// host:port instead of leaving FLIP's proxy-facing hostname on it (Caddy's
					// reverse_proxy default is to preserve whatever Host the client sent). Without
					// this, any downstream infrastructure that also routes by Host header — e.g. a
					// LAN-wide reverse proxy fronting the real service too — sees FLIP's own
					// subdomain instead of the service's real one and can bounce the request right
					// back to FLIP, looping forever (confirmed: request/Via headers grew unbounded
					// until Caddy dropped the connection with EOF).
					return `http://${service.id}.${domain}:${proxyPort} {
	reverse_proxy ${upstream} {
		header_up Host {http.reverse_proxy.upstream.hostport}
		header_down -X-Frame-Options
		header_down Content-Security-Policy "frame-ancestors[^;]*;?\\s*" ""
	}
}`;
				})
		: [];

	// auto_https off only disables Caddy's *automatic* cert management (ACME, http->https
	// redirects) — it doesn't stop Caddy from defaulting every server to advertise h2/h3, and
	// h3 (QUIC) mandates TLS, so a plain "auto_https off" server can still stand up a
	// TLS-requiring listener via Caddy's local self-signed identity. Pin to h1 explicitly so
	// this proxy never offers a protocol that needs TLS, matching the "plain HTTP only" design.
	return `{
	admin localhost:${adminPort}
	auto_https off
	log stdout
	servers {
		protocols h1
	}
}

${[rootBlock, ...serviceBlocks].join("\n\n")}
`;
}

// Manages FLIP's embedded Caddy reverse proxy — the sole network entrypoint for FLIP in both
// dev and prod. Always spawned and always fronting root/UI/API traffic; PROXY_DOMAIN only
// gates the additional per-service subdomain header-stripping blocks (see buildCaddyfile).
// A stateless-ish capability like ProbeService (no persisted state of its own — the source of
// truth is still services.yaml via the repository) but with a subprocess to own, instantiated
// the same way as everything else in this layer for consistency, not because it needs a
// repository for business logic.
export class CaddyProxyService {
	private process: ReturnType<typeof Bun.spawn> | undefined;

	constructor(private readonly repo: ServicesRepository) {}

	private mode(): "dev" | "prod" {
		return env.NODE_ENV === "production" ? "prod" : "dev";
	}

	private adminUrl(): string {
		return `http://localhost:${env.CADDY_ADMIN_PORT}`;
	}

	async start(): Promise<void> {
		await Bun.write(
			BOOTSTRAP_CONFIG_PATH,
			JSON.stringify({
				admin: { listen: `localhost:${env.CADDY_ADMIN_PORT}` },
			}),
		);

		try {
			// No --adapter flag: JSON is Caddy's native config format and needs no adapter at
			// all (an adapter converts some *other* format, e.g. Caddyfile, into this one) —
			// passing "--adapter json" is rejected as an unrecognized adapter name.
			this.process = Bun.spawn(
				["caddy", "run", "--config", BOOTSTRAP_CONFIG_PATH],
				{ stdout: "inherit", stderr: "inherit" },
			);
		} catch (err) {
			console.error(
				"[CaddyProxyService] failed to spawn caddy — is it installed on PATH? Caddy is FLIP's only entrypoint now, so the app is unreachable until this is fixed",
				err,
			);
			return;
		}

		await this.reloadWithRetry(await this.repo.findAll());
	}

	async stop(): Promise<void> {
		if (!this.process) return;
		this.process.kill();
		await this.process.exited;
		this.process = undefined;
	}

	async reload(services: Service[]): Promise<boolean> {
		const caddyfile = buildCaddyfile({
			services,
			mode: this.mode(),
			appPort: env.PORT,
			proxyPort: env.PROXY_PORT,
			domain: env.PROXY_DOMAIN,
			adminPort: env.CADDY_ADMIN_PORT,
		});
		try {
			// A timeout guards against the admin API never responding at all (e.g. something
			// else already bound to its port) — without one, a hung request here would stall
			// this.reloadWithRetry()'s loop indefinitely, which now blocks the whole app coming
			// up, not just the opt-in per-service proxy feature.
			const response = await fetch(`${this.adminUrl()}/load`, {
				method: "POST",
				headers: { "Content-Type": "text/caddyfile" },
				body: caddyfile,
				signal: AbortSignal.timeout(2000),
			});
			if (!response.ok) {
				console.error(
					"[CaddyProxyService] config reload rejected",
					response.status,
					await response.text(),
				);
				return false;
			}
			return true;
		} catch (err) {
			console.error("[CaddyProxyService] config reload request failed", err);
			return false;
		}
	}

	// The very first push races Caddy's admin listener coming up right after spawn. Previously a
	// missed race just left the opt-in per-service proxy silently broken; now Caddy fronts the
	// whole app, so a short bounded retry avoids a flaky "nothing loaded yet" window on every
	// boot instead of relying on luck plus Docker's --start-period grace window.
	private async reloadWithRetry(services: Service[]): Promise<void> {
		const attempts = 5;
		const delayMs = 100;
		for (let attempt = 1; attempt <= attempts; attempt++) {
			if (await this.reload(services)) return;
			if (attempt < attempts) await Bun.sleep(delayMs);
		}
		console.error(
			`[CaddyProxyService] failed to push initial config after ${attempts} attempts`,
		);
	}
}
