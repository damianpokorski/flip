import {
	afterEach,
	beforeEach,
	describe,
	expect,
	mock,
	spyOn,
	test,
} from "bun:test";

// Static imports are hoisted above mock.module(), so only the dynamically-imported
// CaddyProxyService below sees this mocked env — mirrors HealthCheckService.test.ts's
// pattern of mocking the one I/O-adjacent seam (here, env vars) via mock.module.
const envMock: {
	PROXY_DOMAIN: string | undefined;
	PORT: number;
	NODE_ENV: "development" | "production" | "test";
	CADDY_ADMIN_PORT: number;
} = {
	PROXY_DOMAIN: undefined,
	PORT: 3000,
	NODE_ENV: "development",
	CADDY_ADMIN_PORT: 2019,
};
mock.module("@flip/env/server", () => ({ env: envMock }));

const { CaddyProxyService, buildCaddyfile } = await import(
	"./CaddyProxyService"
);

function service(overrides: Partial<Record<string, unknown>> = {}) {
	return {
		id: "svc-a",
		url: "https://a.home.lan:1111",
		proxyHeaders: true,
		...overrides,
	};
}

describe("buildCaddyfile", () => {
	// Arrange/Act/Assert kept terse here since these are pure-function assertions with no
	// setup beyond the fixture arrays themselves.

	test("prod mode: root block is a single bare-port reverse_proxy to appPort", () => {
		const caddyfile = buildCaddyfile({
			services: [],
			mode: "prod",
			appPort: 3000,
			proxyPort: 8080,
			domain: undefined,
			adminPort: 2019,
		});

		expect(caddyfile).toContain(
			"http://:8080 {\n\treverse_proxy 127.0.0.1:3000\n}",
		);
		expect(caddyfile).not.toContain("handle");
	});

	test("dev mode: root block splits /api/* to appPort and everything else to Vite's port", () => {
		const caddyfile = buildCaddyfile({
			services: [],
			mode: "dev",
			appPort: 3000,
			proxyPort: 8080,
			domain: undefined,
			adminPort: 2019,
		});

		expect(caddyfile).toContain("handle /api/*");
		expect(caddyfile).toContain("reverse_proxy 127.0.0.1:3000");
		expect(caddyfile).toContain("reverse_proxy localhost:5173");
	});

	test("root block is present even when no domain is configured", () => {
		const caddyfile = buildCaddyfile({
			services: [],
			mode: "prod",
			appPort: 3000,
			proxyPort: 8080,
			domain: undefined,
			adminPort: 2019,
		});

		expect(caddyfile).toContain("http://:8080 {");
	});

	test("emits no per-service blocks when domain is undefined, regardless of proxyHeaders", () => {
		const services = [service({ id: "a", proxyHeaders: true })];

		const caddyfile = buildCaddyfile({
			services: services as never,
			mode: "prod",
			appPort: 3000,
			proxyPort: 8080,
			domain: undefined,
			adminPort: 2019,
		});

		expect(caddyfile).not.toContain("a.");
	});

	test("includes only proxyHeaders services, addressed as <id>.<domain>:<proxyPort>", () => {
		const services = [
			service({ id: "a", proxyHeaders: true }),
			service({ id: "b", proxyHeaders: false }),
		];

		const caddyfile = buildCaddyfile({
			services: services as never,
			mode: "prod",
			appPort: 3000,
			proxyPort: 8080,
			domain: "flip.lan",
			adminPort: 2019,
		});

		expect(caddyfile).toContain("http://a.flip.lan:8080");
		expect(caddyfile).not.toContain("b.flip.lan:8080");
	});

	test("per-service and root site addresses always carry an explicit http:// scheme", () => {
		// A bare "host:port" address is ambiguous to Caddy's Caddyfile adapter, which reacts
		// by attaching a stub TLS connection policy to the whole shared server — silently
		// wrapping the entire port in TLS even with auto_https off, and breaking every other
		// site sharing that port (confirmed against Caddy's own admin API: a bare per-service
		// address produced "tls_connection_policies":[{}] on srv0). http:// must stay explicit
		// on every address this function emits.
		const services = [service({ id: "a", proxyHeaders: true })];

		const caddyfile = buildCaddyfile({
			services: services as never,
			mode: "prod",
			appPort: 3000,
			proxyPort: 8080,
			domain: "flip.lan",
			adminPort: 2019,
		});

		expect(caddyfile).toContain("http://:8080 {");
		expect(caddyfile).toContain("http://a.flip.lan:8080 {");
	});

	test("reverse-proxies to the URL's origin only, dropping any path", () => {
		const services = [service({ url: "https://nas.home.lan:5000/some/path" })];

		const caddyfile = buildCaddyfile({
			services: services as never,
			mode: "prod",
			appPort: 3000,
			proxyPort: 8080,
			domain: "flip.lan",
			adminPort: 2019,
		});

		expect(caddyfile).toContain("reverse_proxy https://nas.home.lan:5000");
		expect(caddyfile).not.toContain("/some/path");
	});

	test("strips X-Frame-Options and rewrites the CSP frame-ancestors directive", () => {
		const services = [service()];

		const caddyfile = buildCaddyfile({
			services: services as never,
			mode: "prod",
			appPort: 3000,
			proxyPort: 8080,
			domain: "flip.lan",
			adminPort: 2019,
		});

		expect(caddyfile).toContain("header_down -X-Frame-Options");
		expect(caddyfile).toContain("header_down Content-Security-Policy");
	});

	test("rewrites the outbound Host header to the real upstream's own host:port", () => {
		// Caddy's reverse_proxy preserves the client's original Host header by default. Left
		// unrewritten, the upstream (and anything downstream of it that also routes by Host,
		// e.g. a LAN-wide reverse proxy) sees FLIP's own proxy subdomain instead of the
		// service's real one — which can misroute the request right back to FLIP in a loop.
		const services = [service()];

		const caddyfile = buildCaddyfile({
			services: services as never,
			mode: "prod",
			appPort: 3000,
			proxyPort: 8080,
			domain: "flip.lan",
			adminPort: 2019,
		});

		expect(caddyfile).toContain(
			"header_up Host {http.reverse_proxy.upstream.hostport}",
		);
	});

	test("admin API listens on the given adminPort", () => {
		const caddyfile = buildCaddyfile({
			services: [],
			mode: "prod",
			appPort: 3000,
			proxyPort: 8080,
			domain: undefined,
			adminPort: 3019,
		});

		expect(caddyfile).toContain("admin localhost:3019");
	});

	test("global options pin protocols to h1 so no TLS-requiring protocol (h2/h3) is ever offered", () => {
		const caddyfile = buildCaddyfile({
			services: [],
			mode: "prod",
			appPort: 3000,
			proxyPort: 8080,
			domain: undefined,
			adminPort: 2019,
		});

		expect(caddyfile).toContain("auto_https off");
		expect(caddyfile).toContain("servers {\n\t\tprotocols h1\n\t}");
	});

	test("produces no per-service site blocks when no service opts in", () => {
		const services = [service({ proxyHeaders: false })];

		const caddyfile = buildCaddyfile({
			services: services as never,
			mode: "prod",
			appPort: 3000,
			proxyPort: 8080,
			domain: "flip.lan",
			adminPort: 2019,
		});

		expect(caddyfile).not.toMatch(/\.flip\.lan:8080/);
	});
});

