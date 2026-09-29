import type { Injection } from "@flip/store/schemas/service";

// Throwaway base for resolving `next` — only its origin matters, as a sentinel to compare against.
const SENTINEL_ORIGIN = "http://seed.invalid";

// Only same-origin paths may be redirected to, otherwise the seed route would be an open
// redirect on every proxied host. Resolving through the URL parser (rather than a prefix check)
// matters: browsers strip tabs/newlines and treat "\" as "/", so "/\t/evil" or "/\evil" would
// pass a naive startsWith("/") && !startsWith("//") check and still land on another host.
export function sanitizeNext(next: string | undefined): string {
	if (!next?.startsWith("/")) return "/";
	let url: URL;
	try {
		url = new URL(next, SENTINEL_ORIGIN);
	} catch {
		return "/";
	}
	if (url.origin !== SENTINEL_ORIGIN) return "/";
	return `${url.pathname}${url.search}${url.hash}`;
}

// A bare cookie would default its Path to the seed route's own directory (/__flip), invisible
// to the app everywhere else — scope it to the whole origin unless the value says otherwise.
function setCookieValue({ key, value }: Injection): string {
	const cookie = `${key}=${value}`;
	return /;\s*path=/i.test(value) ? cookie : `${cookie}; Path=/`;
}

// The page served at `/__flip/seed` on a proxied service's own origin (Caddy rewrites it through
// to FLIP's API — see CaddyProxyService). It sets that service's cookie/localStorage injections
// and immediately hands off to the real app, on every frame load. Being a real document on the
// proxied origin is the whole point: it's the only way to reach origin-scoped storage, which a
// label rotation otherwise leaves empty.
export function renderSeedPage(
	injections: Injection[],
	next: string | undefined,
): Response {
	const storage = injections
		.filter((injection) => injection.kind === "localStorage")
		.map((injection) => [injection.key, injection.value]);
	// JSON is a valid JS expression; escaping "<" keeps a value like "</script>" from closing
	// the inline script early.
	const payload = JSON.stringify({ storage, next: sanitizeNext(next) }).replace(
		/</g,
		"\\u003c",
	);
	const html = `<!doctype html>
<meta charset="utf-8">
<title>Loading</title>
<script>
(function () {
	var seed = ${payload};
	for (var i = 0; i < seed.storage.length; i++) {
		try {
			localStorage.setItem(seed.storage[i][0], seed.storage[i][1]);
		} catch (e) {}
	}
	location.replace(seed.next);
})();
</script>
`;
	const headers = new Headers({
		"Content-Type": "text/html; charset=utf-8",
		"Cache-Control": "no-store",
	});
	for (const injection of injections) {
		if (injection.kind === "cookie") {
			headers.append("Set-Cookie", setCookieValue(injection));
		}
	}
	return new Response(html, { headers });
}
