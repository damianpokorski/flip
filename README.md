# FLIP

**F**ast **L**ocal **I**frame **P**anel(s) — a self-hosted dashboard-browsing tool. Point it at your other self-hosted services (Grafana, Home Assistant, Netdata, Uptime Kuma, whatever's running on your home lab or office network) and instantly flip between them in one tab, with basic up/down health monitoring built in.

---

## Features

- **Instant, no-reload switching** — every panel's iframe stays mounted in the background; switching the active one is a pure visibility toggle, so embedded apps never reload, re-authenticate, or lose scroll position
- **Human-editable config** — panels and settings live in plain YAML files (`panels.yaml`, `config.yaml`), not a database. Hand-edit them directly, or use the Settings UI — both write to the same files, and comments you add are preserved
- **Live sync** — changes made anywhere (the Settings UI, another browser tab, or a hand-edited YAML file) push to every open view instantly over SSE
- **Basic health monitoring** — each panel is periodically checked (defaults to its own URL, or a separate health-check URL if you set one) and shows an up/down status dot
- **Drag-to-reorder** — rearrange panels in the settings UI without touching config files
- **Hide without deleting** — mark a panel hidden to keep its config around without showing it in the switcher

---

## Getting started

**Prerequisites:** [Bun](https://bun.sh) v1.3+

```bash
# 1. Install dependencies
bun install

# 2. Start the dev server
bun run dev
```

The data directory (`./data/panels.yaml`, `./data/config.yaml`) is created automatically on first boot, with one example panel — no separate setup step needed. The web UI is at `http://localhost:5173` and the API at `http://localhost:3000`.

### Editing panels by hand

Open `data/panels.yaml` in an editor while FLIP is running — changes are picked up live and pushed to any open browser tab. Each field is documented with a comment in the generated file. CRUD actions taken through the Settings UI write back to the same file, preserving comments on entries you didn't touch.

---

## Deploying behind a reverse proxy

The production Docker image serves the web UI and API from the same origin, so the web UI automatically talks to whatever host/protocol served the page — no configuration is needed behind a reverse proxy.

---

## Usage

### 1. Add your panels

Open `http://localhost:5173/settings` in a browser.

- Click **+ Add panel**, give it a title and URL, then save.
- Optionally set a separate **health check URL** if the panel's own URL isn't suitable for a liveness ping (e.g. it requires auth but has a lightweight `/health` endpoint).
- Enable **Hidden from switcher** to keep a panel's config without showing it day-to-day.

Drag the grip handle on any row to reorder.

### 2. Switch between panels

Navigate to `http://localhost:5173`. Click a panel's tab in the switcher bar to bring it to the front — every panel's iframe is already loaded in the background, so switching is instant. The colored dot on each tab reflects its last health check.

## Project structure

```
flip/
├── apps/
│   ├── web/         # SvelteKit frontend (panel switcher + settings)
│   ├── server/      # Elysia REST API
│   └── bootstrap/   # Ensures the data directory and default YAML files exist on startup
├── packages/
│   ├── store/       # YAML-backed data layer (panels, config) — no database
│   ├── env/         # Shared environment variable schemas
│   └── config/      # Shared TypeScript config
```

---

## Scripts

| Command | Description |
|---|---|
| `bun run dev` | Start web and server in development mode |
| `bun run build` | Build all apps |
| `bun run data:reset` | Wipe the local data directory and recreate it with defaults |
| `bun run check` | Run Biome lint + format checks |
| `bun run check-types` | TypeScript type-check across all packages |
| `bun run test` | Run server unit tests |
| `bun run test:coverage` | Run server unit tests with coverage reporting |
| `bun run test:e2e:install` | One-time: download the Chromium browser Playwright needs |
| `bun run test:e2e` | Run the Playwright end-to-end suite |
| `bun run docker` | Build the production Docker image and run it locally |
| `bun run docker:stop` | Stop and remove the local Docker container started by `docker` |

---

## End-to-end testing

Playwright specs live in `apps/web/e2e/`: panel CRUD in Settings, and panel switching (verifying iframes stay mounted across a switch).

```bash
# One-time: download the Chromium browser
bun run test:e2e:install

# Run the suite
bun run test:e2e
```

This spins up the server and web dev servers for you (Playwright's `webServer` config) against a **disposable, seeded data directory** (`apps/web/e2e/.e2e-data/`, gitignored) — never your own `data/`.

**Don't run `bun run test:e2e` while `bun run dev` is already up** — both bind the same ports (3000/5173).

---

## Internals

### Architecture

FLIP is a Bun monorepo with three apps that run side by side:

- **`apps/web`** (SvelteKit, `:5173`) — the browser-facing app. Two routes: `/` renders the panel switcher, `/settings` renders the management UI. All data fetching goes through a typed Eden Treaty client in `src/lib/api.ts` that talks to the server.
- **`apps/server`** (Elysia, `:3000`) — the REST API. Two resource controllers: `panels` (CRUD + reorder, embeds live health status) and `config` (health-check interval/timeout defaults), plus `events` (SSE change/health notifications). OpenAPI docs are generated automatically and available at `/api/swagger`.
- **`apps/bootstrap`** — ensures `DATA_DIR` and its default YAML files exist on startup. Runs once before `apps/server` starts (see the Dockerfile `CMD`); `apps/server` also runs the same step itself as a safety net, so local dev never needs this run manually.
- **`packages/store`** — the YAML data layer shared by `apps/server` and `apps/bootstrap`. `panels.yaml` holds title, URL, position, a `hidden` flag, and optional health-check overrides; `config.yaml` holds the default health-check interval/timeout. Reads/writes go through the `yaml` package's `Document` API rather than plain parse/stringify, so comments and formatting on untouched parts of the file survive an edit.

### Health checks

A single background scheduler in `apps/server` checks each panel's health-check URL (or its own URL, if none is set) once its own interval has elapsed, and keeps the result — up/down, latency, last-checked time — in memory only. Status is never written to YAML: it resets to "unknown" after a restart, which keeps the config files stable and avoids racing with file-watching. Status is pushed live to open browser tabs over the same SSE channel used for data changes.

### Extending FLIP

The `panels` resource (`packages/store/src/panels.ts`, `apps/server/src/{controllers,services,db}/*Panels*`) is the reference implementation for adding another YAML-backed resource — see `CLAUDE.md`'s New feature checklist for the step-by-step pattern.

---

## Tech stack

| Package | Role |
|---|---|
| [Bun](https://bun.sh) | Runtime and package manager |
| [SvelteKit](https://kit.svelte.dev) | Frontend framework — file-based routing, reactive UI |
| [Elysia](https://elysiajs.com) | Type-safe HTTP framework for the API server |
| [yaml](https://eemeli.org/yaml/) | Human-editable YAML data files — no database process required |
| [Biome](https://biomejs.dev) | Linting and formatting (replaces ESLint + Prettier) |
| [Vite+](https://viteplus.dev) | Monorepo task runner built on Vite/Rolldown |
| [svelte-dnd-action](https://github.com/isaacs/svelte-dnd-action) | Drag-and-drop reordering in the settings UI |
| [Catppuccin](https://catppuccin.com) | CSS design token palette (`--ctp-*` variables) |
| [Zod](https://zod.dev) | On-disk YAML shape validation, OpenAPI JSON-schema generation, and env-var validation (route validation itself uses Elysia's TypeBox) |
| [Playwright](https://playwright.dev) | End-to-end browser testing |
