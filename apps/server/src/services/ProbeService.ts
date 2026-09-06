const PROBE_TIMEOUT_MS = 8_000;
const TITLE_PATTERN = /<title[^>]*>([^<]*)<\/title>/i;

export interface ProbeResult {
	ms: number | null;
	statusCode: number | null;
	title: string | null;
	embeddable: boolean;
	suggestedTarget: "frame" | "external";
}

// Determines whether a response's headers refuse to be framed. Absence of both headers
// means the response doesn't object to iframing (the common case for self-hosted tools).
function isEmbeddable(headers: Headers): boolean {
	const frameOptions = headers.get("x-frame-options")?.toLowerCase();
	if (frameOptions === "deny" || frameOptions === "sameorigin") return false;
	const csp = headers.get("content-security-policy");
	if (csp && /frame-ancestors\s+'none'/i.test(csp)) return false;
	return true;
}

// A stateless probe of a candidate service URL — no repository, no persisted state. Still a
// proper class, instantiated the same way as everything else in this layer, for consistency
// with the Controller→Service→Repository convention even though it has no repository.
export class ProbeService {
	async probe(url: string): Promise<ProbeResult> {
		const startedAt = performance.now();
		let response: Response;
		try {
			response = await fetch(url, {
				signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
			});
		} catch {
			return {
				ms: null,
				statusCode: null,
				title: null,
				embeddable: false,
				suggestedTarget: "external",
			};
		}
		const ms = Math.round(performance.now() - startedAt);
		const embeddable = isEmbeddable(response.headers);

		let title: string | null = null;
		const contentType = response.headers.get("content-type") ?? "";
		if (contentType.includes("text/html")) {
			const text = await response.text();
			title = TITLE_PATTERN.exec(text)?.[1]?.trim() || null;
		}

		return {
			ms,
			statusCode: response.status,
			title,
			embeddable,
			suggestedTarget: embeddable ? "frame" : "external",
		};
	}
}
