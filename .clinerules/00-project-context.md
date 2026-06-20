# Adventure Time TCG Project Context

Always treat this repository as a Phoenix-first backend plus Expo mobile app workspace.

## Canonical Instructions

- Read `AGENTS.md` before substantial work. It is the canonical agent playbook for this repo.
- Use `DESIGN.md` for mobile UI/design-system decisions.
- Use `DESIGN_OUTLIERS.md` before copying an existing UI pattern that looks inconsistent.
- Keep `CLAUDE.md` structurally aligned with `AGENTS.md` only when updating the agent playbook itself.

## Architecture

- `apps/phoenix` is the primary backend and owns auth, persistence, uploads, jobs, and DB access.
- `apps/mobile` is the Expo / React Native app.
- `apps/api` is archived legacy Fastify reference code only.
- The legacy PWA at `~/adventure-time-tcg-pwa` or `~/Develop/adventure-time-tcg-pwa` is a reference source when behavior is unclear, not target architecture.
- Mobile talks to Phoenix through `@adventure-time/api-client`.
- Request/response contracts live in `@adventure-time/contracts` and are re-exported by `@adventure-time/api-client`.
- `@adventure-time/game-engine` must remain pure: no DB, network, env, or filesystem access.
- Ecto migrations are the database source of truth.

## Workflow Guardrails

- Work from the repo root unless a package-specific command is clearer.
- Do not overwrite or revert user changes. If the worktree is dirty, inspect the diff and preserve unrelated edits.
- Prefer targeted changes over broad refactors.
- Use the Phoenix implementation first, then legacy PWA/Fastify references only when needed.
- Do not add GitHub Actions for mobile build or release work.
- Do not merge PRs unless the user explicitly asks.
- For finished work, commit logical changes, push the branch, and open a PR unless the user says not to.

