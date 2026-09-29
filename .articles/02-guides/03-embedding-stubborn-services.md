---
title: "Embed services that block iframing"
description: "Use the built-in header-stripping proxy for apps that refuse to be framed."
sidebar:
  order: 3
---

## Why some services will not embed

Some apps send the HTTP headers `X-Frame-Options` or `Content-Security-Policy: frame-ancestors`, which tell the browser to refuse to show them inside a frame. FLIP can work around this with its bundled proxy, which strips those headers for the services you choose.

## One-time setup

1. Set `PROXY_DOMAIN` on the FLIP container to a domain you control on your LAN, for example `flip.home.lan`:

   ```bash
   docker run -d --name flip -p 80:80 -e PROXY_DOMAIN=flip.home.lan -v flip-data:/data ghcr.io/damianpokorski/flip:latest
   ```

2. Create a **wildcard DNS record** `*.flip.home.lan` that points at the machine running FLIP. Do this in your router's DNS settings or in a resolver such as Pi-hole or dnsmasq. A hosts file will not do, because hosts files cannot express wildcards.

Keep the container port published as `80`: proxied services are reached on that same port.

## Turn it on per service

Open the service under **Settings, Services** and enable **Route through FLIP's header-stripping proxy**. The add-service probe suggests this automatically when it detects a service that refuses to embed.

![The service edit form with the header-stripping proxy toggle, shown once PROXY_DOMAIN is set.](../../../assets/screenshots/service-edit-proxy.png)

## What you will notice

- The frame loads from an address like `http://<random-label>.flip.home.lan/` instead of the real URL.
- The label changes every time FLIP restarts. Open tabs notice the reconnect and swap their frames automatically, but bookmarks to a proxied address will stop working.
- Opening a proxied address directly in the browser as a page returns 403. It only works inside a frame.

## Inject headers, cookies, and storage

A proxied service can also have values pushed into it, from the **Inject** list that appears under the proxy toggle. Each row has a kind, a key, and a value:

| Kind | What it does |
|---|---|
| request header | Sent to the service on every proxied request. |
| response header | Added to every response the service sends back. |
| cookie | Set on the proxied address every time the frame loads. Append attributes to the value, for example `abc; HttpOnly`. `Path=/` is added unless you give one. |
| query param | Added to the frame's starting URL only, not to the app's later requests. |
| localStorage | Written to the proxied address's localStorage every time the frame loads, overwriting whatever the app stored there. |

Cookies and localStorage belong to an address, so a new proxy label normally starts empty. FLIP rewrites them on every frame load, so they survive a label change without you touching the app. For example, Home Assistant only remembers a hidden sidebar in localStorage. The **Home Assistant: hide sidebar** preset adds that row for you:

```yaml
inject:
  - { kind: localStorage, key: dockedSidebar, value: '"always_hidden"' }
```

Values are stored in plain text in `config.yaml`, and anyone who can reach FLIP can read them. Header values are passed through Caddy's placeholders, so `{env.NAME}` expands to an environment variable on the FLIP container. The frame first loads a short page at `/__flip/seed` on the proxied address to write cookies and localStorage, so a service's own route at that path would be hidden.

## Limits

- **Plain HTTP only.** If you serve FLIP itself over HTTPS, browsers will block a plain-HTTP frame as mixed content.
- **Not access control.** FLIP has no login, and the hardening is a speed bump for a trusted network, not a security boundary. See [The embedded proxy](/flip/concepts/the-embedded-proxy/).
