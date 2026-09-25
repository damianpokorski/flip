---
title: "Install with Docker"
description: "Run FLIP with a single docker command and understand what happens on first boot."
sidebar:
  order: 2
---

## Before you start

You need [Docker](https://www.docker.com). You will also want a way to create local DNS entries (your router's DNS settings, a resolver such as Pi-hole, or your computer's hosts file). FLIP embeds services by their LAN hostname, and it is much nicer to type `jellyfin.home.lan` than an IP address and port.

## Run the container

```bash
docker run -d --name flip -p 80:80 -v flip-data:/data ghcr.io/damianpokorski/flip:latest
```

- `-p 80:80` publishes FLIP's single entry point on port 80 of your host.
- `-v flip-data:/data` keeps your config in a Docker volume so it survives upgrades and restarts.
- `ghcr.io/damianpokorski/flip:latest` is the published image. No build step is needed.

## First boot

On first start FLIP creates `/data/config.yaml` with one example service in one workspace, plus an empty `/data/sites/` folder for [static pages you host yourself](/flip/guides/host-a-static-page/). Open `http://localhost` (or the host's address from another device) and you are in.

Everything, including the web UI and the API, is served through that one port. There is nothing else to publish.

## Bind mount instead of a named volume

If you would rather edit the config in your own editor, mount a folder instead:

```bash
docker run -d --name flip -p 80:80 -v ./flip-data:/data ghcr.io/damianpokorski/flip:latest
```

`config.yaml` will then appear in `./flip-data/`. See [Edit config.yaml by hand](/flip/guides/editing-config-by-hand/).

## If Caddy will not start

FLIP runs a bundled Caddy proxy. If the container logs show `listen tcp 127.0.0.1:2019: bind: address already in use`, something else on the same network namespace is using Caddy's admin port. Set `CADDY_ADMIN_PORT` to any free port:

```bash
docker run -d --name flip -p 80:80 -e CADDY_ADMIN_PORT=2020 -v flip-data:/data ghcr.io/damianpokorski/flip:latest
```
