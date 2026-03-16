# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Adventure Time Native is a native-first rebuild of [~/adventure-time-tcg](../adventure-time-tcg) — a TCG mobile game. It's migrating from a PWA to a native stack (React Native + Fastify API). **The clone is not finished and the design does not match the original yet.**

## Commands

Run commands from the repo root unless a package-specific command is clearer.

```bash
# Development
npm run dev:api          # Start API server (tsx watch)
npm run dev:mobile       # Start Expo dev server
npm run dev:mobile:tunnel  # Start Expo in tunnel mode

# Build & Type Check
npm run build            # Build all workspaces
npm run typecheck        # Type check all workspaces
npm run lint             # Lint all workspaces

# Database
npm run db:generate      # Generate Drizzle migrations
npm run db:migrate       # Run migrations
npm run db:repair-history -w @adventure-time/db  # Repair missing drizzle.__drizzle_migrations rows on older dev DBs

# Workspace-specific checks
npm run build -w @adventure-time/api
npm run typecheck -w @adventure-time/api
npm run typecheck -w @adventure-time/mobile
npm run typecheck -w @adventure-time/db
npm run typecheck -w @adventure-time/shared
npm run typecheck -w @adventure-time/game-engine
npm run typecheck -w @adventure-time/api-client
```

There is currently no configured test runner in this repo. Until that changes, prefer targeted typechecks, package builds, and manual API/mobile verification for changed flows.

Use `npm run db:repair-history -w @adventure-time/db` only for older already-bootstrapped dev databases whose schema already matches the checked-in migrations but whose `drizzle.__drizzle_migrations` rows are missing or incomplete.

## Architecture

Npm workspace monorepo with two apps and four shared packages:

```
apps/api           Fastify REST API (port 4100, behind Caddy)
apps/mobile        React Native / Expo app

packages/db              Drizzle schema, migrations, db client
packages/shared          Zod schemas & DTOs shared across all apps
packages/game-engine     Combat simulation, PvP contracts, replay
packages/api-client      Typed fetch client used by mobile
```

**Data flow**: Mobile → `api-client` (typed fetch) → Fastify routes → services → Drizzle → PostgreSQL. MinIO stores card/profile images.

**Auth**: JWT (jose) with access + refresh tokens. Mobile stores tokens in Expo Secure Store via `session-store.ts`. API validates via `plugins/auth.ts` Fastify plugin.

**Game logic** lives entirely in `packages/game-engine` — it's pure TypeScript with no I/O dependencies. The combat engine is the core: `types → rng → speed → damage → effects → targeting → abilities → validate`. PvP routes in the API delegate to this engine and persist replay data.

**Mobile routing**: Expo Router (file-based). Tabs layout at `app/(tabs)/`. Auth gate in root `_layout.tsx` via `use-bootstrap.ts` hook. Data fetching with React Query; global state with Zustand.

## Environment

API `.env` (at `apps/api/.env`):

```
PORT=4100
HOST=127.0.0.1
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5434/adventure_time_native
ACCESS_TOKEN_SECRET=...
REFRESH_TOKEN_SECRET=...
MINIO_ENDPOINT=127.0.0.1
MINIO_PORT=9100
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minio
MINIO_SECRET_KEY=...
MINIO_BUCKET=private-images
DEEPL_API_KEY=...
```

Mobile `.env` (at `apps/mobile/.env`):

```
EXPO_PUBLIC_API_BASE_URL=https://app.leaetzak.love
```

## Key Conventions

- **Shared types first**: Add new DTOs/validation to `packages/shared` so both API and mobile stay in sync.
- **Zod everywhere**: All API route bodies/params are Zod-validated. `packages/shared` exports the schemas; `packages/api-client` mirrors them for the mobile side.
- **Game engine is pure**: No DB calls inside `packages/game-engine`. The API service layer hydrates data, passes plain objects to the engine, then persists results.
- **Drizzle, not raw SQL**: Schema is the source of truth in `packages/db/src/schema.ts`. Run `db:generate` after schema changes.
- **Path aliases**: Packages are imported as `@adventure-time/db`, `@adventure-time/shared`, etc.
