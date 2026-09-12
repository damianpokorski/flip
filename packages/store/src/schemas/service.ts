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

export const ServiceSchema = z
  .object({
    id: z.string(),
    name: z.string().min(1),
    mark: z.string().regex(/^[A-Z0-9]{2}$/, "exactly 2 uppercase letters/digits"),
    hue: TileHueSchema,
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
      .regex(/^\d{3}(\s*,\s*\d{3})*$/, 'comma-separated HTTP status codes, e.g. "200, 401"')
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
    position: z.number().int(),
  })
  .superRefine((service, ctx) => {
    if (service.source === "external" && !z.string().url().safeParse(service.url).success) {
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
  });
export type Service = z.infer<typeof ServiceSchema>;

export const ServicesFileSchema = z.array(ServiceSchema).default([]);
export type ServicesFile = z.infer<typeof ServicesFileSchema>;
