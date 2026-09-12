export const DEFAULT_SERVICES_YAML = `# FLIP services — each entry is one embedded dashboard/service.
#
# Fields:
#   id                stable identifier, don't change once created
#   name              display name, exactly as the upstream project writes it (e.g. "Jellyfin")
#   mark              2-letter tile abbreviation shown instead of an icon, e.g. "NA"
#   hue               tile colour: sapphire, blue, mauve, green, yellow, peach, pink, teal, sky, lavender, flamingo, rosewater
#   host              short hostname shown in the UI, e.g. "nas.home.lan"
#   url               full URL to embed/open (source: external) — ignored/overwritten by FLIP
#                     for source: local, where it's derived as "/api/sites/<localSlug>/"
#   healthCheckUrl    optional separate URL to check liveness against instead of \`url\` (null = use \`url\`)
#   source            "external" (default) for a remote url, or "local" to serve a folder
#                     mounted under DATA_DIR/sites/<localSlug>/index.html instead
#   localSlug         required when source is "local" — the DATA_DIR/sites/ subdirectory name
#   ws                the single workspace this service belongs to — see workspaces.yaml
#   pin               optional single-digit HUD shortcut (0-9, shown as \`N) — at most 10 services may be pinned
#   codes             comma-separated "OK" HTTP status codes, e.g. "200, 401" — anything else counts as down
#   every             how often to check, e.g. "30s", "5m"
#   target            "frame" to embed in an iframe, "external" to open in a new tab
#   proxyHeaders      true to route through FLIP's built-in header-stripping proxy (needs
#                     PROXY_DOMAIN set) — for services that refuse to be iframed otherwise
#   hidden            set true to hide from the switcher/HUD without deleting
#   lazyLoad          true to skip background preloading — only loads once opened
#   position          display order, lower first
#
# Feel free to hand-edit this file directly — FLIP picks up changes live, and any
# comments you add to entries you don't otherwise touch are preserved.
- id: 00000000-0000-7000-8000-000000000001
  name: Example service
  mark: EX
  hue: sapphire
  host: example.com
  url: https://example.com
  healthCheckUrl: null
  source: external
  localSlug: null
  ws: default
  pin: null
  codes: "200"
  every: 30s
  target: frame
  proxyHeaders: false
  hidden: false
  lazyLoad: false
  position: 0
`;

export const DEFAULT_WORKSPACES_YAML = `# FLIP workspaces — groups of services shown together in the sidebar/HUD/spine.
#
# Fields:
#   id        stable slug identifier, don't change once created (renaming \`name\` later won't change this)
#   name      display name shown in the sidebar header, e.g. "MEDIA"
#   label     2-char abbreviation shown on the spine pill, e.g. "MD"
#   position  display order on the spine, lower first
- id: default
  name: DEFAULT
  label: DF
  position: 0
`;

export const DEFAULT_CONFIG_YAML = `# FLIP global configuration.
#
#   healthCheckTimeoutMs   how long to wait for a health check before marking a service down
#   maxParallelFrameLoads  how many service iframes may load in the background at once — the
#                          rest queue and load as slots free up, instead of all firing at once
#
# There is no per-install default check interval — each service sets its own \`every\`
# in services.yaml. Hand-edit these values directly; there is no Settings UI for them.
healthCheckTimeoutMs: 5000
maxParallelFrameLoads: 3
`;
