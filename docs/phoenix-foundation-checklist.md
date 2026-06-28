# Phoenix Foundation Checklist

This checklist is retained as historical context for the initial Phoenix foundation slice that replaced the legacy Node backend.

## Historical Foundation Decisions

- Phoenix app path: `apps/phoenix`
- OTP app: `adventure_time_api`
- Elixir module root: `AdventureTimeApi`
- Dev HTTP port: `127.0.0.1:4200`
- Dev PostgreSQL target: `127.0.0.1:5434/adventure_time_tcg`
- The old Node API on `127.0.0.1:4100` has now been retired from production use.

## Initial Slice Scope

The first Phoenix slice made the mobile app usable before the broader cleanup and archive pass.

### Core Endpoints That Had To Land

- `POST /auth/register`
- `POST /auth/verify-email`
- `POST /auth/resend-verification`
- `POST /auth/login`
- `POST /auth/google`
- `POST /auth/refresh`
- `GET /me`
- `GET /home`
- `GET /collection`
- `GET /packs`
- `POST /packs/open`
- `GET /daily-claim`
- `POST /daily-claim`
- `GET /featured-cards`
- `GET /rarities`
- `GET /media/card/:asset_id`
- `GET /media/profile/:asset_id`

### Contract Rules Preserved

- login/refresh/google responses remain `{ user, tokens }`
- registration requires email verification and superadmin approval before login succeeds
- `/me` returns the full mobile `AuthUser` shape
- daily claim conflict remains `409` with code `DAILY_ALREADY_CLAIMED`
- pack open response keeps `{ pack, cards, newBalance }`
- collection entries include nested card and rarity data

### Foundation Outcomes

- Phoenix schema, auth, catalog, inventory, quests, gifts, and media slices landed
- production PWA data migration moved into Phoenix-native tooling
- PvP history was intentionally excluded from migration
- Phoenix now serves the live backend at `https://app.leaetzak.love`
- `apps/api` remains only as an archive/reference source

### Follow-Up Work After Foundation

- smoke-test mobile flows against `https://app.leaetzak.love`
- remove stale migration-era docs and workspace references
- keep only the minimum legacy archive surface needed for future reference
