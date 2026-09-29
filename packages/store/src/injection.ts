// Dependency-free leaf for per-service injections (the `inject` field in schemas/service.ts) —
// imported by the web app via `@flip/store/injection`, so it must never import anything that
// touches node:fs (schemas/service.ts itself does, through ../sites). The type-only import below
// is erased at compile time.
import type { Injection } from "./schemas/service";

// Where an injected value goes, for a proxied service only:
// requestHeader/responseHeader are Caddy header_up/header_down on every proxied request;
// query is merged into the iframe's starting URL only (first navigation, not every request);
// cookie and localStorage are written by the /__flip/seed page on the proxied origin itself,
// on every frame load — the only way to reach origin-scoped storage that a label rotation wipes.
export const INJECTION_KINDS = [
	"requestHeader",
	"responseHeader",
	"cookie",
	"query",
	"localStorage",
] as const;
export type InjectionKind = (typeof INJECTION_KINDS)[number];

// Kinds that need the seed page (a real document on the proxied origin), rather than a Caddy
// directive or a URL tweak — shared so the Caddyfile builder and the iframe src agree on when
// the /__flip/seed route exists.
export const SEED_INJECTION_KINDS: readonly InjectionKind[] = [
	"cookie",
	"localStorage",
];

export interface InjectPreset {
	id: string;
	label: string;
	rows: Injection[];
}

// Built-in shortcuts for the service form's injection list — picking one just appends its rows,
// so nothing preset-specific exists anywhere past the form.
export const INJECT_PRESETS: readonly InjectPreset[] = [
	{
		id: "ha-hide-sidebar",
		label: "Home Assistant: hide sidebar",
		// Home Assistant stores its frontend prefs JSON-encoded in localStorage, so the value
		// carries its own quotes.
		rows: [
			{ kind: "localStorage", key: "dockedSidebar", value: '"always_hidden"' },
		],
	},
];
