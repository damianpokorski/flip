import { z } from "zod";
import { SITE_SLUG_PATTERN } from "../sites";

export const TILE_HUES = [
	"sapphire",
	"blue",
	"mauve",
	"green",
	"yellow",
	"peach",
	"pink",
	"teal",
	"sky",
	"lavender",
	"flamingo",
	"rosewater",
] as const;
export const TileHueSchema = z.enum(TILE_HUES);
export type TileHue = z.infer<typeof TileHueSchema>;

export const ServiceTargetSchema = z.enum(["frame", "external"]);
export type ServiceTarget = z.infer<typeof ServiceTargetSchema>;

export const ServiceSourceSchema = z.enum(["external", "local"]);
export type ServiceSource = z.infer<typeof ServiceSourceSchema>;

// Fields shared by every representation of a service. `ws` (the owning workspace) is part of
// the base shape but omitted from the on-disk variant below — a service's workspace is implicit
// from where it's nested in config.yaml, not a stored foreign key. Split out from `ServiceSchema`
// (rather than defined inline there) so `.omit()` is available on it — zod's `ZodEffects` (the
// wrapper `.superRefine()` produces) doesn't expose `.omit()` itself.
export const ServiceBaseSchema = z.object({
	id: z.string(),
	name: z.string().min(1),
	mark: z.string().regex(/^[A-Z0-9]{2}$/, "exactly 2 uppercase letters/digits"),
	// Deliberately no `.default(...)` here, unlike the rest of this schema's optional fields —
	// there's no single static default to fall back to. Omitted (hand-edited files) or explicit
	// `null` (what the app writes when a user picks "auto" in the UI) both mean the same thing:
	// let ServicesService derive an even, name-hash-based hue at read time (see
	// `@flip/store/hue`'s `hueFor`) instead of storing one.
	hue: TileHueSchema.nullable().optional(),
	host: z.string().min(1),
	// For source: "external" this is the full URL to embed/open. For source: "local" it's
	// derived server-side (ServicesService) as "/api/sites/<localSlug>/" — a same-origin
	// relative path — rather than user-supplied, so it's validated loosely here and more
	// strictly in the superRefine below, split by source.
	url: z.string().min(1),
	// Optional separate liveness-check target for services whose main page is
	// too heavy/slow to hit directly — falls back to `url` when unset.
	healthCheckUrl: z.string().url().nullable().default(null),
	// "external" points `url` at a remote service; "local" serves a folder mounted under
	// DATA_DIR/sites/<localSlug> instead — see localSlug.
	source: ServiceSourceSchema.default("external"),
	// Required, slug-shaped, when source is "local" — matches a subdirectory name under
	// DATA_DIR/sites/. Unset for "external" services.
	localSlug: z.string().regex(SITE_SLUG_PATTERN).nullable().default(null),
	ws: z.string(),
	pin: z
		.string()
		.regex(/^[0-9]$/)
		.nullable()
		.default(null),
	codes: z
		.string()
		.regex(
			/^\d{3}(\s*,\s*\d{3})*$/,
			'comma-separated HTTP status codes, e.g. "200, 401"',
		)
		.default("200"),
	every: z
		.string()
		.regex(/^\d+(ms|s|m|h)$/, 'an amount plus a unit, e.g. "30s"')
		.default("30s"),
	target: ServiceTargetSchema.default("frame"),
	// Routes this service's iframe through FLIP's embedded Caddy reverse proxy instead of
	// hitting `url` directly — strips X-Frame-Options and rewrites CSP's frame-ancestors on
	// the response, letting a service that would otherwise refuse to be iframed still embed.
	// Only takes effect when the server has PROXY_DOMAIN configured; a no-op otherwise.
	proxyHeaders: z.boolean().default(false),
	hidden: z.boolean().default(false),
	// When true, this service's iframe is never preloaded in the background — it gets no
	// `src` until the user actually opens it, bypassing the maxParallelFrameLoads stagger.
	lazyLoad: z.boolean().default(false),
});

function refineServiceSourceUrl(
	service: Pick<
		z.infer<typeof ServiceBaseSchema>,
		"source" | "url" | "localSlug"
	>,
	ctx: z.RefinementCtx,
): void {
	if (
		service.source === "external" &&
		!z.string().url().safeParse(service.url).success
	) {
		ctx.addIssue({
			code: "custom",
			message: "must be a valid absolute URL",
			path: ["url"],
		});
	}
	if (service.source === "local" && !service.localSlug) {
		ctx.addIssue({
			code: "custom",
			message: 'localSlug is required when source is "local"',
			path: ["localSlug"],
		});
	}
}

// The domain/wire shape — used throughout apps/server, with `ws` present. `position` doesn't
// exist here (or on disk): a service's order is implicit in where it sits in its workspace's
// `services` array in config.yaml.
export const ServiceSchema = ServiceBaseSchema.superRefine(
	refineServiceSourceUrl,
);
export type Service = z.infer<typeof ServiceSchema>;

// The on-disk shape nested under a workspace in config.yaml — everything but `ws`, since a
// service's workspace is implicit from its parent in the nested structure.
export const OnDiskServiceSchema = ServiceBaseSchema.omit({
	ws: true,
}).superRefine(refineServiceSourceUrl);
export type OnDiskService = z.infer<typeof OnDiskServiceSchema>;

export const OnDiskServicesSchema = z.array(OnDiskServiceSchema).default([]);

// The legacy flat services.yaml shape (`ws` foreign key + a global `position`) — kept only so
// migrate-legacy-config.ts can parse a pre-migration file; nothing else should reference this.
export const LegacyServiceSchema = ServiceBaseSchema.extend({
	position: z.number().int(),
}).superRefine(refineServiceSourceUrl);
export type LegacyService = z.infer<typeof LegacyServiceSchema>;

export const LegacyServicesFileSchema = z
	.array(LegacyServiceSchema)
	.default([]);
export type LegacyServicesFile = z.infer<typeof LegacyServicesFileSchema>;
