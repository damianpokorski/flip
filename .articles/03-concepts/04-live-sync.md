---
title: "Live sync"
description: "How changes reach every open tab without a refresh."
sidebar:
  order: 4
---

## Server-sent events

Each open FLIP tab keeps a lightweight one-way connection to the server (server-sent events). When something changes, the server pushes a message and the tab updates itself. No polling, no refresh button.

## What triggers an update

- A change made in the Settings UI.
- A change made in another browser tab or on another device.
- A hand-edit of `config.yaml`, saved while FLIP is running.

## Reconnects

If the connection drops (a restart, a flaky Wi-Fi link), the tab reconnects and refetches everything. That includes the random proxy addresses, which change on every boot.

## Concurrent edits

Last write wins. There is no version check, so if two people edit the same thing at the same moment, the later save overwrites the earlier one. That is a reasonable trade for a tool used by one person or household.
