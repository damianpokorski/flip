---
title: "What is FLIP"
description: "The problem FLIP solves and how the spine, sidebar and HUD fit together."
sidebar:
  order: 1
---

## The problem

A homelab grows one service at a time: a NAS, Jellyfin, Pi-hole, Home Assistant, a router admin page. Before long you have a dozen browser tabs, a bookmark folder you never open, and a habit of typing IP addresses from memory.

## The idea

FLIP puts all of them behind one window. Each service is embedded as a frame, grouped into workspaces, and kept loaded in the background. Switching between them is instant: nothing reloads, nothing logs you out, and your scroll position stays where you left it.

## Tour of the screen

- **Spine**: the narrow strip on the far left. One tile per workspace; click one to switch.
- **Sidebar**: the services in the current workspace. Click one to bring it to the front.
- **HUD**: press the backtick key (`` ` ``) anywhere to raise a full-screen grid of tiles. Type to filter every service across every workspace, use the arrow keys to move, and press Enter to open one.

![The FLIP dashboard: workspaces on the spine, services in the sidebar, the selected service in the frame.](../../../assets/screenshots/dashboard.png)

![The HUD: a full-screen grid of service tiles with live latency readings.](../../../assets/screenshots/hud.png)

## On a phone

Below 720 pixels wide FLIP switches to a compact layout: a top bar for the current service, a recents strip along the bottom, and a bottom sheet for picking any service. The spine is hidden, and the settings forms keep their desktop layout.

![The mobile layout with a top bar and a recents bar.](../../../assets/screenshots/mobile.png)

![The mobile switcher sheet listing services by workspace.](../../../assets/screenshots/mobile-switcher.png)

## What FLIP is not

- **Not a login wall.** FLIP has no authentication. It is built for a trusted home network, so do not expose it to the internet as-is.
- **Not a monitoring platform.** It measures latency so you can see at a glance what is slow or down, but it keeps no history and sends no alerts.

## Where to go next

[Install FLIP with Docker](/flip/getting-started/install-with-docker/), then [add your first service](/flip/getting-started/first-service/).
