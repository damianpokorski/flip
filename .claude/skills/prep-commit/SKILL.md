---
name: prep-commit
description: Draft a Conventional-Commit-compliant message for the currently staged changes and review them against this repo's CLAUDE.md conventions that no tool checks mechanically, before the user runs `git commit`. Use when the user asks for a commit message, asks "is this ready to commit", or wants staged changes double-checked.
---

# Prep commit

Draft a commit message for whatever is currently staged, and review the staged diff for the judgment-call conventions from `CLAUDE.md` that no linter or hook can check — without ever running `git commit`, `git push`, or any state-changing `gh` command. Per `CLAUDE.md`, Claude Code never performs git/GitHub write actions in this repo; this skill only prepares things for the user to commit themselves.

**Division of labor, deliberately not duplicated here:** `.vite-hooks/pre-commit` already runs `bun run staged` (Biome) and a Playwright visual-regression gate for `apps/web`/`packages` changes, `.vite-hooks/commit-msg` already runs `bunx commitlint --edit` on the message, and `bun run check-types` / `bun run test` (via `vp`) are the standing scripts for type/test correctness. Those are all static, mechanical, and already automated — this skill does not re-run or re-implement any of them. If the user wants to double-check one of those before staging/committing, point them at the actual command (`bun run staged`, `bun run check-types`, `bun run test`) rather than running it yourself as part of this skill. This skill's entire value-add is the fuzzy, semantic half: reading the diff the way a reviewer would, then drafting a message that fits it.

## Process

### 1. Confirm there's something staged

Run `git status --short` and `git diff --cached --stat`. If nothing is staged, say so and stop — don't silently fall back to unstaged changes. Ask whether the user wants to stage something first.

### 2. Gather the full staged diff and context

- `git diff --cached` — the actual diff.
- `git diff --cached --name-only` — file list.
- `git log -8 --oneline` — recent message style/tone reference from this repo's real history (e.g. `fix(configs): ...`, `feat(ci): ...`).

### 3. Review the diff against conventions no tool enforces

Read the staged diff (and surrounding file context where a hunk alone doesn't show enough — e.g. a full test function to check its comments) for:

- No Tailwind classes, CSS-in-JS, or utility-framework usage — new styling should be scoped `<style>` blocks referencing tokens in `apps/web/src/styles/tokens/*.css`, not literals, and not rounded to a 4/8px grid.
- No emoji anywhere — code, comments, or the drafted commit message itself.
- No new icon-library usage — icons stay single Fira Code unicode glyphs.
- New or changed `bun:test` test bodies have explicit `// Arrange` / `// Act` / `// Assert` comments, even for trivial sections — this is a repo rule, not a suggestion.
- Backend changes preserve Controller → Service → Repository layering: no direct `@flip/store`/YAML access from a controller, no business-logic `if` in a repository, existence/not-found checks and cross-resource validation live in the service.
- No manual bump of any `package.json` `"version"` field, and no new/edited `CHANGELOG.md` — versioning is semantic-release-only.
- Svelte files use runes (`$props()`, `$state()`, `$bindable()`, `$derived()`), not legacy `export let` / `on:click` syntax.

This step is advisory — flag anything that looks off, don't silently rewrite it.

### 4. Draft the commit message(s)

Conventional Commits / Angular style per `commitlint.config.js` (stock `@commitlint/config-conventional`, no repo-specific scope enum): `type(scope): subject`, subject not sentence-cased, no trailing period, header ≤100 chars. The `commit-msg` hook will enforce this mechanically at actual commit time — no need to independently validate it here, just follow the format when drafting.

Pick `type` deliberately — it drives semantic-release's version bump (`feat` → minor, `fix`/`perf` → patch, a `BREAKING CHANGE:` footer → major). If the diff's actual impact doesn't match the type that'd naturally fit (e.g. a pure refactor drafted as `feat`), flag that mismatch to the user rather than silently picking one.

Only add a body when the *why* isn't obvious from the subject + diff alone.

### 5. Report back

One combined summary:

1. Any convention concerns found in step 3.
2. One or two suggested commit messages.
3. A one-line reminder that `bun run staged` / `check-types` / `test` and the commit hooks still run at commit time and aren't duplicated here — worth running by hand first if the change is large or touches multiple workspaces.

Do not run `git commit`. Hand off for the user to review and commit themselves.
