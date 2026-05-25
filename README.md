# Adventure Time TCG

`adventure-time-tcg` is the active production workspace for the Adventure Time TCG mobile app and Phoenix backend.

The Phoenix API is now the main backend. The legacy PWA and the old Fastify API remain in the repo as migration/reference material, not as the primary development target.

## Rename Note

This repository was renamed from `adventure-time-native` to `adventure-time-tcg`.

Current canonical names and paths:

- GitHub repo: `Zax-code/adventure-time-tcg`
- local checkout: `/home/zax/adventure-time-tcg`
- host data directory: `/srv/adventure-time-tcg`
- checked-in Phoenix unit template: `infra/systemd-adventure-time-tcg-api.service`

## Current Status

- Phoenix owns the live backend architecture and database schema.
- The mobile app targets the Phoenix HTTP API.
- Production data migration now uses the Phoenix-native `mix pwa_import` workflow.
- PvP history from the legacy stack is intentionally not migrated.
- `apps/api` is kept only as an archived behavior/reference copy.

## Repo Layout

Apps:

- `apps/phoenix` - Phoenix JSON API
- `apps/mobile` - Expo / React Native app
- `apps/api` - archived legacy Fastify API reference

Packages still used by mobile/runtime code:

- `packages/api-client` - typed client used by mobile
- `packages/shared` - shared DTOs and enums; no longer owns UI translations
- `packages/game-engine` - pure TypeScript combat helpers used by mobile
- `packages/db` - legacy Drizzle schema and migration history reference

Infrastructure helpers:

- `infra/caddy` - Caddy site snippets
- `infra/scripts` - host and local helper scripts
- `infra/systemd-adventure-time-tcg-api.service` - checked-in Phoenix service template

## Primary Commands

From the repo root:

```bash
npm run dev:api
npm run dev:mobile
npm run dev:mobile:tunnel
npm run build
npm run typecheck
```

What they do:

- `npm run dev:api` - start Phoenix
- `npm run dev:mobile` - start Expo Go
- `npm run dev:mobile:tunnel` - start Expo Go with tunnel mode

## Mobile Translations

Mobile UI translations are now owned entirely by the Expo app and live in `apps/mobile/src/i18n/`.

Main translation entry points:

- `apps/mobile/src/i18n/index.ts`
- `apps/mobile/src/i18n/types.ts`
- `apps/mobile/src/i18n/locales/en/`
- `apps/mobile/src/i18n/locales/fr/`

Feature-based locale files currently include:

- `admin.ts`
- `auth.ts`
- `collection.ts`
- `combat.ts`
- `common.ts`
- `gifts.ts`
- `home.ts`
- `messages.ts`
- `nav.ts`
- `packs.ts`
- `pvp.ts`
- `quests.ts`
- `settings.ts`
- `time.ts`

Notes:

- the old split between shared legacy translations and mobile-native translations has been removed
- the old `native.` namespace is gone; use unified feature namespaces instead
- do not add UI translations back to `packages/shared`
- when adding copy, update both `en` and `fr`
- preserve dynamic/runtime-composed families such as `quests.*`, `combat.*`, `pvp.reference.*`, `settings.stepSources.*`, `admin.*`, and `gifts.statusLabel.*`
- canonical backend or engine values should stay raw in data and be localized at render time via display maps/helpers

## Phoenix Workflow

From `apps/phoenix`:

```bash
mix deps.get
mix ecto.create
mix ecto.migrate
mix ecto.reset
mix run priv/repo/seeds.exs
mix phx.server
mix test
mix test test/adventure_time_api_web/controllers/health_controller_test.exs
mix format
mix format --check-formatted
mix precommit
```

Load env vars before running Phoenix commands that depend on secrets:

```bash
cd apps/phoenix
set -a
source .env
set +a
```

## Production Data Migration

Phoenix now owns the PWA import flow.

Default source of truth:

- source PWA env: `/home/zax/adventure-time-tcg/.env.postgres.production.local`
- target Phoenix env: `apps/phoenix/.env`

Commands:

```bash
cd apps/phoenix
set -a
source .env
set +a
MIX_ENV=dev mix pwa_import audit
MIX_ENV=dev mix pwa_import apply
MIX_ENV=dev mix pwa_import verify
```

What the importer migrates:

- users, roles, access requests, verification codes, and email credentials
- rarities, cards, packs, abilities, card-ability assignments, and media assets
- owned cards and gifts
- daily quests, Wordle attempts, Speed Calculus runs, and the Wordle dictionary

What it does not migrate:

- `pvp_matches`
- `pvp_match_events`
- `pvp_match_snapshots`
- `pvp_loadouts`

The importer clears Phoenix placeholder/dev data before applying production rows.

## Environment

Key env files:

- Phoenix: `apps/phoenix/.env`
- mobile: `apps/mobile/.env`
- no archived legacy runtime env file should remain in-repo; keep any temporary historical copy outside the repo

Important mobile env value:

```bash
EXPO_PUBLIC_API_BASE_URL=https://app.leaetzak.love
```

Important Phoenix env values include:

- `DATABASE_URL`
- `SECRET_KEY_BASE`
- `ACCESS_TOKEN_SECRET`
- `REFRESH_TOKEN_SECRET`
- `EMAIL_VERIFICATION_SECRET`
- `PHX_HOST`
- MinIO settings
- Google auth client IDs

## Verification

Phoenix is the primary verification target now.

Recommended checks:

```bash
cd apps/phoenix
set -a
source .env
set +a
mix test
mix precommit
```

For mobile/shared changes, also run:

```bash
npm run typecheck
npm run build
npm run typecheck -w @adventure-time/mobile
```

## Operational Notes

- Caddy should proxy `app.leaetzak.love` to Phoenix on `127.0.0.1:4200`.
- The checked-in Caddy snippet lives at `infra/caddy/app.leaetzak.love.Caddyfile`.
- The checked-in Phoenix systemd unit template lives at `infra/systemd-adventure-time-tcg-api.service`.
- `apps/api` remains on disk as archive-only reference material and is no longer part of active workspace tooling.

## Development Guidance

- preserve gameplay and contract parity unless a change is intentional and documented
- keep Phoenix controllers thin and business rules in contexts/domain modules
- keep mobile talking to the backend through `@adventure-time/api-client`
- keep `@adventure-time/game-engine` pure
- treat the legacy PWA and `apps/api` as reference sources, not the target architecture
