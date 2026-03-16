# AGENTS.md

Guidance for coding agents working in `adventure-time-native`.

You are typically operating on the Arch Linux VPS that hosts both the legacy PWA and the native app server.
You have sudo access on that machine.

This repository is a native-first rebuild of `~/adventure-time-tcg`.
The goal is parity with the original project where appropriate, but this repo is not complete yet.
Prefer changes that preserve gameplay, data contracts, naming, and UX intent from the original app while fitting the native stack.

## Project shape

Monorepo with npm workspaces:

- `apps/api` - Fastify REST API
- `apps/mobile` - Expo / React Native app
- `packages/db` - Drizzle schema, migrations, db client
- `packages/shared` - Zod schemas and shared DTOs
- `packages/game-engine` - pure combat and PvP engine
- `packages/api-client` - typed API client used by mobile

Core architecture rules:

- Mobile talks to the backend through `@adventure-time/api-client`
- Shared request/response schemas live in `@adventure-time/shared`
- API owns I/O, auth, persistence, uploads, and DB access
- `@adventure-time/game-engine` stays pure and must not access the DB or network
- Drizzle schema is the source of truth for database structure

## Commands

Run commands from the repo root unless a package-specific command is clearer.

### Root commands

- `npm run dev:api` - start the Fastify API in watch mode
- `npm run dev:mobile` - start Expo dev server
- `npm run dev:mobile:tunnel` - start Expo with tunnel mode
- `npm run build` - run build scripts across workspaces that define one
- `npm run typecheck` - run typecheck across workspaces
- `npm run lint` - runs workspace lint scripts if present; currently no workspace defines `lint`
- `npm run db:generate` - generate Drizzle migrations
- `npm run db:migrate` - apply Drizzle migrations
- `npm run db:repair-history -w @adventure-time/db` - backfill `drizzle.__drizzle_migrations` for older already-bootstrapped dev databases

### Workspace commands

API:

- `npm run dev -w @adventure-time/api`
- `npm run build -w @adventure-time/api`
- `npm run typecheck -w @adventure-time/api`

Mobile:

- `npm run dev -w @adventure-time/mobile`
- `npm run dev:tunnel -w @adventure-time/mobile`
- `npm run typecheck -w @adventure-time/mobile`

Shared packages:

- `npm run typecheck -w @adventure-time/db`
- `npm run typecheck -w @adventure-time/shared`
- `npm run typecheck -w @adventure-time/game-engine`
- `npm run typecheck -w @adventure-time/api-client`

DB package:

- `npm run db:generate -w @adventure-time/db`
- `npm run db:migrate -w @adventure-time/db`

### Tests

Current state:

- There is no configured test runner
- There are no `test` scripts in workspace `package.json` files
- There are no `*.test.*` or `*.spec.*` files in the repo

Implications:

- There is currently no supported command for "run all tests"
- There is currently no supported command for "run a single test"

If you add tests in the future:

- add a root-level `test` command
- add workspace-level `test` commands
- document the exact single-test invocation here
- prefer a runner with easy single-file and single-case execution

Until then, use:

- targeted `npm run typecheck`
- targeted package builds where available
- manual API/mobile verification for changed flows

## Environment

API env file: `apps/api/.env`
Mobile env file: `apps/mobile/.env`

Key API env vars include:

- `PORT`
- `HOST`
- `DATABASE_URL`
- `ACCESS_TOKEN_SECRET`
- `REFRESH_TOKEN_SECRET`
- MinIO settings

Local infrastructure used by the native app:

- Database: PostgreSQL
- The documented local `DATABASE_URL` points to `postgresql://postgres:postgres@127.0.0.1:5434/adventure_time_native`
- MinIO endpoint is configured separately via env vars
- MinIO port is `9100`

Key mobile env var:

- `EXPO_PUBLIC_API_BASE_URL`

Do not hardcode secrets.
Do not commit env values.

## Import conventions

Match the existing import grouping:

1. external packages
2. workspace alias imports like `@adventure-time/*`
3. local relative imports

Examples:

- external first: `fastify`, `react-native`, `drizzle-orm`
- package aliases next: `@adventure-time/db`, `@adventure-time/shared`
- local files last: `../services/...`, `./lib/...`

Other import rules:

- use `import type` for type-only imports when practical
- prefer package aliases instead of deep relative imports across workspaces
- keep imports stable and grouped with a blank line between groups
- do not introduce unused imports

## Formatting and syntax

Infer style from the current codebase:

