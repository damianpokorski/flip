---
title: "Troubleshooting"
description: "Fixes for the problems people hit most often."
sidebar:
  order: 4
---

## A service shows a blank frame

The service is probably refusing to be framed. Either set its target to open in a new tab, or route it through the [header-stripping proxy](/flip/guides/embedding-stubborn-services/).

## A proxied service shows 403 when opened directly

Expected. Proxied addresses only work when loaded inside a frame, never as a top-level page.

## A proxied frame is blocked when FLIP uses HTTPS

Mixed content: browsers refuse to show a plain-HTTP frame inside an HTTPS page. The proxy is plain HTTP only, so use it on an HTTP-only setup, or keep that service as an open-in-new-tab link.

## Caddy fails to bind its admin port

The logs show `listen tcp 127.0.0.1:2019: bind: address already in use`. Set `CADDY_ADMIN_PORT` to a free port.

## A service is always down

- Check its OK codes. An app that answers `401` or `302` when logged out needs those in `codes`.
- Try a `healthCheckUrl` that returns a plain `200`.
- Remember the check runs from inside the FLIP container, so the hostname must resolve there, not just on your computer.

## Config edits are not showing

- Confirm you edited the file FLIP is actually reading: compare with **Settings, Config**.
- Check the YAML is valid (indentation, quotes around values like `"200, 401"`).
- With a bind mount, make sure the path on the host matches the one you mounted.
