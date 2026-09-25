---
title: "Edit config.yaml by hand"
description: "Change FLIP's config in your editor and watch it update live."
sidebar:
  order: 6
---

## Where the file lives

Everything is stored in one file, `config.yaml`, in FLIP's data directory. With the named volume that is inside the Docker volume; with a bind mount such as `./flip-data:/data` it is `./flip-data/config.yaml`.

## Live reload

Edit and save while FLIP is running. Changes are picked up immediately and pushed to every open browser tab, so there is no restart and no refresh.

## Layout

Services are nested under the workspace they belong to. A service's workspace and its position are simply where it sits in the file:

```yaml
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
```

Each field is documented with a comment in the generated file, and in the [config reference](/flip/reference/config-yaml/).

## Comments are kept

Add your own comments freely. When you later change something through the Settings UI, comments on entries you did not touch are preserved.

## Read-only view

**Settings, Config** shows the real file FLIP is reading, colour-coded, with a Copy button. It is a viewer only; edit through the other Settings tabs or directly in the file.

## Before big edits

Keep a copy of the file first. If something looks wrong afterwards, compare against **Settings, Config** to see what FLIP actually loaded.
