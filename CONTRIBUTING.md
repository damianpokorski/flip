# Contributing to FLIP

This document covers running FLIP from source, the codebase layout, testing, and internals — for anyone building, extending, or sending a PR. For installing and using a released build, see [README.md](./README.md). For repo-specific SDLC conventions (commit style, linting, backend layering, etc.) that both human contributors and Claude Code are expected to follow, see [CLAUDE.md](./CLAUDE.md).

---

## Running from source

**Prerequisites:** [Bun](https://bun.sh) v1.3+ and [Caddy](https://caddyserver.com) v2 — FLIP's embedded Caddy proxy (see [Architecture](#architecture)) is the sole entrypoint in dev too, so it's a required local dependency, not just a production/Docker one. You'll also want the ability to create custom DNS entries on your network (router DNS settings, a local resolver like [Pi-hole](https://pi-hole.net), or your OS's hosts file) if you plan to exercise the iframe-proxy feature locally — see [Embedding services that block iframing](./README.md#embedding-services-that-block-iframing) in the README. This repo already pins tool versions with [Mise](https://mise.jdx.dev) (`mise.toml`), so the easiest path is:

```bash
mise install
```

```bash
# 1. Install dependencies
bun install

# 2. Start the dev server
bun run dev
```

The data directory (`./data/services.yaml`, `./data/workspaces.yaml`, `./data/config.yaml`, and an empty `./data/sites/` folder for locally-hosted static sites) is created automatically on first boot, with one example service and one workspace — no separate setup step needed. FLIP is reachable at a single address, `http://localhost:8080` — the embedded Caddy proxy in front of everything (see [Architecture](#architecture)); Vite (`:5173`) and the API server (`:3000`) are internal upstreams behind it, not meant to be visited directly.

If startup logs show Caddy failing to bind its admin API (`listen tcp 127.0.0.1:2019: bind: address already in use`), something else on your machine already owns port `2019` — set `CADDY_ADMIN_PORT` to a free port instead of hunting down the conflict.

### Building the Docker image locally

```bash
bun run docker       # build the production image and run it locally
bun run docker:stop  # stop and remove the local container started above
```

For the pre-built GHCR image instead of building locally, see the README's [Getting started](./README.md#getting-started).

---

## Project structure

```
flip/
├── apps/
│   ├── web/         # SvelteKit frontend (shell, HUD, settings)
│   ├── server/      # Elysia REST API
│   └── bootstrap/   # Ensures the data directory and default YAML files exist on startup
├── packages/
│   ├── store/       # YAML-backed data layer (services, workspaces, config) — no database
│   ├── env/         # Shared environment variable schemas
│   └── config/      # Shared TypeScript config
```

---

## Scripts

| Command                          | Description                                                    |
| -------------------------------- | -------------------------------------------------------------- |
| `bun run dev`                    | Start web and server in development mode                       |
| `bun run build`                  | Build all apps                                                 |
| `bun run data:reset`             | Wipe the local data directory and recreate it with defaults    |
| `bun run check`                  | Run Biome lint + format checks                                 |
| `bun run check-types`            | TypeScript type-check across all packages                      |
| `bun run test`                   | Run server unit tests                                          |
| `bun run test:coverage`          | Run server unit tests with coverage reporting                  |
| `bun run test:e2e:install`       | One-time: download the Chromium browser Playwright needs       |
| `bun run test:e2e`               | Run the Playwright end-to-end suite                            |
| `bun run test:e2e:visual`        | Run just the visual regression specs                           |
| `bun run test:e2e:visual:update` | Regenerate visual regression baseline screenshots              |
| `bun run docs:screenshots`       | Regenerate the README showcase screenshots                     |
| `bun run docker`                 | Build the production Docker image and run it locally           |
| `bun run docker:stop`            | Stop and remove the local Docker container started by `docker` |

---

## End-to-end testing

Playwright specs live in `apps/web/e2e/`: service CRUD in Settings, service/workspace switching (verifying iframes stay mounted across a switch), and the HUD's press-to-search keyboard flow.

```bash
# One-time: download the Chromium browser
bun run test:e2e:install

# Run the suite
bun run test:e2e
```

This spins up the server and web dev servers for you (Playwright's `webServer` config) against a **disposable, seeded data directory** (`apps/web/e2e/.e2e-data/`, gitignored) — never your own `data/`.

**Don't run `bun run test:e2e` while `bun run dev` is already up** — both bind the same ports (8080/3000/5173, since Playwright also drives the embedded Caddy proxy for real dev-path coverage).

### Visual regression testing

Spec files matching `apps/web/e2e/*visual*.spec.ts` capture baseline screenshots of the dashboard, HUD, settings pages, and mobile layout, compared via Playwright's `toHaveScreenshot()`. These are gated at commit time: the pre-commit hook (`.vite-hooks/pre-commit`) runs `bun run test:e2e:visual` whenever a staged file is under `apps/web/` or `packages/`, and **blocks the commit** if a screenshot differs from (or is missing) its committed baseline. CI runs the same specs as part of its existing `bun run test:e2e` step, as a redundant check.

To accept an intentional UI change:

```bash
bun run test:e2e:visual:update
```

Review the regenerated PNGs under `apps/web/e2e/*-snapshots/`, `git add` them, and commit again.

A few things worth knowing:

- **The check reflects your working tree, not just the staged index** — Playwright's dev server serves whatever is on disk. Stage UI changes in full rather than with `git add -p`, or the screenshot may not match what you're actually committing.
- **Stop `bun run dev` before committing UI changes** — same port conflict as `bun run test:e2e` above; the hook checks for this and will tell you if a port's already bound.
- **Every service renders as "down" in these baselines** — health checks are disabled under e2e (`DISABLE_HEALTH_CHECKS`) so screenshots don't depend on live network timing. Not a bug.

---

## Internals

### Architecture

FLIP is a Bun monorepo with three apps that run side by side, always fronted by an embedded Caddy proxy — in both dev and prod, nothing is reachable except through it:

- **Embedded Caddy proxy** (`CaddyProxyService`, `apps/server/src/services/CaddyProxyService.ts`) — always spawned by `apps/server`, listening on `PROXY_PORT` (default `8080`), the one address anything external ever talks to. Its generated config differs by `NODE_ENV`: in prod, root/unmatched-host traffic reverse-proxies straight to `apps/server` (which already serves both the SPA and the API there); in dev, it instead splits by path — `/api/*` to `apps/server`, everything else to Vite — since the SPA and API are two separate processes there. When `PROXY_DOMAIN` is set, it additionally routes per-service subdomains for the header-stripping feature (see [Embedding services that block iframing](./README.md#embedding-services-that-block-iframing) in the README) — those exact-host routes always take precedence over the root/catch-all route regardless of Caddyfile block order, since Caddy sorts by matcher specificity.
- **`apps/web`** (SvelteKit, `:5173` internally) — the browser-facing app, reached through the embedded proxy, never directly. `/` renders the shell (spine + sidebar + frame) and the HUD overlay; `/settings/*` renders the management UI (services, workspaces, shortcuts, config). All data fetching goes through a typed Eden Treaty client in `src/lib/api.ts`, which always targets `window.location.origin` — same-origin in both dev and prod, since the embedded proxy makes that true either way; shared reactive state (services, workspaces, active selection, HUD state) lives in `src/lib/app-state.svelte.ts`.
- **`apps/server`** (Elysia, `:3000` internally, loopback-bound) — the REST API, also reached only through the embedded proxy. Resource controllers for `services` (CRUD + reorder + a probe endpoint, embeds live health status) and `workspaces` (CRUD + reorder, cascades a deletion by reassigning member services to the next remaining workspace, refusing the deletion only if it's the last workspace left), plus `config` (read-only — also surfaces the env-derived `proxyDomain`/`proxyPort` for the embedded proxy feature, not just `config.yaml`'s contents), `sites` (lists folders available under `DATA_DIR/sites/` for the service form's folder picker, and serves their file contents to the services that reference them), and `events` (SSE change/health notifications). Each resource also exposes a `/raw` endpoint returning its live YAML file text, used by the Config settings tab. OpenAPI docs are generated automatically and available at `/api/openapi`.
- **`apps/bootstrap`** — ensures `DATA_DIR` and its default YAML files exist on startup. Runs once before `apps/server` starts (see the Dockerfile `CMD`); `apps/server` also runs the same step itself as a safety net, so local dev never needs this run manually.
- **`packages/store`** — the YAML data layer shared by `apps/server` and `apps/bootstrap`. `services.yaml` holds each service's identity, tile, health-check settings, and the single workspace id it belongs to; `workspaces.yaml` holds workspace identity/order; `config.yaml` holds the shared health-check timeout. Reads/writes go through the `yaml` package's `Document` API rather than plain parse/stringify, so comments and formatting on untouched parts of the file survive an edit. It also owns `DATA_DIR/sites/` — not a YAML file, just a directory of operator-mounted static site folders, one per `localSlug` referenced by a `source: local` service; `apps/server`'s `sites` controller serves files out of it directly.

### Health checks

A single background scheduler in `apps/server` checks each service's health-check URL (or its own URL, if none is set) once its own `every` interval has elapsed, comparing the response status against that service's `codes` list — a response outside that list counts as down, same as a timeout or network error. The result — a latency reading in milliseconds (or `null` for down) plus a derived bucket (`fast` / `ok` / `slow` / `down`, shared logic in `packages/store/src/health-bucket.ts`) — is kept in memory only. Status is never written to YAML: it resets after a restart, which keeps the config files stable and avoids racing with file-watching. Status is pushed live to open browser tabs over the same SSE channel used for data changes.

### The HUD

Pressing `` ` `` is a toggle, not a hold gesture: a global keydown listener in the root layout (`src/routes/+layout.svelte`) opens the HUD on the first press and closes it on the next, so it stays up while you type. It ignores the key entirely when focus is inside a form field, so typing a literal backtick into a URL doesn't summon it. While open, arrow keys/Shift+arrow keys/Enter/Escape/printable characters are all handled by that same listener, not by the visible search field (which is a controlled _display_ of the typed query, not an editable input) — this matches the product's intent of being drivable without moving real keyboard focus.

### Extending FLIP

The `services` resource (`packages/store/src/services.ts`, `apps/server/src/{controllers,services,db}/*Services*`) is the reference implementation for adding another YAML-backed resource — see [CLAUDE.md](./CLAUDE.md)'s New feature checklist for the step-by-step pattern.

---

## Tech stack

| Package                                                          | Role                                                                                                                                  |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| [Bun](https://bun.sh)                                            | Runtime and package manager                                                                                                           |
| [SvelteKit](https://kit.svelte.dev)                              | Frontend framework — file-based routing, reactive UI                                                                                  |
| [Elysia](https://elysiajs.com)                                   | Type-safe HTTP framework for the API server                                                                                           |
| [Caddy](https://caddyserver.com) (Apache-2.0)                    | Embedded header-stripping proxy — FLIP's sole network entrypoint, bundled as a binary in the Docker image                             |
| [yaml](https://eemeli.org/yaml/)                                 | Human-editable YAML data files — no database process required                                                                         |
| [Biome](https://biomejs.dev)                                     | Linting and formatting (replaces ESLint + Prettier)                                                                                   |
| [Vite+](https://viteplus.dev)                                    | Monorepo task runner built on Vite/Rolldown                                                                                           |
| [svelte-dnd-action](https://github.com/isaacs/svelte-dnd-action) | Drag-and-drop reordering — service lists, the workspace board, workspace order                                                        |
| [Catppuccin](https://catppuccin.com)                             | Base colour ramp — Mocha, the only theme                                                                                              |
| Oswald + Fira Code                                               | Display type (names, labels) and mono type (numbers, machine strings), loaded from Google Fonts                                       |
| [Zod](https://zod.dev)                                           | On-disk YAML shape validation, OpenAPI JSON-schema generation, and env-var validation (route validation itself uses Elysia's TypeBox) |
| [Playwright](https://playwright.dev)                             | End-to-end browser testing                                                                                                            |
