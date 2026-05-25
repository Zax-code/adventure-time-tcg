# PWA To Phoenix Migration

Phoenix now owns the production import workflow from the legacy PWA.

## Scope

Migrated:

- users
- email credentials
- email access requests and signup verification codes
- coins, dust, display names, preferred language, preferred step source
- profile and card images copied into Phoenix-backed object storage
- rarities, cards, packs, abilities, and card-ability assignments
- owned cards and gifts
- daily quests, Wordle attempts, Speed Calculus runs, and the Wordle dictionary

Not migrated:

- `pvp_matches`
- `pvp_match_events`
- `pvp_match_snapshots`
- `pvp_loadouts`

## Default Env Files

- source PWA env: `/home/zax/adventure-time-tcg/.env.postgres.production.local`
- target Phoenix env: `apps/phoenix/.env`

## Commands

Run from `apps/phoenix` after loading env vars:

```bash
set -a
source .env
set +a
MIX_ENV=dev mix pwa_import audit
MIX_ENV=dev mix pwa_import apply
MIX_ENV=dev mix pwa_import verify
```

Reports are written to `/home/zax/adventure-time-tcg/.migration-reports` by default.

## What `mix pwa_import apply` Does

1. audits source PWA tables needed by Phoenix
2. clears Phoenix placeholder/dev data
3. copies referenced card/profile media into the Phoenix MinIO bucket
4. imports non-PvP data into Phoenix with UUID-safe remapping where required
5. verifies final target counts

## Safety Notes

Before running apply against a target environment:

1. snapshot the Phoenix Postgres database
2. snapshot or version the Phoenix MinIO bucket if needed
3. run `mix pwa_import audit`
4. inspect the generated JSON report

## Key Mapping Notes

- PWA allowlist/admin semantics become Phoenix `users.role` plus `email_access_requests`
- existing PWA users import as `access_status = approved`
- PWA card types are normalized to the Phoenix canonical card taxonomy
- pending gifts are converted to Phoenix expiry-aware gift rows
- legacy PvP history is ignored on purpose
