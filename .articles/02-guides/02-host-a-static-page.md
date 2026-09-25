---
title: "Host a personal static page"
description: "Use case: serve a folder of HTML, CSS and JS as a tile, no separate web server."
sidebar:
  order: 2
---

## The scenario

Not everything on your dashboard is a running service. Maybe it is a hand-written status page, a small HTML tool, or the export of a static site. FLIP can serve a folder of files itself, so you do not need a separate web server.

## Prepare the folder

The folder needs an `index.html` at its root. Links to other files in the same folder (CSS, JavaScript, images) work as usual with relative paths.

## Mount it

Mount the folder into the container under `/data/sites/<slug>`. The slug is the folder name you will pick later.

```bash
docker run -d --name flip -p 80:80 \
  -v flip-data:/data \
  -v ./my-page:/data/sites/my-page \
  ghcr.io/damianpokorski/flip:latest
```

With docker-compose:

```yaml
services:
  flip:
    image: ghcr.io/damianpokorski/flip:latest
    ports:
      - "80:80"
    volumes:
      - ./flip-data:/data
      - ./my-page:/data/sites/my-page
```

## Add it as a service

1. Go to **Settings, Services, Add service**.
2. Turn on **Serve a local folder instead of a URL**.
3. Pick `my-page` from the list.

![The service form with the local folder toggle and the site picker.](../../../assets/screenshots/service-edit-local.png)

## How it behaves

It is a normal tile: it shows up in the HUD, stays loaded in the background, and has a health check. The check reports it as down if the folder or its `index.html` goes missing.

## Why there is no upload form

This is deliberate. Files are dropped in directly, the same way `config.yaml` is meant to be edited by hand.