describe("buildCaddyfile hardening", () => {
	const base = {
		mode: "prod" as const,
		appPort: 3000,
		proxyPort: 8080,
		domain: "flip.lan",
		adminPort: 2019,
	};

	test("uses labelFor's label as the subdomain instead of the service id", () => {
		const caddyfile = buildCaddyfile({
			...base,
			services: [service({ id: "svc-a" })] as never,
			labelFor: () => "abc123",
		});

		expect(caddyfile).toContain("http://abc123.flip.lan:8080 {");
		expect(caddyfile).not.toContain("svc-a.flip.lan");
	});

	test("locks frame-ancestors to the learned hosts on both schemes", () => {
		const caddyfile = buildCaddyfile({
			...base,
			services: [service()] as never,
			frameAncestorHosts: ["flip.lan:8080"],
		});

		expect(caddyfile).toContain(
			'header_down +Content-Security-Policy "frame-ancestors http://flip.lan:8080 https://flip.lan:8080"',
		);
	});

	test("falls back to frame-ancestors 'none' before any origin is learned", () => {
		const caddyfile = buildCaddyfile({
			...base,
			services: [service()] as never,
		});

		expect(caddyfile).toContain(
			`header_down +Content-Security-Policy "frame-ancestors 'none'"`,
		);
	});

	test("sets a default same-origin Referrer-Policy", () => {
		const caddyfile = buildCaddyfile({
			...base,
			services: [service()] as never,
		});

		expect(caddyfile).toContain("header ?Referrer-Policy same-origin");
	});

	test("refuses top-level navigations via Sec-Fetch-Dest: document", () => {
		const caddyfile = buildCaddyfile({
			...base,
			services: [service()] as never,
		});

		expect(caddyfile).toContain("@toplevel header Sec-Fetch-Dest document");
		expect(caddyfile).toContain('respond @toplevel "Forbidden" 403');
	});

	test("skips a service with an unparseable or non-http url instead of throwing", () => {
		const errorSpy = spyOn(console, "error").mockImplementation(() => {});
		const services = [
			service({ id: "bad", url: "not a url" }),
			service({ id: "ftp", url: "ftp://nas.lan/share" }),
			service({ id: "good", url: "https://good.lan" }),
		];

		const caddyfile = buildCaddyfile({
			...base,
			services: services as never,
			labelFor: (s) => `label-${s.id}`,
		});

		expect(caddyfile).toContain("label-good.flip.lan");
		expect(caddyfile).not.toContain("label-bad");
		expect(caddyfile).not.toContain("label-ftp");
		errorSpy.mockRestore();
	});
});

