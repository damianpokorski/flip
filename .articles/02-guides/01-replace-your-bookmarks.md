---
title: "Replace your browser tabs"
description: "Use case: one window for every self-hosted tool, grouped by what you are doing."
sidebar:
  order: 1
---

## The scenario

You have tabs open for the NAS, Jellyfin, Pi-hole and the router. Half of them have logged you out, and you cannot remember which tab is which. FLIP replaces that pile with a single page.

## Plan your workspaces

Group services by what you are doing, not by which tool they are. A layout that works well:

- **Media**: Jellyfin, the download client, request app.
- **Network**: router, Pi-hole, switch admin.
- **Home**: Home Assistant, cameras.
- **Storage**: NAS, backup dashboard.

Create them under **Settings, Workspaces**.

## Add the services you actually use

Start with the three to five you open every day. You can always add more; a short list is faster to scan.

## Move around fast

- Click a workspace on the spine, then a service in the sidebar.
- Press `` ` `` to open the HUD and type a few letters of a name.
- Give your favourites a **pin** (a single digit, in the service's settings) and jump straight to one by holding `` ` `` and pressing its digit.

![The HUD filtered by the query 'ho', showing only the matching services.](../../../assets/screenshots/hud-filtered.png)

## Keep it tidy

Mark rarely used services as **hidden** instead of deleting them. They stay in your config but disappear from the switcher and HUD. See [Organise workspaces](/flip/guides/organising-workspaces/).
