---
title: "Always-mounted iframes"
description: "Why switching services is instant and what it costs."
sidebar:
  order: 1
---

## How switching works

When FLIP loads, every embeddable service gets its own frame, in every workspace. Selecting a service does not load anything; it just shows that frame and hides the others.

## What you get

- Switching is instant.
- Services are not reloaded, so you are not logged out, and half-typed forms and scroll positions survive.
- Switching workspaces works the same way: nothing is created or destroyed.

## What it costs

Every frame is a real page running in your browser, so many services use more memory and some background network traffic. Two levers help:

- `lazyLoad: true` on a service defers loading until you first open it.
- `maxParallelFrameLoads` staggers the initial load so dozens of frames do not all start at once.

Services set to open in a new tab are never framed, so they cost nothing.
