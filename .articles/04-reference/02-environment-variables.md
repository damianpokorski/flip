---
title: "Environment variables"
description: "Every environment variable the FLIP container understands."
sidebar:
  order: 2
---

Set these on the container, for example with `-e NAME=value` on `docker run`.

## Variables

| Variable | Default | Description |
| --- | --- | --- |
| `PROXY_DOMAIN` | unset | Base domain for the per-service header-stripping proxy, for example `flip.home.lan`. Needs a wildcard DNS record. Unset disables only the per-service subdomains. See [Embed services that block iframing](/flip/guides/embedding-stubborn-services/). |
| `CADDY_ADMIN_PORT` | `2019` | Port for Caddy's admin API, bound to loopback only. Change it if something else already uses `2019`. |
| `CORS_ORIGIN` | unset | Allowed cross-origin URL. Unset means no CORS headers in production, which is what you want because the UI is served from the same origin. |
| `DATA_DIR` | `/data` in the image | Where `config.yaml` and `sites/` live. Rarely needs changing; mount a volume at `/data` instead. |

## Internal

`PORT` (FLIP's own listen port, default `3000`) is internal to the container and is never meant to be published. Everything is reached through the proxy on port 80.

## Example

```yaml
services:
  flip:
    image: ghcr.io/damianpokorski/flip:latest
    ports:
      - "80:80"
    environment:
      PROXY_DOMAIN: flip.home.lan
    volumes:
      - ./flip-data:/data
```
