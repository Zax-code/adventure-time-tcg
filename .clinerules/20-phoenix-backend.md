---
paths:
  - "apps/phoenix/**"
  - "packages/contracts/**"
  - "packages/api-client/**"
  - "infra/**"
  - "compose.yml"
---

# Phoenix Backend Rules

Use these rules for Phoenix, production data migration, contracts, backend infra, and mobile-facing API behavior.

## Backend Authority

- Phoenix in `apps/phoenix` is the primary backend.
- `apps/api` is archived legacy Fastify reference code only.
- The legacy PWA is the production data source of truth for migration/import behavior.
- Preserve mobile-facing contracts unless the user intentionally requests a contract change.
- Ecto migrations are authoritative for schema changes.

## Phoenix Work

- Keep Phoenix context boundaries intact.
- Prefer narrow tests for the touched context.
- Run `cd apps/phoenix && mix format` when Elixir files change.
- Run `cd apps/phoenix && mix test` or a targeted `mix test test/path/to/file_test.exs` for backend behavior.
- Run `cd apps/phoenix && mix precommit` for substantial Phoenix changes.

## PWA Import Work

- Keep importer workflows idempotent enough for reset-and-rerun.
- Preserve report output under `.migration-reports/`.
- Keep placeholder/dev data cleanup explicit.
- Document newly skipped or transformed legacy fields.
- Do not migrate PvP match/loadout tables unless the migration policy is intentionally changed.

## Operations

- Inspect active services, listeners, and reverse proxy wiring before host-level infra changes.
- Primary public app host is `https://app.leaetzak.love`.
- Phoenix env is in `apps/phoenix/.env`; do not commit secrets.

