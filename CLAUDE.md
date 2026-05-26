# CLAUDE.md

Repo-specific guidance for Claude Code and similar agents working in `adventure-time-tcg` after the Phoenix cutover.

## Mission

This repo now operates as a Phoenix-first backend and Expo mobile app workspace for the Adventure Time TCG.

Primary goals:
- keep the Phoenix backend healthy and production-ready
- preserve gameplay and mobile-facing contract behavior unless a change is intentional
- use the legacy PWA and the old Fastify API as reference sources, not target architecture
- keep shared mobile/runtime packages (`packages/api-client`, `packages/shared`, `packages/game-engine`) working until a later consolidation pass removes them deliberately

You are usually operating directly on the Arch Linux VPS that hosts the app.
Assume local environment setup, systemd work, Caddy work, PostgreSQL access, MinIO access, and Phoenix tooling are in scope when needed.

## Source Hierarchy

Use this order when behavior is unclear:
1. the current Phoenix implementation in this repo
2. the legacy PWA production data and codebase at `~/adventure-time-tcg`
3. the legacy Fastify implementation in `apps/api`
4. the backup repo copy at `/home/zax/adventure-time-tcg-backup-pre-phoenix-20260324-123939`

## Repo Shape

Apps:
- `apps/phoenix` - primary backend
- `apps/mobile` - Expo / React Native app
- `apps/api` - archived legacy Fastify reference only

Packages still in active use:
- `packages/api-client` - typed client used by mobile
- `packages/shared` - shared schemas, DTOs, and enums; not a UI translation home
- `packages/game-engine` - pure TS combat helpers used by mobile
- `packages/db` - legacy schema/migration reference

Architecture rules:
- mobile talks to the backend through `@adventure-time/api-client`
- shared request/response types stay in `@adventure-time/shared`
- mobile UI translations live in `apps/mobile/src/i18n/`
- do not put UI translation strings back into `packages/shared`
- Phoenix owns auth, persistence, uploads, jobs, and DB access
- `@adventure-time/game-engine` must stay pure and must not access DB, network, env, or filesystem
- Ecto migrations are the Phoenix source of truth

## Mobile Translations

UI translations are mobile-owned and live only in `apps/mobile/src/i18n/`.

Main files:
- `apps/mobile/src/i18n/index.ts`
- `apps/mobile/src/i18n/types.ts`
- `apps/mobile/src/i18n/locales/en/`
- `apps/mobile/src/i18n/locales/fr/`

Current feature files:
- `apps/mobile/src/i18n/locales/en/admin.ts`
- `apps/mobile/src/i18n/locales/en/auth.ts`
- `apps/mobile/src/i18n/locales/en/collection.ts`
- `apps/mobile/src/i18n/locales/en/combat.ts`
- `apps/mobile/src/i18n/locales/en/common.ts`
- `apps/mobile/src/i18n/locales/en/gifts.ts`
- `apps/mobile/src/i18n/locales/en/home.ts`
- `apps/mobile/src/i18n/locales/en/messages.ts`
- `apps/mobile/src/i18n/locales/en/nav.ts`
- `apps/mobile/src/i18n/locales/en/packs.ts`
- `apps/mobile/src/i18n/locales/en/pvp.ts`
- `apps/mobile/src/i18n/locales/en/quests.ts`
- `apps/mobile/src/i18n/locales/en/settings.ts`
- `apps/mobile/src/i18n/locales/en/time.ts`
- matching files under `apps/mobile/src/i18n/locales/fr/`

Translation rules:
- do not reintroduce the old `native.` prefix or split translations by platform
- add UI copy to feature files under `apps/mobile/src/i18n/locales/<locale>/`
- keep `en` and `fr` file structure aligned when adding or removing keys
- prefer feature scopes like `auth.*`, `packs.*`, `quests.*`, `quests.wordle.*`, `pvp.*`, `admin.*`, `combat.*`
- preserve dynamic key families that are composed at runtime, especially `quests.*`, `combat.*`, `pvp.reference.*`, `settings.stepSources.*`, `admin.*`, and `gifts.statusLabel.*`
- canonical backend/engine values stay raw in data; localize them at render time with display maps/helpers instead of changing stored values
- if a key is clearly unused after checking live consumers and dynamic families, remove it instead of leaving stale translation debt behind

