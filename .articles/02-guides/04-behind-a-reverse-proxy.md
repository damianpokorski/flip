---
title: "Put FLIP behind a reverse proxy"
description: "Terminate HTTPS in front of FLIP with an external Caddy."
sidebar:
  order: 4
---

## When you need this

Only when you want HTTPS on a real domain. FLIP already has its own proxy, so on a plain home network you do not need another one.

## Example with docker-compose and Caddy

FLIP runs from the published image and an external Caddy terminates HTTPS. Caddy gets the certificate automatically.

```yaml
# docker-compose.yml
services:
  flip:
    image: ghcr.io/damianpokorski/flip:latest
    restart: unless-stopped
    expose:
      - "80"
    volumes:
      - ./flip-data:/data

  caddy:
    image: caddy:2
    restart: unless-stopped
    depends_on:
      - flip
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - ./caddy-config:/config
      - caddy-data:/data

volumes:
  caddy-data:
```

```
# Caddyfile
flip.example.com {
	reverse_proxy flip:80
}
```

`flip` uses `expose`, not `ports`: only Caddy is reachable from outside the compose network. Your external proxy should always talk to FLIP's port 80 and never bypass it.

## Combining with PROXY_DOMAIN

If you also use the [header-stripping proxy](/flip/guides/embedding-stubborn-services/), point the wildcard DNS record at the machine running the external Caddy, not at FLIP. Be aware that with FLIP served over HTTPS, plain-HTTP proxied frames are blocked as mixed content, so the two features only combine for services you can reach over HTTPS.

## Checklist

- `https://flip.example.com` loads the dashboard.
- Changes made in one tab appear in another (this confirms live updates pass through your proxy).
- Nothing else publishes FLIP's port to your network.