- TypeScript with `strict: true`
- semicolons required
- double quotes, not single quotes
- trailing commas in multiline structures
- keep line length reasonable; wrap long object literals and call sites
- prefer small helper functions over deeply nested inline logic
- avoid comments unless they clarify non-obvious logic
- keep files ASCII unless the file already needs Unicode data

There is no dedicated Prettier or ESLint config checked in right now.
Follow the style already present in neighboring files.

## TypeScript guidelines

- prefer explicit domain types at module boundaries
- validate external input with Zod
- infer TS types from Zod schemas in `packages/shared`
- avoid `any`; use it only when unavoidable and keep scope small
- prefer `unknown` plus parsing/validation over unchecked casting
- use narrow unions for status values and action kinds
- keep DTOs serializable and stable across API/mobile boundaries

Patterns already used in the repo:

- `export const fooSchema = z.object(...)`
- `export type Foo = z.infer<typeof fooSchema>`

## Naming conventions

Use existing repo naming:

- files: kebab-case, e.g. `auth-service.ts`, `pvp-loadouts.ts`
- React components: PascalCase
- hooks: `useSomething`
- stores: `something-store.ts`
- route registration functions: `authRoutes`, `questRoutes`
- service modules: `*-service.ts`
- Zod exports: `somethingSchema`, `somethingResponseSchema`
- DB tables: plural camelCase TS identifiers mapped to snake_case SQL names

General naming:

- prefer descriptive nouns for data
- prefer verbs for actions
- avoid abbreviations unless they are already domain standard (`pvp`, `db`, `api`)

## API conventions

Fastify routes should stay thin.

Route layer responsibilities:

- parse params/body with shared Zod schemas where possible
- read auth context
- call service/query helpers
- map expected failures to sensible HTTP codes
- return JSON-safe values

Service layer responsibilities:

- business rules
- DB mutations and transactions
- orchestration of auth, combat, rewards, and media flows

Error handling:

- expected user-facing failures should produce clear messages
- use custom error classes only when they materially improve status/code handling
- let unexpected failures reach the server error handler
- do not swallow real errors silently unless the endpoint is intentionally best-effort

## Shared schema conventions

`packages/shared` is the contract source of truth.

When adding or changing an endpoint:

1. add or update the Zod schema in `packages/shared`
2. export inferred TS types from the same file if useful
3. parse request input in the API with that schema
4. parse response payloads in `packages/api-client`
5. update mobile usage through the typed client

Do not create duplicate DTO definitions in multiple packages.

## Database and Drizzle conventions

- use Drizzle schema in `packages/db/src/schema.ts`
- prefer Drizzle query builders over raw SQL
- keep SQL names snake_case and TS fields camelCase
- set `updatedAt: new Date()` on mutable writes where the table tracks it
- generate IDs in app code when following existing patterns
- serialize `Date` values to ISO strings before returning API JSON
- use transactions for multi-step writes that must stay consistent

After schema changes:

- run `npm run db:generate`
- review generated migration SQL
- run `npm run db:migrate`

## Game engine rules

`packages/game-engine` must remain pure.

Never add:

- DB access
- Fastify types
- filesystem I/O
- network calls
- env access

The API should hydrate plain objects, call the engine, then persist results.

## Mobile conventions

- screens live under `apps/mobile/app`
- shared UI lives under `apps/mobile/src/components`
- server state uses React Query
- session/global auth state uses Zustand
- routing uses Expo Router
- preserve existing visual direction unless intentionally redesigning a screen

When changing mobile features:

- prefer typed API calls through `apiClient`
- keep loading/error/empty states explicit
- reuse shared UI components before creating new one-off patterns

## Data hygiene

- normalize emails with `.toLowerCase()`
- keep API payloads JSON-safe
- do not leak raw DB rows directly to clients
- avoid mixing DB-only types with client DTOs
- preserve backward-compatible response shapes unless the task explicitly changes them

## Rules files

Checked for agent-specific repo rules:

- no `.cursorrules`
- no `.cursor/rules/`
- no `.github/copilot-instructions.md`

If any of those files are added later, merge their instructions into this document.

## Working style for agents

Before editing:

- inspect neighboring files and follow local patterns
- prefer minimal, targeted changes
- preserve architecture boundaries across workspaces

Before finishing:

- run the narrowest relevant verification commands
- at minimum run `npm run typecheck` for touched workspaces
- run builds where the touched workspace defines a build script
- explicitly note when something could not be verified

If behavior in this repo differs from `~/adventure-time-tcg`, prefer documenting the mismatch and preserving the native repo's current architecture unless the task is specifically about parity.