## Commands

Run commands from the repo root unless a package-specific command is clearer.

Root:
- `npm run dev:api` - start Phoenix
- `npm run dev:mobile` - start the Expo dev server for development builds
- `npm run dev:mobile:ios` - install/run the local iOS development build
- `npm run dev:mobile:android` - install/run the local Android development build
- `npm run dev:mobile:tunnel` - start the Expo dev server for development builds with tunnel mode
- `npm run build:mobile:dev:android` - create an Android EAS development build
- `npm run build:mobile:dev:ios` - create a device-ready iOS development build; prefer local iOS builds unless the user explicitly asks for remote EAS builds
- `npm run build:mobile:dev:ios:simulator` - create an iOS simulator EAS development build
- `npm run build:mobile:ios:local` - create the production iOS `.ipa` locally with EAS local build
- `npm run build:mobile:android:local` - create the production Android `.aab` locally with EAS local build
- `npm run release:mobile:ios` - submit a locally built iOS artifact through EAS/TestFlight; do not use this to perform a remote iOS build
- `npm run release:mobile:android` - submit a locally built Android artifact through EAS/Google Play and then push the Play release note
- `npm run release:mobile -- --platform <ios|android|both> ...` - default mobile release entry point when the user asks to "release"
- `npm run build`
- `npm run typecheck`

Phoenix:
- `cd apps/phoenix && mix deps.get`
- `cd apps/phoenix && mix ecto.create`
- `cd apps/phoenix && mix ecto.migrate`
- `cd apps/phoenix && mix ecto.reset`
- `cd apps/phoenix && mix run priv/repo/seeds.exs`
- `cd apps/phoenix && mix phx.server`
- `cd apps/phoenix && mix test`
- `cd apps/phoenix && mix test test/path/to/file_test.exs`
- `cd apps/phoenix && mix format`
- `cd apps/phoenix && mix precommit`

PWA import:
- `cd apps/phoenix && set -a && source .env && set +a && MIX_ENV=dev mix pwa_import audit`
- `cd apps/phoenix && set -a && source .env && set +a && MIX_ENV=dev mix pwa_import apply`
- `cd apps/phoenix && set -a && source .env && set +a && MIX_ENV=dev mix pwa_import verify`

## Mobile Build And Release Policy

Production mobile builds must be local.

Rules:
- do not trigger remote EAS iOS builds unless the user explicitly asks for a remote build
- do not trigger remote EAS Android builds unless the user explicitly asks for a remote build
- when the user asks to "release", assume the workflow is build first and release second unless they explicitly say not to build
- when the user asks to "release iOS", assume the `.ipa` must be produced locally on this machine before EAS submission
- when the user asks to "release Android", assume the `.aab` must be produced locally on this machine before EAS submission
- when the user asks to release both platforms, handle Android and iOS in one pass unless they say otherwise
- always bump the app version/build metadata first as part of the release flow; do not skip version bumping unless the user explicitly asks to keep versions unchanged
- EAS is allowed for submission, metadata, TestFlight delivery, and Play upload after the local build artifact exists
- prefer the dedicated local paths: `npm run build:mobile:ios:local` followed by `npm run release:mobile:ios`, and the equivalent Android local build/release path
- Android releases require an appropriate Google Play release note; do not ship Android without one
- Android release notes should be based on the diff between the last released Android commit and the current release commit; use the latest `mobile/android/*` tag as the baseline
- keep iOS and Android release history independently via git tags because one platform may ship without the other; use the latest `mobile/ios/*` and `mobile/android/*` tags as the source of truth for the last released commit on each platform
- if a platform has no prior release tag yet, treat the current ship as the first true release for that platform and create the tag baseline during the release flow
- after a successful platform release, ensure the new per-platform release tag exists locally and remind the user to push tags so future agents can diff from the correct baseline
- use the `../cleantrack` release scripts as the local reference for expected release behavior on this MacBook when adapting or debugging the workflow
- the local iOS release path expects local signing material such as `apps/mobile/credentials.json` and the referenced Apple certificate/profile files
- the local Android release path expects the signing material, service account credentials, and release-note inputs needed by the release scripts
- if local signing material or App Store Connect identifiers are missing, stop and report the exact missing inputs instead of falling back to a remote build

