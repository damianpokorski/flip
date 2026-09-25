---
title: "config.yaml reference"
description: "Every setting and service field in FLIP's config file."
sidebar:
  order: 1
---

All settings live in `config.yaml`. The generated file has a comment for every field; this page mirrors it.

The **Settings, Config** tab shows this file live:

![Settings, Config: a read-only, colour-coded view of config.yaml.](../../../assets/screenshots/settings-config.png)

## Global settings

| Field | Default | Description |
| --- | --- | --- |
| `healthCheckTimeoutMs` | `5000` | How long to wait for a health check before marking a service down. |
| `maxParallelFrameLoads` | `3` | How many service frames may load in the background at once. |
| `uiScale` | `1` | Scales FLIP's own interface, `0.5` to `2`. Never affects embedded services. |
| `theme` | `catppuccin-mocha` | Colour palette. See [Choose a theme](/flip/guides/themes/). |

## Workspaces

| Field | Description |
| --- | --- |
| `id` | Stable slug. Do not change it once created. |
| `name` | Display name, for example `MEDIA`. |
| `label` | Two-character label on the spine. |
| `services` | The services in this workspace, in display order. |

Workspaces appear on the spine in the order listed.

## Services

| Field | Default | Description |
| --- | --- | --- |
| `id` | generated | Stable identifier. Do not change it. |
| `name` | | Display name. |
| `mark` | | Two-letter tile label. |
| `hue` | auto | Tile colour: `sapphire`, `blue`, `mauve`, `green`, `yellow`, `peach`, `pink`, `teal`, `sky`, `lavender`, `flamingo`, `rosewater`. Omit or set `null` to auto-pick. |
| `host` | | Short hostname shown in the UI. |
| `url` | | Address to embed or open. Ignored for `source: local`. |
| `healthCheckUrl` | `null` | Check this instead of `url`. |
| `source` | `external` | `external` for a URL, `local` for a folder in `sites/`. |
| `localSlug` | `null` | Folder name under `sites/`. Required when `source` is `local`. |
| `pin` | `null` | Single digit `0` to `9` for the HUD shortcut. At most ten services can be pinned. |
| `codes` | `"200"` | Comma-separated status codes that count as healthy. |
| `every` | `30s` | How often to check, for example `30s` or `5m`. |
| `target` | `frame` | `frame` to embed, `external` to open in a new tab. |
| `proxyHeaders` | `false` | Route through the header-stripping proxy. Needs `PROXY_DOMAIN`. |
| `hidden` | `false` | Hide from the switcher and HUD without deleting. |
| `lazyLoad` | `false` | Skip background loading; load on first open. |

## Full example

```yaml
healthCheckTimeoutMs: 5000
maxParallelFrameLoads: 3
uiScale: 1
theme: catppuccin-mocha
workspaces:
  - id: media
    name: MEDIA
    label: MD
    services:
      - id: 00000000-0000-7000-8000-000000000002
        name: Jellyfin
        mark: JF
        host: jellyfin.home.lan
        url: http://jellyfin.home.lan:8096
        pin: "1"
        codes: "200"
        every: 30s
        target: frame
  - id: network
    name: NETWORK
    label: NW
    services:
      - id: 00000000-0000-7000-8000-000000000003
        name: Pi-hole
        mark: PH
        host: pihole.home.lan
        url: http://pihole.home.lan/admin
        codes: "200, 302"
        every: 1m
        proxyHeaders: true
```
