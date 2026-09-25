---
title: "Add your first service"
description: "Add a service, let FLIP probe it, and put it in a workspace."
sidebar:
  order: 3
---

## Open the add form

Go to **Settings, Services, Add service**, or open `/settings/services/add` directly.

## Paste a URL

FLIP probes the address from the server and tells you three things: whether it is reachable, what the page is called, and whether the service allows itself to be embedded. It pre-fills a suggested name from the page title.

## Name, mark and colour

- **Name**: shown in the sidebar and HUD.
- **Mark**: a two-letter tile label. FLIP does not fetch favicons.
- **Colour**: the tile hue. Leave it unset and FLIP picks one from the name.

## Pick a workspace

Each service lives in exactly one workspace. Choose one now; you can drag it to another later.

When it is saved, the service appears in the list under **Settings, Services** with its live latency:

![The Settings, Services list showing each service with its workspace and latency.](../../../assets/screenshots/services.png)

## Optional health settings

By default FLIP checks the service's own URL every 30 seconds and treats HTTP 200 as healthy. You can set a separate health check URL, a list of OK status codes (for example `200, 401` for an app that answers 401 when logged out), and a different interval. See [Health checks](/flip/concepts/health-checks/).

## If the service will not embed

Some apps forbid being shown in a frame. When the probe detects this, FLIP suggests one of two options:

- **Open in a new tab**: the tile opens the service in a separate browser tab instead of a frame.
- **Route through the header-stripping proxy**: keeps it embedded. Needs one-time setup, described in [Embed services that block iframing](/flip/guides/embedding-stubborn-services/).
