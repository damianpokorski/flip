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
// Spied on the real emitter rather than mock.module("../events", ...) — mock.module replaces
// the module for every file that resolves to the same path within this test run, and other
// suites (e.g. controllers/events.test.ts) import the real dataEvents too.
const { dataEvents } = await import("../events");

function service(overrides: Partial<Record<string, unknown>> = {}) {
	return {
		id: "svc-a",
		url: "https://a.home.lan:1111",
		proxyHeaders: true,
		inject: [],
		...overrides,
	};
}

// In-memory stand-in for ConfigRepository — real enough to exercise
// "generate once, persist, reuse" semantics (get() reflects whatever update() last wrote).
function fakeConfigRepo(initialProxySecret: string | null = null) {
	let proxySecret = initialProxySecret;
	return {
		get: async () => ({ proxySecret }),
		update: async (patch: { proxySecret?: string | null }) => {
			if ("proxySecret" in patch) proxySecret = patch.proxySecret ?? null;
			return { proxySecret };
		},
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

	test("global options bound the reload grace period so open SSE streams can't hold an old server forever", () => {
		const caddyfile = buildCaddyfile({
			services: [],
			mode: "prod",
			appPort: 3000,
			proxyPort: 8080,
			domain: undefined,
			adminPort: 2019,
		});

		expect(caddyfile).toContain("grace_period 10s");
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
			'+Content-Security-Policy "frame-ancestors http://flip.lan:8080 https://flip.lan:8080"',
		);
	});

	test("falls back to frame-ancestors 'none' before any origin is learned", () => {
		const caddyfile = buildCaddyfile({
			...base,
			services: [service()] as never,
		});

		expect(caddyfile).toContain(
			`+Content-Security-Policy "frame-ancestors 'none'"`,
		);
	});

	test("adds FLIP's frame-ancestors as a deferred site-level header, never a header_down the strip would wipe", () => {
		// Arrange
		const services = [service()];

		// Act
		const caddyfile = buildCaddyfile({
			...base,
			services: services as never,
			frameAncestorHosts: ["flip.lan:8080"],
		});

		// Assert
		expect(caddyfile).toContain(
			'\theader {\n\t\t+Content-Security-Policy "frame-ancestors http://flip.lan:8080 https://flip.lan:8080"\n\t\tdefer\n\t}',
		);
		expect(caddyfile).not.toContain("header_down +Content-Security-Policy");
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

describe("buildCaddyfile injections", () => {
	const base = {
		mode: "prod" as const,
		appPort: 3000,
		proxyPort: 8080,
		domain: "flip.lan",
		adminPort: 2019,
	};

	test("emits request/response header rows after FLIP's own header rules", () => {
		// Arrange
		const inject = [
			{ kind: "requestHeader", key: "X-User", value: "me" },
			{ kind: "responseHeader", key: "X-Test", value: "1" },
		];

		// Act
		const caddyfile = buildCaddyfile({
			...base,
			services: [service({ inject })] as never,
		});

		// Assert
		const hostRewrite = caddyfile.indexOf("header_up Host");
		const cspStrip = caddyfile.indexOf("header_down Content-Security-Policy");
		expect(hostRewrite).toBeGreaterThan(-1);
		expect(cspStrip).toBeGreaterThan(-1);
		expect(caddyfile.indexOf('header_up X-User "me"')).toBeGreaterThan(
			hostRewrite,
		);
		expect(caddyfile.indexOf('header_down X-Test "1"')).toBeGreaterThan(
			cspStrip,
		);
	});

	test("escapes double quotes inside an injected header value", () => {
		// Arrange
		const inject = [{ kind: "requestHeader", key: "X-Q", value: 'a "b" c' }];

		// Act
		const caddyfile = buildCaddyfile({
			...base,
			services: [service({ inject })] as never,
		});

		// Assert
		expect(caddyfile).toContain('header_up X-Q "a \\"b\\" c"');
	});

	test("header-only and query-only injections add no seed route", () => {
		// Arrange
		const inject = [
			{ kind: "requestHeader", key: "X-User", value: "me" },
			{ kind: "query", key: "kiosk", value: "" },
		];

		// Act
		const caddyfile = buildCaddyfile({
			...base,
			services: [service({ inject })] as never,
		});

		// Assert
		expect(caddyfile).not.toContain("/__flip/seed");
		expect(caddyfile).not.toContain("route {");
	});

	test("a localStorage or cookie row adds a seed route rewritten onto FLIP's API", () => {
		// Arrange
		const inject = [
			{ kind: "localStorage", key: "dockedSidebar", value: '"always_hidden"' },
		];

		// Act
		const caddyfile = buildCaddyfile({
			...base,
			services: [service({ id: "svc-a", inject })] as never,
		});

		// Assert
		expect(caddyfile).toContain("handle /__flip/seed {");
		expect(caddyfile).toContain("rewrite * /api/services/svc-a/seed?{query}");
		expect(caddyfile).toContain("reverse_proxy 127.0.0.1:3000\n");
	});

	test("the seed route sits inside `route` after the top-level 403, so the 403 still runs first", () => {
		// Arrange
		const inject = [{ kind: "cookie", key: "session", value: "abc" }];

		// Act
		const caddyfile = buildCaddyfile({
			...base,
			services: [service({ inject })] as never,
		});

		// Assert
		const route = caddyfile.indexOf("route {");
		const forbidden = caddyfile.indexOf('respond @toplevel "Forbidden" 403');
		const seed = caddyfile.indexOf("handle /__flip/seed");
		const upstream = caddyfile.indexOf("reverse_proxy https://a.home.lan:1111");
		expect(route).toBeGreaterThan(-1);
		expect(forbidden).toBeGreaterThan(route);
		expect(seed).toBeGreaterThan(forbidden);
		expect(upstream).toBeGreaterThan(seed);
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
		const proxy = new CaddyProxyService(
			repo as never,
			fakeConfigRepo() as never,
		);

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
		const proxy = new CaddyProxyService(
			repo as never,
			fakeConfigRepo() as never,
		);

		// Act
		await proxy.reload([service({ id: "a" })] as never);

		// Assert
		expect(requestedUrl).toBe("http://localhost:2019/load");
		expect(requestedInit?.method).toBe("POST");
		const headers = requestedInit?.headers as Record<string, string>;
		expect(headers["Content-Type"]).toBe("text/caddyfile");
		expect(requestedInit?.body).toContain(
			`${await proxy.labelFor("a")}.flip.lan:8080`,
		);
		expect(requestedInit?.body).not.toContain("a.flip.lan:8080");
	});

	test("labelFor() is stable per instance and per service, matches across instances sharing a secret, and differs across instances with independent secrets", async () => {
		// Arrange
		const sharedConfig = fakeConfigRepo();
		const first = new CaddyProxyService(
			{ findAll: async () => [] } as never,
			sharedConfig as never,
		);
		const second = new CaddyProxyService(
			{ findAll: async () => [] } as never,
			sharedConfig as never,
		);
		const independent = new CaddyProxyService(
			{ findAll: async () => [] } as never,
			fakeConfigRepo() as never,
		);

		// Act
		const a1 = await first.labelFor("a");
		const a2 = await first.labelFor("a");
		const b = await first.labelFor("b");
		const sharedA = await second.labelFor("a");
		const independentA = await independent.labelFor("a");

		// Assert
		expect(a1).toBe(a2);
		expect(a1).not.toBe(b);
		expect(a1).toMatch(/^[0-9a-f]{32}$/);
		expect(sharedA).toBe(a1);
		expect(independentA).not.toBe(a1);
	});

	test("labelFor() reuses a secret already persisted in config.yaml instead of generating a new one", async () => {
		// Arrange
		const configRepo = fakeConfigRepo("preexisting-secret");
		const proxy = new CaddyProxyService(
			{ findAll: async () => [] } as never,
			configRepo as never,
		);

		// Act
		const label = await proxy.labelFor("a");

		// Assert
		expect(label).toBe(await proxy.labelFor("a"));
		expect((await configRepo.get()).proxySecret).toBe("preexisting-secret");
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
		const proxy = new CaddyProxyService(
			repo as never,
			fakeConfigRepo() as never,
		);

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
		const proxy = new CaddyProxyService(
			{ findAll: async () => [] } as never,
			fakeConfigRepo() as never,
		);

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
		const proxy = new CaddyProxyService(
			{ findAll: async () => [] } as never,
			fakeConfigRepo() as never,
		);

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
		const proxy = new CaddyProxyService(
			repo as never,
			fakeConfigRepo() as never,
		);

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
		const proxy = new CaddyProxyService(
			repo as never,
			fakeConfigRepo() as never,
		);

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
		const proxy = new CaddyProxyService(
			repo as never,
			fakeConfigRepo() as never,
		);

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
		const devProxy = new CaddyProxyService(
			repo as never,
			fakeConfigRepo() as never,
		);

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
		const prodProxy = new CaddyProxyService(
			repo as never,
			fakeConfigRepo() as never,
		);

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
		const proxy = new CaddyProxyService(
			repo as never,
			fakeConfigRepo() as never,
		);

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
		const proxy = new CaddyProxyService(
			repo as never,
			fakeConfigRepo() as never,
		);

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
		const proxy = new CaddyProxyService(
			repo as never,
			fakeConfigRepo() as never,
		);

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
		const proxy = new CaddyProxyService(
			repo as never,
			fakeConfigRepo() as never,
		);

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
		const proxy = new CaddyProxyService(
			repo as never,
			fakeConfigRepo() as never,
		);

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
		const proxy = new CaddyProxyService(
			repo as never,
			fakeConfigRepo() as never,
		);
		await proxy.start();

		// Act
		await proxy.stop();

		// Assert
		expect(killMock).toHaveBeenCalled();
	});

	test("regenerateSecret() persists a new secret, changing every subsequent label", async () => {
		// Arrange
		global.fetch = (async () =>
			new Response("", { status: 200 })) as unknown as typeof fetch;
		const configRepo = fakeConfigRepo();
		const proxy = new CaddyProxyService(
			{ findAll: async () => [] } as never,
			configRepo as never,
		);
		const before = await proxy.labelFor("a");

		// Act
		await proxy.regenerateSecret();

		// Assert
		expect(await proxy.labelFor("a")).not.toBe(before);
		expect((await configRepo.get()).proxySecret).not.toBeNull();
	});

	test("regenerateSecret() reloads Caddy with the new labels and notifies clients", async () => {
		// Arrange
		envMock.PROXY_DOMAIN = "flip.lan";
		const bodies: string[] = [];
		global.fetch = (async (_url: string, init?: RequestInit) => {
			bodies.push(String(init?.body));
			return new Response("", { status: 200 });
		}) as unknown as typeof fetch;
		const proxy = new CaddyProxyService(
			{ findAll: async () => [service({ id: "a" })] } as never,
			fakeConfigRepo() as never,
		);
		await proxy.reload([service({ id: "a" })] as never);
		const oldLabel = await proxy.labelFor("a");
		const changeSpy = mock();
		dataEvents.once("change", changeSpy);

		// Act
		await proxy.regenerateSecret();

		// Assert
		const newLabel = await proxy.labelFor("a");
		expect(bodies.at(-1)).toContain(`${newLabel}.flip.lan:8080`);
		expect(bodies.at(-1)).not.toContain(`${oldLabel}.flip.lan:8080`);
		expect(changeSpy).toHaveBeenCalled();
	});

	test("reports an unexpected caddy exit to the registered listener and marks it dead", async () => {
		// Arrange
		let exit: (code: number) => void = () => {};
		Bun.spawn = mock(() => ({
			kill: mock(),
			exited: new Promise<number>((resolve) => {
				exit = resolve;
			}),
		})) as unknown as typeof Bun.spawn;
		global.fetch = (async () =>
			new Response("", { status: 200 })) as unknown as typeof fetch;
		const proxy = new CaddyProxyService(
			{ findAll: async () => [] } as never,
			fakeConfigRepo() as never,
		);
		const onExit = mock();
		proxy.onUnexpectedExit(onExit);
		const consoleError = spyOn(console, "error").mockImplementation(() => {});
		await proxy.start();
		const aliveBefore = proxy.isAlive;

		// Act
		exit(1);
		await new Promise((resolve) => setTimeout(resolve, 0));

		// Assert
		expect(aliveBefore).toBe(true);
		expect(proxy.isAlive).toBe(false);
		expect(onExit).toHaveBeenCalledWith(1);
		consoleError.mockRestore();
	});

	test("does not report caddy's exit as unexpected when stop() caused it", async () => {
		// Arrange
		let exit: (code: number) => void = () => {};
		const exited = new Promise<number>((resolve) => {
			exit = resolve;
		});
		Bun.spawn = mock(() => ({
			kill: mock(() => exit(0)),
			exited,
		})) as unknown as typeof Bun.spawn;
		global.fetch = (async () =>
			new Response("", { status: 200 })) as unknown as typeof fetch;
		const proxy = new CaddyProxyService(
			{ findAll: async () => [] } as never,
			fakeConfigRepo() as never,
		);
		const onExit = mock();
		proxy.onUnexpectedExit(onExit);
		await proxy.start();

		// Act
		await proxy.stop();
		await new Promise((resolve) => setTimeout(resolve, 0));

		// Assert
		expect(onExit).not.toHaveBeenCalled();
		expect(proxy.isAlive).toBe(false);
	});
});
