---
title: "Choose a theme"
description: "Switch FLIP's colour palette for every browser at once."
sidebar:
  order: 7
---

## Switching

Go to **Settings, Appearance** and pick a palette. It applies instantly and is saved as `theme` in `config.yaml`, so every browser pointed at this FLIP sees the same one.

## The palettes

| Palette | Variant |
| --- | --- |
| Catppuccin Mocha (default) | dark |
| Rosé Pine | dark |
| Rosé Pine Dawn | light |
| Tokyo Night | dark |
| Tokyo Night Light | light |
| Kanagawa | dark |
| Kanagawa Lotus | light |
| Nord | dark |
| Dracula | dark |

Nord and Dracula have no official light version, so they are dark only.

To set one by hand, use its id in `config.yaml`: `catppuccin-mocha`, `rose-pine`, `rose-pine-dawn`, `tokyo-night`, `tokyo-night-light`, `kanagawa`, `kanagawa-lotus`, `nord`, or `dracula`.

## Interface scale

`uiScale` in `config.yaml` (from `0.5` to `2`, default `1`) scales FLIP's own interface: spine, sidebar, HUD and settings. It never changes the content of the services you embed.
