export const DEFAULT_PANELS_YAML = `# FLIP panels — each entry is one embedded dashboard/service.
#
# Fields:
#   id                     stable identifier, don't change once created
#   title                  label shown in the panel switcher
#   url                    the page to embed as an iframe
#   position               display order, lower first
#   hidden                 set true to hide from the panel switcher without deleting it
#   healthCheckUrl         optional URL to ping for up/down status (defaults to \`url\` if omitted)
#   healthCheckIntervalMs  optional per-panel override for how often to check, in ms
#                          (falls back to config.yaml's healthCheckIntervalMs if omitted)
#
# Feel free to hand-edit this file directly — FLIP picks up changes live, and any
# comments you add to entries you don't otherwise touch are preserved.
- id: 00000000-0000-7000-8000-000000000001
  title: Example dashboard
  url: https://example.com
  position: 0
  hidden: false
  healthCheckUrl: null
  healthCheckIntervalMs: null
`;

export const DEFAULT_CONFIG_YAML = `# FLIP global configuration.
#
#   healthCheckIntervalMs  default time between health checks for panels that don't set their own
#   healthCheckTimeoutMs   how long to wait for a health check response before marking a panel down
healthCheckIntervalMs: 30000
healthCheckTimeoutMs: 5000
`;
