# .articles

Source markdown for FLIP's usage documentation site (Astro Starlight, built in a separate task and published to GitHub Pages). Nothing in here is shipped in the Docker image.

## Layout

Numbered section folders, numbered files. The numeric prefix is only for sorting on disk; the published order comes from `sidebar.order` in each file's frontmatter.

- `01-getting-started/` - install, first service, upgrading
- `02-guides/` - task-oriented recipes and use cases
- `03-concepts/` - how and why FLIP behaves the way it does
- `04-reference/` - config fields, env vars, shortcuts, troubleshooting

## Frontmatter

```yaml
---
title: "Page title"
description: "One sentence, used for search and link previews."
sidebar:
  order: 1
---
```

## Voice

- Written for a homelab newcomer: comfortable with Docker, not necessarily with reverse proxies, wildcard DNS or YAML. Explain the why, not just the command.
- Friendly and practical: second person, short paragraphs, no fluff.
- No emoji. Names in prose, numbers and machine strings (`config.yaml`, `PROXY_DOMAIN`, `200`) in code formatting.
- FLIP only: do not compare against other dashboards.
- Screenshots come from `bun run docs:screenshots` (writes to `apps/docs/src/assets/screenshots/`; commit the PNGs, and rerun after UI changes). Embed them from an article as `![alt](../../../assets/screenshots/name.png)`: the path is relative to the `src/content/docs` symlink Astro reads through, so editor previews of `.articles/` will not show them. Always write alt text.
- Keep pages short and to the point. Search for `TODO:` to find anything still unwritten.
- Internal links are absolute and include the site base (`/flip/...`); update them if `base` in `apps/docs/astro.config.mjs` changes.
- Verify facts against source (`packages/store/src/defaults.ts`, `packages/env`) rather than copying from the README.
