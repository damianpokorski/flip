---
title: "Upgrading"
description: "Move to a newer FLIP image safely and keep your data."
sidebar:
  order: 4
---

## Latest or pinned

`latest` always points at the newest release. If you prefer upgrades to be deliberate, pin a version instead, for example `ghcr.io/damianpokorski/flip:1.4.0`.

## Pull and recreate

Your data lives in the `/data` volume, so replacing the container is safe:

```bash
docker pull ghcr.io/damianpokorski/flip:latest
docker rm -f flip
docker run -d --name flip -p 80:80 -v flip-data:/data ghcr.io/damianpokorski/flip:latest
```

Reuse whatever flags you started with originally (environment variables, extra mounts).

## Automatic config migration

Older installs stored `services.yaml` and `workspaces.yaml` separately. On the next boot FLIP merges them into a single `config.yaml`, keeps your order and comments, and removes the old files. You do not need to do anything.

## Release notes

Changes are listed on the [GitHub Releases page](https://github.com/damianpokorski/flip/releases). There is no changelog file in the repository.
