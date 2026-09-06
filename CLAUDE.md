# CLAUDE.md

Conventions for working on this repo, for both human contributors and Claude Code. This is a solo/personal-scale project (a self-hosted service-dashboard shell) — keep recommendations here pragmatic, not enterprise-heavy. For features, getting-started steps, and the scripts table, see `README.md`; this file focuses on SDLC conventions instead and shouldn't duplicate that content.

## Architecture overview

Bun workspaces monorepo: a SvelteKit static SPA (`apps/web`) talks to a Bun-native Elysia API (`apps/server`), backed by human-editable YAML files under `DATA_DIR` (`packages/store`, using the `yaml` package's `Document` API to preserve comments/formatting on writes). A separate runtime app (`apps/bootstrap`) ensures `DATA_DIR` and its default YAML files exist on container startup. Shared env-var validation and TypeScript config live in `packages/env` and `packages/config`. The task runner across all of this is `vp` (vite-plus) — root `package.json` scripts like `dev`, `build`, `check-types`, `lint` all delegate to it, usually filtered per workspace (`vp run --filter <name> <script>`).

## Design system

FLIP's visual/interaction design was adopted from a separate design project. Read `apps/web/src/styles/tokens/*.css` before styling anything new — every colour, size, radius, and duration used in the shell is a token there, not a literal. Three rules that matter more than the rest:

- **Names in Oswald (`--font-display`), numbers/machine strings in Fira Code (`--font-mono`).** No exceptions — a service name and its latency reading sit in the same row but are never the same font.
- **Blue (`--accent`) means state only** — selection, current workspace, primary action, focus. Mauve (`--drag`) is reserved for drag-and-drop only, so a dragged card can never be mistaken for a selected one.
- **Spacing/radius are not a 4px grid** (`--sp-*`/`--r-*` in `tokens/spacing.css`/`tokens/radius.css`) — the odd values (5px, 7px, 9px…) are load-bearing at this density. Copy them; don't round to the nearest 4 or 8.

No icon library — icons are single Fira Code unicode glyphs (`⌕ ⚙ + ⟳ ⋯ ⋮ › ← ⌗ ▦ ⬓ ◴ ⇱ ≡`). A service's "icon" is a 2-letter mark in its own hue (`ServiceMark`), never a fetched favicon. No emoji anywhere — UI, docs, or commit messages. Tailwind was removed entirely for this reason: its default spacing/colour scales actively fight this token system, and every component is now hand-rolled scoped `<style>` blocks referencing the tokens instead.

## Codebase conventions

**Backend layering (`apps/server`)** — strict Controller → Service → Repository per feature (see `controllers/services.ts`, `services/ServicesService.ts`, `db/ServicesRepository.ts` as the reference implementation):

- **Controller**: an Elysia sub-app scoped to a route prefix. Defines TypeBox (`t.Object`) request/response schemas, registers named response models via `.model()` so they can be referenced by string (`response: { 200: "Service", 404: "NotFoundError" }`). Handlers stay thin — just delegate to a service method. Service + repository (and, for services, the `HealthCheckService`/`ProbeService`) are instantiated manually at module scope (`new ServicesService(new ServicesRepository(), new WorkspacesRepository(), ...)`) — there's no DI container, keep it that way. A resource that references another (services → workspaces, for `ws` validation) takes that other resource's repository as a constructor dependency, not its service — repositories are the shared, side-effect-free interface between resources.
- **Service**: business logic lives here. Existence checks before update/delete (throwing `NotFoundError`), cross-resource validation (e.g. `ws` ids must reference real workspaces), cascade behavior on delete (`WorkspacesService.delete` reassigns every member service to the next remaining workspace, refusing the deletion only if it's the last workspace left), ID generation via `uuidv7()`, defaulting, and API-shape transforms. No direct data-store access.
- **Repository**: thin `@flip/store` read/write wrappers only (`findAll`/`findById`/`create`/`update`/`delete`, plus feature-specific methods like `reorder`/`reassignWorkspace`/`readRaw`) — no direct YAML/fs access outside `@flip/store`, no business logic.
- A stateless capability with no persisted state (`ProbeService`) still gets its own class instantiated the same way as everything else, for consistency with this layering and so the standard controller-test mocking pattern applies unmodified — it just has no repository dependency.
- Rule of thumb: if you're writing an `if` that isn't a not-found check, it belongs in the service, not the repository.

**Error handling** — centralized in `apps/server/src/errors.ts`: an abstract `HttpError` base carries an HTTP status; concrete subclasses (`BadRequestError`, `NotFoundError`, `UnprocessableEntityError`, `InternalServerError`) are thrown directly from services. A shared `errorPlugin` registers TypeBox response models per error type and a global `.onError()` maps any `HttpError` to `{ status, message }` JSON. New error types should extend `HttpError` and get registered in the plugin.

**Validation** — two distinct layers, don't conflate them:

- Elysia's built-in TypeBox (`t` from `"elysia"`) for all HTTP request/response schemas.
- zod schemas inside `@flip/store` (`packages/store/src/schemas/*.ts`) validate the _on-disk YAML shape_ — parsing + defaulting when a file is read or hand-edited. This is a different concern from route validation; zod is also still used for OpenAPI JSON-schema generation (`router.ts`) and env-var validation (`packages/env`).

**Shared thresholds live in `packages/store`, not duplicated per-runtime** — `health-bucket.ts` (`bucketFor(ms)`), `interval.ts` (`parseEvery("30s")`), `codes.ts` (`parseCodes("200, 401")`) are pure, dependency-free functions imported by both `apps/server` (embeds the computed bucket in API responses) and `apps/web` (buckets a freshly-probed latency client-side, before any round trip through the API) via the package's leaf-file subpath exports (e.g. `@flip/store/health-bucket`) — this deliberately narrow import doesn't pull in `@flip/store`'s `node:fs`-touching code into the browser bundle, since type/pure-function-only leaf modules have no such dependency.

**Web separation of concerns (`apps/web`)**:

- Form components (`ServiceForm`, and the leaf components under `src/components/`) are pure/controlled: props in (via `$bindable()` for anything two-way), callback props out (`onsave`/`oncancel`), no internal fetch calls except where a component's whole job is a live check (`ServiceForm`'s URL probe is the one deliberate exception — it calls the API directly on demand, not on every render). The parent route page owns persistence and API orchestration.
- Shared cross-route state (the current service/workspace list, active selection, HUD open/query/cursor) lives in `src/lib/app-state.svelte.ts` — a singleton class using Svelte 5 runes (`$state` fields, plain getters for derived values), not a per-route local variable. It's populated once from the root layout and consumed by both `/` and `/settings/*`.
- Wire types (`src/lib/api.ts`, derived from the Eden Treaty client via `Awaited<ReturnType<...>>`) are the source of truth for API shapes — bind form fields directly to primitive props rather than introducing a separate edit-model layer unless a feature's shape genuinely diverges from the wire type.
- API calls follow a `{ data, error }` destructure-and-guard pattern (`if (error) { console.error(...); return; }`). This is ad hoc today (no centralized error/toast handling) — a reasonable future improvement, but not required for new features.

**Svelte version** — all components use Svelte 5 runes (`$props()`, `$bindable()`, `$state()`, `$derived()`), not legacy syntax (`export let`, `on:click`). Keep it that way for anything new. Prefer the function-form of `bind:` (`bind:value={() => x, (v) => x = v}`) when a component's bindable prop doesn't line up 1:1 with a piece of parent state (e.g. binding a boolean toggle to one branch of a string union) rather than introducing an intermediate `$state` variable purely to bridge the two.

**Global keyboard handling** — the HUD's backtick-toggle lives in `src/routes/+layout.svelte` via `<svelte:window onkeydown>`, not in the `Hud` component itself, since it must work regardless of which route is active and must run even before the HUD exists in the DOM. Any future global shortcut belongs there too, not in a component-local listener. Always guard against the event's target being a form field (`isTypingTarget()`) before treating a keypress as a shortcut — the backtick specifically is a real, typeable character.

**Styling** — hand-rolled scoped `<style>` blocks referencing the design tokens in `src/styles/tokens/*.css` (imported once from `app.css`). No Tailwind, no CSS-in-JS, no utility framework — see "Design system" above.

**General conventions** — tabs for indentation, double quotes, `workspace:*` for internal package deps, `catalog:` in root `package.json` for deps shared across 2+ workspaces (currently `dotenv`, `zod`, `typescript`, `@types/bun`).

**Known, deliberate gaps** (not oversights — revisit only if they actually bite):

- Concurrent edits are last-write-wins: no `updatedAt`/version check, no 409 on a stale write. Fine for a single-user, personal-scale tool.
- Per-service health status is transient/in-memory only, never persisted to YAML — it resets after every restart until the next check tick. Keeps the data files stable and human-diffable, and avoids racing the file watcher.
- The add-service probe is an unauthenticated server-side fetch — against an auth-gated dashboard it reflects the _login page's_ title/headers, not the real app's. Inherent limitation, not a bug.
- Shortcuts (`/settings/shortcuts`) are a static, read-only list — no rebinding UI, no `shortcuts.yaml`.
- The Config settings tab is read-only (a live view of the real YAML, with a Copy button) — editing happens through the structured Services/Workspaces tabs or by hand-editing the file directly, not through that view.
- Mobile-responsive layouts are not implemented — the shell (spine/sidebar/frame/HUD) is desktop-only for now.
- TLS termination for the embedded header-stripping proxy's per-service subdomains is not automated — plain HTTP only, consistent with FLIP's LAN-only deployment assumption. If FLIP's own origin is served over HTTPS by an external front-proxy, embedding a plain-HTTP-proxied iframe is a browser mixed-content block. Revisit only if it actually bites (e.g. via on-demand ACME or an internal CA).

## Linting & formatting

Biome is the only linter/formatter (`biome.json`) — no ESLint, no Prettier. Don't add them. Use `bun run check` (biome check --write), `bun run lint` (`vp lint`), `bun run format` (`vp fmt`). A pre-commit hook can run `vp check --fix` over staged files once wired via `bun run hooks:setup`. Svelte files intentionally disable a few rules (`useConst`, `useImportType`, unused-vars) since the Svelte compiler handles them differently — don't "fix" this by re-enabling them.

## Unit testing

**Server** (`apps/server`) uses **`bun:test`** (Bun's built-in test runner) — not Vitest.

- **Location**: colocate tests next to source as `<file>.ts` → `<file>.test.ts`.
- **AAA convention**: every test body has explicit `// Arrange` / `// Act` / `// Assert` comment sections, even when a section is trivial. This is a repo rule, not a suggestion.
- **Controller tests** (implemented — see `src/controllers/services.test.ts` and `workspaces.test.ts` as the reference): controllers instantiate their service/repository/health-checker at module scope with real dependencies. To test a controller in isolation, use `mock.module("../services/XService", () => ({...}))` (and any other module-scope collaborators — for `services.ts` that means `ServicesRepository`, `WorkspacesRepository`, `HealthCheckService`, and `ProbeService` all need mocking) to replace them with test doubles, then bring in the controller via a **dynamic `await import("./x")`** placed _after_ those `mock.module()` calls (static imports are hoisted above `mock.module`, so they won't pick up the fakes). Drive requests via the exported Elysia instance's `.handle(new Request(...))` — this exercises real routing, TypeBox validation, and `errorPlugin`'s error-to-JSON mapping without a real HTTP server or filesystem. Reset mocks in `beforeEach`.
- **Service tests** (implemented for the new codes/latency logic — see `HealthCheckService.test.ts` and `ProbeService.test.ts`; otherwise recommended but not required): test with the repository mocked via a hand-written fake or bun's `mock()` (not Vitest's `vi.fn()`). `HealthCheckService.test.ts` mocks `@flip/store`'s `configStore` only, keeping the real `bucketFor`/`parseCodes`/`parseEvery` functions (imported before the `mock.module()` call, since static imports are hoisted) — mock only the I/O-touching parts of a module, not pure logic you actually want exercised. `ProbeService.test.ts` mocks `global.fetch` directly.
- **Repository / store tests** (recommended, not yet implemented): against a temp directory (`fs.mkdtemp`) seeded with fixture YAML files, using the real `@flip/store` implementation, to verify actual read/write/comment-preservation behavior.
- **Scripts**: `"test": "bun test ./src"` per workspace with tests — note the explicit `./src` path: bare `bun test` (or any pattern without a leading `./`) can double-count matching files depending on the installed Bun version, so always pass an explicit `./`-prefixed path.
- **Coverage**: `apps/server` exposes `"test:coverage": "bun test ./src --coverage"`, with `apps/server/bunfig.toml` setting `coverageReporter = ["text", "lcov"]`. No coverage thresholds are enforced — reporting only.
- Don't over-invest: no coverage thresholds, no additional mocking library beyond `bun:test`'s built-in `mock`/`spyOn`.

## End-to-end testing

**Playwright** (`@playwright/test`) in `apps/web`, with a small, deliberately scoped set of critical-path specs rather than exhaustive UI coverage:

- Settings CRUD: create/edit/delete a service (`settings-services.spec.ts`) or a workspace (`settings-workspaces.spec.ts`).
- Service/workspace switching: switching the active service is a visibility toggle, not a remount; switching workspaces never mounts/unmounts any iframe either, since every embeddable service is mounted up front regardless of workspace (`service-switcher.spec.ts`).
- The HUD: pressing backtick toggles it, typing filters across all services, Enter opens the highlighted tile, and a literal backtick typed into a form field never raises it (`hud.spec.ts`, driven via `page.keyboard.press`).

Tests that create fixture data over the API clean it up in a `finally` block, and assert against a _delta_ from a captured baseline count rather than a hardcoded absolute number — specs share one disposable data directory for the whole run (not reset between individual tests), so an assertion like `toHaveCount(2)` is fragile against whatever earlier specs happened to leave behind; `toHaveCount(baseline + 1)` is not.

Run against real dev servers (`bun run dev:server` + `bun run dev:web`) pointed at a disposable data directory, reset/seeded before each _run_ via `bun run data:reset`. Playwright's `webServer` config (`apps/web/playwright.config.ts`) wipes and re-bootstraps that directory before the server starts listening — no separate CI setup step needed. **Don't run `bun run test:e2e` while `bun run dev` is already up** — both bind the same ports (3000/5173).

## Dockerization

The multi-stage `Dockerfile` (base → deps → builder → runtime) uses per-workspace layer caching for prod deps, isolated-linker `node_modules`, no compile step for the Bun-native server, static SvelteKit output served from Elysia, and `VOLUME /data` (holding `services.yaml`/`workspaces.yaml`/`config.yaml`, not a database file) for persistence across restarts.

- When adding a new workspace or a `packages/*` with runtime deps, remember to add corresponding `COPY` lines for its `package.json` (deps stage) and its `node_modules`/source (runtime stage) — the Dockerfile doesn't auto-discover workspaces.
- Don't add docker-compose. There's no second dependent _service_ (no database process) — revisit only if one is introduced. The embedded Caddy proxy (`CaddyProxyService`, `apps/server/src/services/CaddyProxyService.ts`) doesn't count: it's a component of FLIP itself, not a separate deployable service, so it's a static binary copied into the same image (`COPY --from=caddy:2 ...`) and spawned directly by the Bun server via `Bun.spawn` — not a shell wrapper, not tini/dumb-init. This is the repo's first multi-process container and the established precedent for any future second process: the Dockerfile's `CMD` uses `exec` so the Bun process becomes PID 1 and actually receives `SIGTERM` from `docker stop`, and `apps/server/src/index.ts`'s own `SIGTERM`/`SIGINT` handlers explicitly stop each owned subprocess before exiting.
- `CaddyProxyService` is always spawned (not conditional on `PROXY_DOMAIN` — that only gates the _additional_ per-service subdomain blocks) and is FLIP's sole network entrypoint in both dev and prod, not just a production/Docker concern — it's a required local dev dependency too (`mise.toml` pins it alongside `bun`). `buildCaddyfile()` branches on `NODE_ENV`: prod emits a single root reverse-proxy to `apps/server` (which already serves both the SPA and `/api/*` there); dev instead splits the root block by path (`/api/*` to `apps/server`, everything else to Vite), since those are two separate processes there. Per-service exact-host blocks (when `PROXY_DOMAIN` is set) always win over the root/catch-all block regardless of Caddyfile order — Caddy sorts routes by matcher specificity, not source order.

## Releases & versioning

Commits must follow [Conventional Commits](https://www.conventionalcommits.org/) (Angular-derived: `feat:`, `fix:`, `chore:`, `docs:`, etc., optionally scoped like `feat(services): ...`) — this is what drives automated versioning, so it's enforced, not just a style preference.

- **Enforcement is local, via `vp`'s built-in git hook dispatcher** (`.vite-hooks/`) — not husky or lefthook. This repo already has a hook manager through the `vp` task runner (`vp hooks enable`/`vp config`/`vp hooks status`), so adding a second one would be redundant. Run `bun run hooks:setup` once per clone to install it.
  - `.vite-hooks/pre-commit` runs `vp staged` (staged-file lint/format checks, per the `staged` block in `vite.config.ts`).
  - `.vite-hooks/commit-msg` runs `bunx commitlint --edit "$1"` against `commitlint.config.js` (`@commitlint/config-conventional`).
  - Both scripts are project-owned and committed; the generated dispatcher internals under `.vite-hooks/_` are gitignored and regenerated by `vp hooks enable`.
- **Versioning is fully automated by [semantic-release](https://semantic-release.gitbook.io/)** (`.releaserc.json`), triggered by `.github/workflows/release.yml` once `.github/workflows/ci.yml` passes on `main`. It computes the next version from commits since the last release, tags the commit, and publishes a GitHub Release with generated notes — then a second job builds the Dockerfile and pushes `ghcr.io/damianpokorski/flip:<version>` + `:latest`.
- **`package.json` version fields are intentionally never bumped or published to npm** — this is a self-hosted app deployed as a Docker image, not an npm package. Version lives only as the git tag / GitHub Release / Docker tag. `@semantic-release/npm` is deliberately not in the plugin list.
- **There is no committed `CHANGELOG.md`** — release notes live only on the GitHub Releases page, published via `@semantic-release/github` (a GitHub API call, not a git push). This is deliberate, not an oversight: `main` has a GitHub ruleset requiring both a pull request and signed commits, and `@semantic-release/git` (which would commit a changelog file back to `main`) does a plain unsigned direct push that trips both rules. Rather than weaken that ruleset, the release pipeline simply never pushes anything to `main` — the only ref it pushes is the version tag, which isn't covered by the ruleset. If a future need genuinely requires committing back to `main` (e.g. re-adding a changelog file), the preferred fix is a narrow "GitHub Actions" bypass entry scoped to just the direct-push/PR-required rule — not disabling "require signed commits", which should stay fully enforced for human contributors.
- Run `bun run release:dry` locally to sanity-check `.releaserc.json` and see how the current commit history would be classified, without publishing anything.

## New feature checklist

When adding a new API-backed resource (modeled on how `services`/`workspaces` were built):

1. Define/extend the zod schema for the resource in `packages/store/src/schemas/*.ts`, export accessors from a sibling module (e.g. `packages/store/src/services.ts`), and document the YAML shape with field comments in `packages/store/src/defaults.ts` — power users hand-edit these files directly. If the resource needs a live raw-text view (like Config), add a `readRaw()` passthrough to `YamlFile` rather than a bespoke reader.
2. Add a repository (`apps/server/src/db/<Feature>Repository.ts`) — thin `@flip/store` wrappers only.
3. Add a service (`apps/server/src/services/<Feature>Service.ts`) — business logic, cross-resource validation against another repository if needed, `HttpError` subclasses as needed, ID generation, transforms.
4. Add a controller (`apps/server/src/controllers/<feature>.ts`) — TypeBox schemas, named response models including error models, thin handlers; wire it into `router.ts`.
5. Add unit tests: a controller test following `services.test.ts`'s `mock.module` pattern, plus service tests with the repository mocked (and `global.fetch` mocked, if the feature makes outbound requests).
6. Update `apps/web/src/lib/api.ts` type derivations (should mostly fall out automatically from Eden's typed client).
7. Add/update Svelte components and routes, following the controlled-component (`$bindable()` props, `onsave`/`oncancel` callbacks) and runes conventions above, and the design tokens for anything visual.
8. If the feature touches a critical path, add or update a Playwright e2e spec.
9. Update `README.md` if the feature is user-facing.
