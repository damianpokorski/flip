---
title: "The embedded proxy"
description: "What the bundled Caddy does, and what its hardening does and does not protect."
sidebar:
  order: 3
---

## One entrypoint

FLIP bundles a Caddy proxy that is always running. It is the only thing listening on the published port: it forwards the web UI and API to the FLIP server, which is internal to the container.

## Per-service subdomains

If you set `PROXY_DOMAIN`, a service with `proxyHeaders: true` is served from `<random-label>.<PROXY_DOMAIN>`. Caddy forwards those requests to the real service and removes the `X-Frame-Options` and `Content-Security-Policy` headers that would block framing.

## Hardening

Each measure below narrows what the subdomains expose:

- The label is random and regenerated on every boot, not derived from the service id.
- The upstream's framing headers are replaced with a `frame-ancestors` limited to the host you reached FLIP on, so other websites cannot embed your services.
- Opening a proxied address directly as a page returns 403; only frame loads succeed.
- Proxied targets must be `http` or `https` URLs.

## What it is not

None of this is access control. FLIP has no login, and a determined client on your LAN can forge the headers these checks rely on. They stop other websites and accidental exposure, not a hostile device on your network. Run FLIP on a network you trust.