## Production Data Migration Rules

The PWA is the production data source of truth.

The Phoenix importer intentionally migrates:
- users
- email credentials, email access requests, signup verification codes
- coins, dust, display name, preferred language, preferred step source
- cards, rarities, packs, abilities, card-ability assignments, and image assets
- owned cards and gifts
- daily quests, Wordle attempts, Speed Calculus runs, and the Wordle dictionary

The importer intentionally does not migrate:
- `pvp_matches`
- `pvp_match_events`
- `pvp_match_snapshots`
- `pvp_loadouts`

When touching migration code:
- keep the importer idempotent enough for reset-and-rerun workflows
- preserve report output in `.migration-reports/`
- keep placeholder/dev data cleanup explicit
- document any newly skipped or transformed legacy fields

## Verification

Primary verification is Phoenix-based now.

Before finishing backend work:
- run the narrowest relevant Phoenix tests
- run `mix format` if Elixir files changed
- run `mix precommit` for substantial Phoenix changes
- explicitly say what you could not verify

For mobile/shared changes:
- run `npm run typecheck`
- run targeted workspace typechecks or builds as needed

## Environment

Primary env files:
- Phoenix: `apps/phoenix/.env`
- mobile: `apps/mobile/.env`
- no archived legacy runtime env file should remain in-repo; keep any temporary historical copy outside the repo

Key Phoenix vars:
- `DATABASE_URL`
- `SECRET_KEY_BASE`
- `ACCESS_TOKEN_SECRET`
- `REFRESH_TOKEN_SECRET`
- `EMAIL_VERIFICATION_SECRET`
- `PHX_HOST`
- MinIO settings
- Google client IDs

Public app host should be:
- `https://app.leaetzak.love`

## Mobile Styling: NativeWind First

For mobile UI work, NativeWind must be the default styling system.
Always prefer `className` utilities first.
Avoid React Native `style` props unless they are truly required.
If a `style` prop is necessary, keep it minimal and prefer theme tokens over raw literals.

Use semantic classes first:
- `bg-bg`, `text-fg`, `bg-surface`, `bg-surfaceMuted`
- `text-fgMuted`, `border-primaryBorder`, `bg-primaryTint`
- `text-primaryText`, `text-dangerDark`, `bg-infoTint`
- Nunito font utilities from `apps/mobile/tailwind.config.js`

Acceptable `style` use cases:
- gradients
- blur views
- animated transforms
- measured dimensions
- safe-area math
- `contentContainerStyle`
- placeholder colors

## Theme System

Main files:
- `apps/mobile/src/stores/theme-store.ts`
- `apps/mobile/src/theme/themes.ts`
- `apps/mobile/global.css`
- `apps/mobile/tailwind.config.js`
- `apps/mobile/app/_layout.tsx`

Theme rules:
- keep `global.css` and `themes.ts` aligned when tokens change
- use `THEME_COLORS[themeName]` for JS-only values
- use `THEME_VARS[themeName]` for root/full-screen themed containers when needed
- do not invent new font utility names; use the existing Nunito aliases only

## Imports, Formatting, and Types

Import order:
1. external packages
2. workspace aliases like `@adventure-time/*`
3. local relative imports

Other rules:
- use `import type` when practical
- prefer workspace aliases instead of deep relative cross-workspace imports
- remove unused imports
- TypeScript is strict
- use semicolons and double quotes in TS files
- use trailing commas in multiline structures
- keep files ASCII unless Unicode is already justified
- avoid `any`; prefer narrower types and validation

## Working Style

Before editing:
- inspect neighboring files and match local conventions
- prefer targeted changes over broad churn
- preserve Phoenix context boundaries
- treat `apps/api` and the PWA as reference material unless the task explicitly targets them
- inspect active services, listeners, and reverse proxy wiring before changing host-level infra

Before finishing:
- commit each completed change or logical change set before moving on
- report what changed
- report verification performed
- call out contract changes, migration implications, or operational follow-up

## Docs Sync

`AGENTS.md` is the canonical template.
After updating it, mirror the same structure and state into `CLAUDE.md`, keeping only the document title and one-line intro intentionally different.
