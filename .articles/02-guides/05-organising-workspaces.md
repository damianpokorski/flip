---
title: "Organise workspaces"
description: "Reorder, move and hide services using the workspace board."
sidebar:
  order: 5
---

## The board

**Settings, Workspaces** shows one column per workspace, with a card for each service.

## Drag and drop

- Drag a card within a column to reorder services.
- Drag a card to another column to move the service to that workspace.
- Drag a column header to reorder workspaces. The order here is the order on the spine.

![The workspace board with a service card mid-drag between two columns.](../../../assets/screenshots/workspaces-drag.png)

While you drag, the item is mauve rather than blue, so it can never be mistaken for a selection.

## Hide without deleting

Mark a service **hidden** to keep its configuration but remove it from the switcher and HUD. Useful for things you only need occasionally.

## Deleting a workspace

The services in a deleted workspace move to the next remaining workspace, so nothing is lost. You cannot delete the last workspace.

## Lazy loading and frame limits

By default every embeddable service loads in the background so switching is instant. Two settings tame this if you have many services:

- `lazyLoad: true` on a service skips background loading; it loads the first time you open it.
- `maxParallelFrameLoads` (global, default `3`) limits how many frames load at once; the rest queue.
