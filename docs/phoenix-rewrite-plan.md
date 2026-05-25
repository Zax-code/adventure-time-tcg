# Phoenix Rewrite Plan

This document is preserved as historical context for the backend replacement that moved `adventure-time-tcg` from the legacy Fastify API to Phoenix.

## Outcome

The rewrite is complete enough that Phoenix is now the active backend for regular development and production traffic.

What changed:
- the TypeScript/Fastify backend was replaced operationally by Phoenix
- Phoenix now owns the live PostgreSQL schema through Ecto migrations
- production PWA data migration now runs through Phoenix-native import tooling
- the legacy backend was archived in `apps/api` for reference only

## Historical Objectives

The rewrite aimed to:
- preserve mobile-facing behavior unless intentionally changed
- improve backend architecture substantially
- redesign persistence around Phoenix and Ecto best practices
- support later migration of production data from the legacy PWA

## Reference Sources

Use these when historical behavior is unclear:
- active repo: `/home/zax/adventure-time-tcg`
- backup repo: `/home/zax/adventure-time-tcg-backup-pre-phoenix-20260324-123939`
- legacy PWA: `~/adventure-time-tcg`
- archived Fastify backend: `apps/api`

## Architecture Direction That Landed

- Phoenix API-first app
- Ecto + PostgreSQL
- Oban for jobs and operational workflows
- bounded contexts for Accounts, Catalog, Inventory, Quests, Pvp, Admin, and Media
- thin controllers and richer context/domain modules

## Remaining Historical Notes

- PvP persistence still follows the Phoenix-side event/snapshot direction established during the rewrite.
- The legacy PWA remains the source of truth for historical production behavior and migrated data lineage.
- `apps/api` should not be treated as an active target for new development work.
