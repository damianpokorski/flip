import type { Dirent } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { dataDir } from "./fs-yaml";

// A slug must be safe to use as both a single path segment and a DNS-label-ish token — no
// dots, slashes, or leading dashes, so it can never be used to escape sitesDir() via `..`.
export const SITE_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,62}$/;

export function sitesDir(): string {
	return path.join(dataDir(), "sites");
}

// Lists the operator-mounted site folders under DATA_DIR/sites — each one is a candidate for
// a service's `localSlug`. Doesn't validate an index.html exists; that's a health-check-time
// concern, not a listing-time one, so a folder mounted without content yet still shows up.
export async function listSiteSlugs(): Promise<string[]> {
	let entries: Dirent[];
	try {
		entries = await readdir(sitesDir(), { withFileTypes: true });
	} catch {
		// sitesDir() not created yet (shouldn't happen once initDataFiles() has run, but a
		// hand-managed volume mount could remove it) — treat as "no sites available" rather
		// than throwing.
		return [];
	}
	return entries
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name);
}

// Resolves `subpath` against a site's folder, defends against path traversal by requiring the
// normalized result to stay within `sitesDir()/slug`, and defaults to index.html for the
// folder root. Returns null (never throws) when the slug is malformed or the path escapes.
export function resolveSiteFile(slug: string, subpath: string): string | null {
	if (!SITE_SLUG_PATTERN.test(slug)) return null;
	const base = path.join(sitesDir(), slug);
	const target = path.normalize(path.join(base, subpath || "index.html"));
	if (target !== base && !target.startsWith(`${base}${path.sep}`)) return null;
	return target;
}
