# Adventure Time Native

`adventure-time-native` is a native-first rebuild of the Adventure Time TCG.
It replaces the legacy PWA stack with an Expo / React Native client, a Fastify API, shared typed packages, and a pure TypeScript game engine.

This repo is still an in-progress rewrite, not a finished replacement.
The legacy PWA remains the behavior and UX reference:

- Native repo: `https://github.com/Zax-code/adventure-time-native`
- Legacy PWA repo: `https://github.com/Zax-code/adventure-time-tcg`

## Current Status

The project is well past the original scaffold stage.
Today the repo contains a playable app surface, a production-style API, shared contracts, and admin tooling.

When making changes, the goal is parity with the PWA where it matters most:

- gameplay rules
- API contracts
- naming and reward logic
- user-facing flow intent

## What Players Can Do Today

The current mobile app already supports real game flows, including:

- email/password auth and Google sign-in
- session bootstrap and authenticated app shell
- home dashboard with daily reward and collection progress
- pack browsing and pack opening
- searchable collection and card detail views
- quests, including Wordle and Speed Calculus
- PvP invites, loadouts, live matches, and spectating
- gifting and social flows
- settings for avatar, language, theme, and health-step source

## Admin Features

The repo also includes admin surfaces for:

- card management
- featured/archive state management
- ability management and translation workflows
- user management and approval flows

## Monorepo Structure

Apps:

- `apps/api` - Fastify REST API
- `apps/mobile` - Expo / React Native app

Packages:

- `packages/db` - Drizzle schema, migrations, DB client
- `packages/shared` - Zod schemas and shared DTOs
- `packages/game-engine` - pure combat and PvP engine
- `packages/api-client` - typed API client used by mobile

Infrastructure and host helpers:

- `infra/caddy` - Caddy snippets
- `infra/containers/quadlet` - Podman / systemd templates
- `infra/scripts` - host and local helper scripts

## Tech Stack

- mobile: Expo, React Native, Expo Router, NativeWind, React Query, Zustand
- API: Fastify, Zod, JWT auth, multipart uploads
- data: PostgreSQL, Drizzle ORM, MinIO-compatible object storage
- shared code: TypeScript workspaces, shared schemas, pure game engine

## Prerequisites

- Node `22.14.0` from `.nvmrc`
- npm workspaces
- PostgreSQL
- MinIO or another S3-compatible local object store

The mobile dev script uses `infra/scripts/expo-go.sh`, which switches to the repo-pinned Node runtime because Expo is not stable on newer Node versions on the target host.

## Environment Setup

1. Install dependencies:

```bash
npm install
```

2. Create env files from the examples:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/mobile/.env.example apps/mobile/.env
```

3. Fill in the required secrets and service configuration.

Important API env values include:

- `PORT`
- `HOST`
- `DATABASE_URL`
- `ACCESS_TOKEN_SECRET`
- `REFRESH_TOKEN_SECRET`
- MinIO settings
- optional Google auth values

Important mobile env values include:

- `EXPO_PUBLIC_API_BASE_URL`
- optional Google client IDs

The documented local database URL is:

```bash
postgresql://postgres:postgres@127.0.0.1:5434/adventure_time_native
```

The documented MinIO defaults are:

- endpoint: `127.0.0.1`
- port: `9100`
- bucket: `private-images`

## Database Setup

Generate and apply migrations from the repo root:

```bash
npm run db:generate
npm run db:migrate
```

If you are working with an older dev database that already matches the schema but is missing rows in `drizzle.__drizzle_migrations`, repair the history with:

```bash
npm run db:repair-history -w @adventure-time/db
```

Use that repair command only for an already-bootstrapped database whose tables already match the checked-in migrations.

## Run The App

Start the API:

```bash
npm run dev:api
```

Start the mobile app:

```bash
npm run dev:mobile
```

Start the mobile app with Expo tunnel mode:

```bash
npm run dev:mobile:tunnel
```

Useful workspace commands:

```bash
npm run build
npm run typecheck
npm run build -w @adventure-time/api
npm run typecheck -w @adventure-time/api
npm run typecheck -w @adventure-time/mobile
npm run typecheck -w @adventure-time/db
npm run typecheck -w @adventure-time/shared
npm run typecheck -w @adventure-time/game-engine
npm run typecheck -w @adventure-time/api-client
```

## Mobile Notes

The mobile app uses NativeWind as its primary styling system and a runtime theme system built from CSS variables plus JS theme tokens.
It currently ships multiple themes and uses shared semantic color tokens across screens.

Expo tunnel mode is especially useful when running the mobile dev server on a remote VPS instead of your local network.
The helper script also cleans up stale ngrok processes and installs `@expo/ngrok` for the active Node runtime if needed.

## Architecture Notes

A few boundaries matter across the repo:

- mobile talks to the backend through `@adventure-time/api-client`
- shared request and response schemas live in `@adventure-time/shared`
- the API owns auth, persistence, uploads, and DB access
- `@adventure-time/game-engine` stays pure and must not access DB, network, env, or filesystem
- Drizzle schema is the DB source of truth

## Verification

There is currently no configured test runner in this repo.
There are no `test` scripts and no supported command for running all tests or a single test.

Until a test runner exists, verify changes with:

- targeted workspace typechecks
- targeted builds where available
- manual API and mobile flow checks for touched behavior

Recommended checks:

```bash
npm run typecheck
npm run build
npm run typecheck -w @adventure-time/mobile
npm run typecheck -w @adventure-time/api
npm run build -w @adventure-time/api
```

## Self-Hosting Notes

This repo includes host-facing infrastructure helpers, but they are optional for local development:

- `infra/caddy` for Caddy configuration
- `infra/containers/quadlet` for container service templates
- `infra/scripts` for host bootstrap and dev helpers

## Current Constraints

- the rewrite is still in progress
- the legacy PWA is still the main parity reference
- there is no formal test runner yet
- some local and hosted flows depend on PostgreSQL, MinIO, and Expo tunnel behavior being configured correctly

## Contributing Mindset

If you are extending the app, prefer changes that preserve parity with the PWA while still fitting the native stack cleanly.
When in doubt, keep the gameplay and contract behavior aligned first, then improve implementation details around it.
