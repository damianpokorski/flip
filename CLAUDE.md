# CLAUDE.md

Conventions for working on this repo, for both human contributors and Claude Code. This is a solo/personal-scale project (a self-hosted iframe-panel dashboard switcher) — keep recommendations here pragmatic, not enterprise-heavy. For features, getting-started steps, and the scripts table, see `README.md`; this file focuses on SDLC conventions instead and shouldn't duplicate that content.

## Architecture overview

Bun workspaces monorepo: a SvelteKit static SPA (`apps/web`) talks to a Bun-native Elysia API (`apps/server`), backed by human-editable YAML files under `DATA_DIR` (`packages/store`, using the `yaml` package's `Document` API to preserve comments/formatting on writes). A separate runtime app (`apps/bootstrap`) ensures `DATA_DIR` and its default YAML files exist on container startup. Shared env-var validation and TypeScript config live in `packages/env` and `packages/config`. The task runner across all of this is `vp` (vite-plus) — root `package.json` scripts like `dev`, `build`, `check-types`, `lint` all delegate to it, usually filtered per workspace (`vp run --filter <name> <script>`).

## Codebase conventions

**Backend layering (`apps/server`)** — strict Controller → Service → Repository per feature (see `controllers/panels.ts`, `services/PanelsService.ts`, `db/PanelsRepository.ts` as the reference implementation):
- **Controller**: an Elysia sub-app scoped to a route prefix. Defines TypeBox (`t.Object`) request/response schemas, registers named response models via `.model()` so they can be referenced by string (`response: { 200: "Panel", 404: "NotFoundError" }`). Handlers stay thin — just delegate to a service method. Service + repository (and, for panels, the `HealthCheckService`) are instantiated manually at module scope (`new PanelsService(new PanelsRepository(), ...)`) — there's no DI container, keep it that way.
- **Service**: business logic lives here. Existence checks before update/delete (throwing `NotFoundError`), ID generation via `uuidv7()`, defaulting, and API-shape transforms. No direct data-store access.
- **Repository**: thin `@flip/store` read/write wrappers only (`findAll`/`findById`/`create`/`update`/`delete`, plus feature-specific methods like `reorder`) — no direct YAML/fs access outside `@flip/store`, no business logic.
- Rule of thumb: if you're writing an `if` that isn't a not-found check, it belongs in the service, not the repository.

**Error handling** — centralized in `apps/server/src/errors.ts`: an abstract `HttpError` base carries an HTTP status; concrete subclasses (`BadRequestError`, `NotFoundError`, `UnprocessableEntityError`, `InternalServerError`) are thrown directly from services. A shared `errorPlugin` registers TypeBox response models per error type and a global `.onError()` maps any `HttpError` to `{ status, message }` JSON. New error types should extend `HttpError` and get registered in the plugin.

**Validation** — two distinct layers, don't conflate them:
- Elysia's built-in TypeBox (`t` from `"elysia"`) for all HTTP request/response schemas.
- zod schemas inside `@flip/store` (`packages/store/src/schemas/*.ts`) validate the *on-disk YAML shape* — parsing + defaulting when a file is read or hand-edited. This is a different concern from route validation; zod is also still used for OpenAPI JSON-schema generation (`router.ts`) and env-var validation (`packages/env`).

**Web separation of concerns (`apps/web`)**:
- Form components (`PanelForm`) are pure/controlled: props in (via `$bindable()`), callback props out (`onsave`/`oncancel`), no internal fetch calls. The parent route page owns all state and API orchestration.
- Wire types (`src/lib/api.ts`, derived from the Eden Treaty client via `Awaited<ReturnType<...>>`) are the source of truth for API shapes — bind form fields directly to primitive props rather than introducing a separate edit-model layer unless a feature's shape genuinely diverges from the wire type.
- API calls follow a `{ data, error }` destructure-and-guard pattern (`if (error) { console.error(...); return; }`). This is ad hoc today (no centralized error/toast handling) — a reasonable future improvement, but not required for new features.

**Svelte version** — all components use Svelte 5 runes (`$props()`, `$bindable()`, `$state()`, `$derived()`), not legacy syntax (`export let`, `on:click`). Keep it that way for anything new.

**Styling** — Tailwind utility classes for layout, hand-rolled scoped `<style>` blocks using Catppuccin Mocha `--ctp-*` custom properties (`app.css`) for panel/form chrome. Only one theme is wired up — if you add theme switching later, follow revolver's `data-theme` attribute pattern rather than inventing a new one.

**General conventions** — tabs for indentation, double quotes, `workspace:*` for internal package deps, `catalog:` in root `package.json` for deps shared across 2+ workspaces (currently `dotenv`, `zod`, `typescript`, `@types/bun`).

**Known, deliberate gaps** (not oversights — revisit only if they actually bite):
- Concurrent edits are last-write-wins: no `updatedAt`/version check, no 409 on a stale write. Fine for a single-user, personal-scale tool.
- Per-panel health status is transient/in-memory only, never persisted to YAML — it resets to "unknown" after every restart until the next check tick. Keeps the data files stable and human-diffable, and avoids racing the file watcher.

## Linting & formatting

Biome is the only linter/formatter (`biome.json`) — no ESLint, no Prettier. Don't add them. Use `bun run check` (biome check --write), `bun run lint` (`vp lint`), `bun run format` (`vp fmt`). A pre-commit hook can run `vp check --fix` over staged files once wired via `bun run hooks:setup`. Svelte files intentionally disable a few rules (`useConst`, `useImportType`, unused-vars) since the Svelte compiler handles them differently — don't "fix" this by re-enabling them.

## Unit testing

**Server** (`apps/server`) uses **`bun:test`** (Bun's built-in test runner) — not Vitest.

- **Location**: colocate tests next to source as `<file>.ts` → `<file>.test.ts`.
- **AAA convention**: every test body has explicit `// Arrange` / `// Act` / `// Assert` comment sections, even when a section is trivial. This is a repo rule, not a suggestion.
- **Controller tests** (implemented — see `src/controllers/panels.test.ts` as the reference): controllers instantiate their service/repository/health-checker at module scope with real dependencies. To test a controller in isolation, use `mock.module("../services/XService", () => ({...}))` (and any other module-scope collaborators) to replace them with test doubles, then bring in the controller via a **dynamic `await import("./x")`** placed *after* those `mock.module()` calls (static imports are hoisted above `mock.module`, so they won't pick up the fakes). Drive requests via the exported Elysia instance's `.handle(new Request(...))` — this exercises real routing, TypeBox validation, and `errorPlugin`'s error-to-JSON mapping without a real HTTP server or filesystem. Reset mocks in `beforeEach`.
- **Service tests** (recommended, not yet implemented): test with the repository mocked via a hand-written fake or bun's `mock()` (not Vitest's `vi.fn()`), to verify existence checks, defaulting, ID generation, and transforms in isolation.
- **Repository / store tests** (recommended, not yet implemented): against a temp directory (`fs.mkdtemp`) seeded with fixture YAML files, using the real `@flip/store` implementation, to verify actual read/write/comment-preservation behavior.
- **Scripts**: `"test": "bun test ./src"` per workspace with tests — note the explicit `./src` path: bare `bun test` (or any pattern without a leading `./`) can double-count matching files depending on the installed Bun version, so always pass an explicit `./`-prefixed path.
- **Coverage**: `apps/server` exposes `"test:coverage": "bun test ./src --coverage"`, with `apps/server/bunfig.toml` setting `coverageReporter = ["text", "lcov"]`. No coverage thresholds are enforced — reporting only.
- Don't over-invest: no coverage thresholds, no additional mocking library beyond `bun:test`'s built-in `mock`/`spyOn`.

## End-to-end testing

**Playwright** (`@playwright/test`) in `apps/web`, with a small, deliberately scoped set of critical-path specs rather than exhaustive UI coverage:
- Settings CRUD: create/edit/delete a panel (`settings-panels.spec.ts`).
- Panel switching: switching the active panel is a visibility toggle, not a remount — both iframes stay mounted (`panel-switcher.spec.ts`).

Run against real dev servers (`bun run dev:server` + `bun run dev:web`) pointed at a disposable data directory, reset/seeded before each run via `bun run data:reset`. Playwright's `webServer` config (`apps/web/playwright.config.ts`) wipes and re-bootstraps that directory before the server starts listening — no separate CI setup step needed. **Don't run `bun run test:e2e` while `bun run dev` is already up** — both bind the same ports (3000/5173).

## Dockerization

The multi-stage `Dockerfile` (base → deps → builder → runtime) uses per-workspace layer caching for prod deps, isolated-linker `node_modules`, no compile step for the Bun-native server, static SvelteKit output served from Elysia, and `VOLUME /data` (now holding `panels.yaml`/`config.yaml`, not a database file) for persistence across restarts.

- When adding a new workspace or a `packages/*` with runtime deps, remember to add corresponding `COPY` lines for its `package.json` (deps stage) and its `node_modules`/source (runtime stage) — the Dockerfile doesn't auto-discover workspaces.
- Don't add docker-compose. There's no second dependent service (no database process) — revisit only if one is introduced.

## New feature checklist

When adding a new API-backed resource (modeled on how `panels` was built):
1. Define/extend the zod schema for the resource in `packages/store/src/schemas/*.ts`, export accessors from a sibling module (e.g. `packages/store/src/panels.ts`), and document the YAML shape with field comments in `packages/store/src/defaults.ts` — power users hand-edit these files directly.
2. Add a repository (`apps/server/src/db/<Feature>Repository.ts`) — thin `@flip/store` wrappers only.
3. Add a service (`apps/server/src/services/<Feature>Service.ts`) — business logic, `HttpError` subclasses as needed, ID generation, transforms.
4. Add a controller (`apps/server/src/controllers/<feature>.ts`) — TypeBox schemas, named response models including error models, thin handlers; wire it into `router.ts`.
5. Add unit tests: a controller test following `panels.test.ts`'s `mock.module` pattern, plus service tests with the repository mocked.
6. Update `apps/web/src/lib/api.ts` type derivations (should mostly fall out automatically from Eden's typed client).
7. Add/update Svelte components and routes, following the controlled-component (`$bindable()` props, `onsave`/`oncancel` callbacks) and runes conventions above.
8. If the feature touches a critical path, add or update a Playwright e2e spec.
9. Update `README.md` if the feature is user-facing.
