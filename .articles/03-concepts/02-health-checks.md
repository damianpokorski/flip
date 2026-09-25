---
title: "Health checks"
description: "How FLIP measures service health as latency, not just up or down."
sidebar:
  order: 2
---

## What is checked

The FLIP server requests each service's `url` on a timer. If you set `healthCheckUrl`, it requests that instead, which is handy when the main page is heavy or needs a login.

## Latency buckets

The result is a latency reading, not just up or down:

| Bucket | Response time |
| --- | --- |
| fast | under 60 ms |
| ok | under 250 ms |
| slow | 250 ms or more |
| down | no acceptable response |

![A sidebar with four services showing a fast, an ok, a slow and a down reading.](../../../assets/screenshots/health-states.png)

The same thresholds are used everywhere in the app, including the add-service probe.

## OK codes

`codes` is a comma-separated list of HTTP status codes that count as healthy, for example `"200, 401"`. Any other status counts as down. The default is `"200"`.

## Interval and timeout

`every` sets how often a service is checked (for example `30s` or `5m`; default `30s`). The global `healthCheckTimeoutMs` (default `5000`) is how long FLIP waits before marking a service down.

## Status is not saved

Health status lives in memory only. It resets when FLIP restarts and fills in again on the next check. This keeps `config.yaml` stable and easy to diff.