describe("CaddyProxyService", () => {
	const originalFetch = global.fetch;
	const originalSpawn = Bun.spawn;
	const originalSleep = Bun.sleep;

	beforeEach(() => {
		envMock.PROXY_DOMAIN = undefined;
		envMock.PORT = 3000;
		envMock.NODE_ENV = "development";
		envMock.CADDY_ADMIN_PORT = 2019;
		// The initial-push retry sleeps between attempts — skip the real delay in tests.
		Bun.sleep = (() => Promise.resolve()) as unknown as typeof Bun.sleep;
	});

	afterEach(() => {
		global.fetch = originalFetch;
		Bun.spawn = originalSpawn;
		Bun.sleep = originalSleep;
	});

	test("reload() POSTs the generated Caddyfile to the admin API even when PROXY_DOMAIN is unset", async () => {
		// Arrange
		const fetchSpy = mock(async () => new Response("", { status: 200 }));
		global.fetch = fetchSpy as unknown as typeof fetch;
		const repo = { findAll: async () => [] };
		const proxy = new CaddyProxyService(repo as never);

		// Act
		const ok = await proxy.reload([service()] as never);

		// Assert
		expect(fetchSpy).toHaveBeenCalled();
		expect(ok).toBe(true);
	});

	test("reload() POSTs the generated Caddyfile to the admin API when PROXY_DOMAIN is set", async () => {
		// Arrange
		envMock.PROXY_DOMAIN = "flip.lan";
		let requestedUrl: string | undefined;
		let requestedInit: RequestInit | undefined;
		global.fetch = (async (url: string, init?: RequestInit) => {
			requestedUrl = url;
			requestedInit = init;
			return new Response("", { status: 200 });
		}) as unknown as typeof fetch;
		const repo = { findAll: async () => [] };
		const proxy = new CaddyProxyService(repo as never);

		// Act
		await proxy.reload([service({ id: "a" })] as never);

		// Assert
		expect(requestedUrl).toBe("http://localhost:2019/load");
		expect(requestedInit?.method).toBe("POST");
		const headers = requestedInit?.headers as Record<string, string>;
		expect(headers["Content-Type"]).toBe("text/caddyfile");
		expect(requestedInit?.body).toContain(
			`${proxy.labelFor("a")}.flip.lan:8080`,
		);
		expect(requestedInit?.body).not.toContain("a.flip.lan:8080");
	});

	test("labelFor() is stable within an instance, unique per service, and differs across instances", () => {
		// Arrange
		const repo = { findAll: async () => [] };
		const first = new CaddyProxyService(repo as never);
		const second = new CaddyProxyService(repo as never);

		// Act
		const a1 = first.labelFor("a");
		const a2 = first.labelFor("a");
		const b = first.labelFor("b");

		// Assert
		expect(a1).toBe(a2);
		expect(a1).not.toBe(b);
		expect(a1).toMatch(/^[0-9a-f]{32}$/);
		expect(second.labelFor("a")).not.toBe(a1);
	});

	test("reload() drops labels for services that no longer exist", async () => {
		// Arrange
		envMock.PROXY_DOMAIN = "flip.lan";
		global.fetch = (async () =>
			new Response("", { status: 200 })) as unknown as typeof fetch;
		const proxy = new CaddyProxyService({ findAll: async () => [] } as never);
		const before = proxy.labelFor("gone");

		// Act
		await proxy.reload([]);

		// Assert
		expect(proxy.labelFor("gone")).not.toBe(before);
	});

	test("learnOrigin() reloads once with the new host in frame-ancestors, and dedupes repeats", async () => {
		// Arrange
		envMock.PROXY_DOMAIN = "flip.lan";
		const bodies: string[] = [];
		global.fetch = (async (_url: string, init?: RequestInit) => {
			bodies.push(String(init?.body));
			return new Response("", { status: 200 });
		}) as unknown as typeof fetch;
		const repo = { findAll: async () => [service({ id: "a" })] };
		const proxy = new CaddyProxyService(repo as never);

		// Act
		await proxy.learnOrigin("Flip.LAN:8080");
		await proxy.learnOrigin("flip.lan:8080");

		// Assert
		expect(bodies).toHaveLength(1);
		expect(bodies[0]).toContain("frame-ancestors http://flip.lan:8080");
	});

	test("learnOrigin() ignores malformed hosts, proxied subdomains, and hosts beyond the cap", async () => {
		// Arrange
		envMock.PROXY_DOMAIN = "flip.lan";
		const fetchSpy = mock(async () => new Response("", { status: 200 }));
		global.fetch = fetchSpy as unknown as typeof fetch;
		const proxy = new CaddyProxyService({ findAll: async () => [] } as never);

		// Act
		await proxy.learnOrigin(null);
		await proxy.learnOrigin("evil host; { }");
		await proxy.learnOrigin("abc.flip.lan:8080");
		for (let i = 0; i < 20; i++) await proxy.learnOrigin(`h${i}.example`);

		// Assert
		expect(fetchSpy).toHaveBeenCalledTimes(8);
	});

	test("learnOrigin() accepts the bare PROXY_DOMAIN itself", async () => {
		// Arrange
		envMock.PROXY_DOMAIN = "flip.lan";
		const fetchSpy = mock(async () => new Response("", { status: 200 }));
		global.fetch = fetchSpy as unknown as typeof fetch;
		const proxy = new CaddyProxyService({ findAll: async () => [] } as never);

		// Act
		await proxy.learnOrigin("flip.lan");

		// Assert
		expect(fetchSpy).toHaveBeenCalledTimes(1);
	});

	test("reload() targets CADDY_ADMIN_PORT when overridden from the default 2019", async () => {
		// Arrange — e.g. a machine where something else already owns 2019.
		envMock.CADDY_ADMIN_PORT = 3019;
		let requestedUrl: string | undefined;
		global.fetch = (async (url: string) => {
			requestedUrl = url;
			return new Response("", { status: 200 });
		}) as unknown as typeof fetch;
		const repo = { findAll: async () => [] };
		const proxy = new CaddyProxyService(repo as never);

		// Act
		await proxy.reload([] as never);

		// Assert
		expect(requestedUrl).toBe("http://localhost:3019/load");
	});

	test("reload() pushes a dev-mode split when NODE_ENV is not production", async () => {
		// Arrange
		envMock.NODE_ENV = "development";
		let requestedInit: RequestInit | undefined;
		global.fetch = (async (_url: string, init?: RequestInit) => {
			requestedInit = init;
			return new Response("", { status: 200 });
		}) as unknown as typeof fetch;
		const repo = { findAll: async () => [] };
		const proxy = new CaddyProxyService(repo as never);

		// Act
		await proxy.reload([] as never);

		// Assert
		expect(requestedInit?.body).toContain("handle /api/*");
	});

	test("reload() pushes a prod-mode single reverse_proxy when NODE_ENV is production", async () => {
		// Arrange
		envMock.NODE_ENV = "production";
		let requestedInit: RequestInit | undefined;
		global.fetch = (async (_url: string, init?: RequestInit) => {
			requestedInit = init;
			return new Response("", { status: 200 });
		}) as unknown as typeof fetch;
		const repo = { findAll: async () => [] };
		const proxy = new CaddyProxyService(repo as never);

		// Act
		await proxy.reload([] as never);

		// Assert
		expect(requestedInit?.body).not.toContain("handle");
	});

	test("reload() fixes the published port by mode — 8080 in dev, 80 in prod — with no env override", async () => {
		// Arrange
		envMock.NODE_ENV = "development";
		let devInit: RequestInit | undefined;
		global.fetch = (async (_url: string, init?: RequestInit) => {
			devInit = init;
			return new Response("", { status: 200 });
		}) as unknown as typeof fetch;
		const repo = { findAll: async () => [] };
		const devProxy = new CaddyProxyService(repo as never);

		// Act
		await devProxy.reload([] as never);

		// Assert
		expect(devInit?.body).toContain("http://:8080 {");

		// Arrange
		envMock.NODE_ENV = "production";
		let prodInit: RequestInit | undefined;
		global.fetch = (async (_url: string, init?: RequestInit) => {
			prodInit = init;
			return new Response("", { status: 200 });
		}) as unknown as typeof fetch;
		const prodProxy = new CaddyProxyService(repo as never);

		// Act
		await prodProxy.reload([] as never);

		// Assert
		expect(prodInit?.body).toContain("http://:80 {");
	});

	test("reload() returns false without throwing when the admin API rejects the config", async () => {
		// Arrange
		global.fetch = (async () =>
			new Response("bad config", { status: 400 })) as unknown as typeof fetch;
		const repo = { findAll: async () => [] };
		const proxy = new CaddyProxyService(repo as never);

		// Act
		const ok = await proxy.reload([] as never);

		// Assert
		expect(ok).toBe(false);
	});

	test("start() spawns caddy regardless of PROXY_DOMAIN being unset", async () => {
		// Arrange
		const spawnSpy = mock(() => ({ kill: mock(), exited: Promise.resolve(0) }));
		Bun.spawn = spawnSpy as unknown as typeof Bun.spawn;
		global.fetch = (async () =>
			new Response("", { status: 200 })) as unknown as typeof fetch;
		const repo = { findAll: async () => [] };
		const proxy = new CaddyProxyService(repo as never);

		// Act
		await proxy.start();

		// Assert
		expect(spawnSpy).toHaveBeenCalled();
	});

	test("start() spawns caddy and reloads with the current service list when PROXY_DOMAIN is set", async () => {
		// Arrange
		envMock.PROXY_DOMAIN = "flip.lan";
		const spawnSpy = mock(() => ({ kill: mock(), exited: Promise.resolve(0) }));
		Bun.spawn = spawnSpy as unknown as typeof Bun.spawn;
		let fetched = false;
		global.fetch = (async () => {
			fetched = true;
			return new Response("", { status: 200 });
		}) as unknown as typeof fetch;
		const repo = { findAll: async () => [service({ id: "a" })] };
		const proxy = new CaddyProxyService(repo as never);

		// Act
		await proxy.start();

		// Assert
		expect(spawnSpy).toHaveBeenCalled();
		expect(fetched).toBe(true);
	});

	test("start() retries the initial config push a bounded number of times before giving up", async () => {
		// Arrange
		Bun.spawn = mock(() => ({
			kill: mock(),
			exited: Promise.resolve(0),
		})) as unknown as typeof Bun.spawn;
		let callCount = 0;
		global.fetch = (async () => {
			callCount++;
			if (callCount < 3) return new Response("", { status: 502 });
			return new Response("", { status: 200 });
		}) as unknown as typeof fetch;
		const repo = { findAll: async () => [] };
		const proxy = new CaddyProxyService(repo as never);

		// Act
		await proxy.start();

		// Assert — succeeded on the 3rd attempt, so it should have stopped retrying there.
		expect(callCount).toBe(3);
	});

	test("start() warns instead of throwing when caddy isn't on PATH", async () => {
		// Arrange
		Bun.spawn = (() => {
			throw new Error("ENOENT: caddy not found");
		}) as unknown as typeof Bun.spawn;
		const repo = { findAll: async () => [] };
		const proxy = new CaddyProxyService(repo as never);

		// Act / Assert — must not throw and must not crash the caller.
		await expect(proxy.start()).resolves.toBeUndefined();
	});

	test("stop() kills the spawned process and awaits its exit", async () => {
		// Arrange
		const killMock = mock();
		Bun.spawn = mock(() => ({
			kill: killMock,
			exited: Promise.resolve(0),
		})) as unknown as typeof Bun.spawn;
		global.fetch = (async () =>
			new Response("", { status: 200 })) as unknown as typeof fetch;
		const repo = { findAll: async () => [] };
		const proxy = new CaddyProxyService(repo as never);
		await proxy.start();

		// Act
		await proxy.stop();

		// Assert
		expect(killMock).toHaveBeenCalled();
	});
});
