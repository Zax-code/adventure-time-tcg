# AGENTS.md

Guidance for coding agents working in `adventure-time-tcg` after the Phoenix cutover.

## Mission

This repo now operates as a Phoenix-first backend and Expo mobile app workspace for the Adventure Time TCG.

Primary goals:
- keep the Phoenix backend healthy and production-ready
- preserve gameplay and mobile-facing contract behavior unless a change is intentional
- use the legacy PWA and the old Fastify API as reference sources, not target architecture
- keep shared mobile/runtime packages (`packages/api-client`, `packages/contracts`, `packages/game-engine`) working until a later consolidation pass removes them deliberately

You are usually operating directly on the Arch Linux VPS that hosts the app.
Assume local environment setup, systemd work, Caddy work, PostgreSQL access, MinIO access, and Phoenix tooling are in scope when needed.

## Source Hierarchy

Use this order when behavior is unclear:
1. the current Phoenix implementation in this repo
2. the legacy PWA production data and codebase at `~/adventure-time-tcg-pwa` or `~/Develop/adventure-time-tcg-pwa`
3. the legacy Fastify implementation in `apps/api`

## Repo Shape

Apps:
- `apps/phoenix` - primary backend
- `apps/mobile` - Expo / React Native app
- `apps/api` - archived legacy Fastify reference only

Packages still in active use:
- `packages/api-client` - typed client used by mobile
- `packages/contracts` - backend/mobile wire schemas, DTOs, and enums
- `packages/game-engine` - pure TS combat helpers used by mobile
- `packages/db` - legacy schema/migration reference

Architecture rules:
- mobile talks to the backend through `@adventure-time/api-client`
- request/response contracts live in `@adventure-time/contracts` and are re-exported by `@adventure-time/api-client`
- mobile UI translations live in `apps/mobile/src/i18n/`
- do not put UI translation strings into `packages/contracts`
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
- `cd apps/mobile && npx expo-doctor` - validate Expo dependency, config, and checked-native-project health; add `--verbose` when investigating a failure
- `npm run build:mobile:dev:android` - create an Android EAS development build
- `npm run build:mobile:dev:ios` - create a device-ready iOS development build; prefer local iOS builds unless the user explicitly asks for remote EAS builds
- `npm run build:mobile:dev:ios:simulator` - create an iOS simulator EAS development build
- `npm run build:mobile:ios:local` - create the production iOS `.ipa` locally with EAS local build
- `npm run build:mobile:android:local` - create the production Android `.aab` locally with EAS local build
- `npm run release:mobile:ios` - build a local iOS `.ipa` and upload it directly to App Store Connect/TestFlight with Apple's local tooling
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

## Maestro E2E

Use Maestro for mobile smoke tests and targeted interaction validation, especially for Expo development-client and PvP regressions.

Main project files:
- `.maestro/` - shared Maestro flows and subflows committed to the repo
- `scripts/maestro.sh` - wrapper that injects auth/session state and fixture ids into flows
- `apps/mobile/app/e2e-auth.tsx` - in-app test auth bridge used by deep links
- `apps/phoenix/scripts/ensure-mobile-test-pvp-fixture.sh` - deterministic PvP fixture creator for mobile E2E runs

Prerequisites:
- install Maestro CLI if needed with `curl -fsSL https://get.maestro.mobile.dev | bash`
- start the Phoenix backend before running flows with `npm run dev:api`
- the iOS E2E build and simulator flows expect Phoenix at `http://127.0.0.1:4200`
- the Android E2E build and emulator flows expect Phoenix at `http://10.0.2.2:4200`
- export `MOBILE_TEST_PASSWORD='<password>'` before running the wrapper; set `MOBILE_TEST_EMAIL` too only if you intentionally need a non-default test user

Core commands:
- `npm run build:mobile:e2e:ios` - build the local iOS E2E app artifact
- `npm run install:mobile:e2e:ios` - install the local iOS E2E app on the booted simulator
- `npm run build:mobile:e2e:android` - build the local Android E2E app artifact
- `npm run install:mobile:e2e:android` - install the local Android E2E app on the connected emulator/device
- `npm run test:mobile:e2e:ios` - run the general iOS Maestro smoke flow
- `npm run test:mobile:e2e:android` - run the general Android Maestro smoke flow
- `npm run test:mobile:e2e:pvp:ios` - run the iOS PvP smoke flow
- `npm run test:mobile:e2e:pvp:android` - run the Android PvP smoke flow
- `MOBILE_TEST_PASSWORD='<password>' ./scripts/maestro.sh test --platform ios .maestro/<flow>.yaml` - run a specific iOS flow directly through the project wrapper
- `MOBILE_TEST_PASSWORD='<password>' ./scripts/maestro.sh test --platform android .maestro/<flow>.yaml` - run a specific Android flow directly through the project wrapper

Recommended iOS loop:
- `MOBILE_TEST_PASSWORD='<password>' npm run build:mobile:e2e:ios`
- `npm run install:mobile:e2e:ios`
- `MOBILE_TEST_PASSWORD='<password>' ./scripts/maestro.sh test --platform ios .maestro/<flow>.yaml`

What the wrapper actually does:
- `scripts/maestro.sh` first runs `apps/phoenix/scripts/ensure-mobile-test-user.sh` so the requested `MOBILE_TEST_EMAIL` exists with the supplied password before login
- `scripts/maestro.sh` logs the mobile test user into Phoenix at `http://127.0.0.1:4200/auth/login`
- it injects `${TEST_EMAIL}`, `${TEST_PASSWORD}`, `${TEST_ACCESS_TOKEN}`, `${TEST_REFRESH_TOKEN}`, and `${TEST_USER}` into a temporary `.maestro/.maestro-flow.*.yaml` copy before invoking Maestro
- if the target flow contains `${TEST_MATCH_ID}`, the wrapper first runs `apps/phoenix/scripts/ensure-mobile-test-pvp-fixture.sh` and injects the returned match id too
- use the wrapper or the npm scripts that call it unless you deliberately want to bypass auth and fixture injection

Project rules:
- always run Maestro through `scripts/maestro.sh` or the npm scripts that call it; do not call raw `maestro test` for this repo unless you intentionally want to bypass auth/fixture injection
- set `MOBILE_TEST_PASSWORD` before Maestro runs; the wrapper uses it both for backend login and for the Phoenix test-user/fixture scripts
- prefer the committed flows in `.maestro/` and add new reusable flows there when they are generally useful
- do not commit generated `.maestro/.maestro-flow.*` files; they are temporary token-injected copies created by the wrapper and are gitignored
- keep Maestro screenshots, logs, and local build artifacts out of commits unless the user explicitly asks for them

Artifacts and troubleshooting:
- inspect Maestro run logs, hierarchy dumps, and failure screenshots under `~/.maestro/tests/<timestamp>/`
- `takeScreenshot` outputs land in the current working directory, so run flows from the repo root if you want predictable screenshot locations
- `npm run install:mobile:e2e:ios` now prefers the fresh archive at `apps/mobile/local-build/ios-e2e.tar.gz`; pass `--archive <path>` only when you intentionally want a different artifact
- the iOS `e2e-ios` profile is a `Release` simulator build and must boot from the embedded `main.jsbundle`; if the app opens the dev client or references Metro on port `8097`, rebuild with `npm run build:mobile:e2e:ios` and reinstall
- when a flow reaches the right screen but behavior still seems wrong, inspect the saved screenshots before changing app code; that is how the Wordle scroll-keyboard hit-testing bug was isolated
- for persistent server-side quest state like Wordle, prefer a fresh `MOBILE_TEST_EMAIL` for each validation pass, for example `MOBILE_TEST_EMAIL=wordle-e2e-$(date +%s)@leaetzak.love`

Screenshot capture workflow:
- when a UI task depends on screenshots, rebuild and reinstall the E2E app before the Maestro run if the surface uses bundled native code or an embedded JS bundle, then run the narrowest focused Maestro flow through `scripts/maestro.sh`
- keep stable `takeScreenshot` names inside the committed Maestro flow when that keeps the flow simple, but never share those raw filenames with the user because chat clients may cache them aggressively
- after each Maestro run, immediately export the screenshots into a fresh timestamped directory such as `tmp-settings-shots/$(date +%Y%m%d-%H%M%S)/`
- the exported filenames themselves must also include the timestamp, for example `20260603-150137-step-sync.png` rather than only placing `step-sync.png` inside a timestamped folder
- preserve every timestamped screenshot directory for the whole user session so current and prior passes can be compared side by side; do not delete earlier timestamped captures mid-session unless the user asks
- if the user says a visual change is not visible, compare the new timestamped screenshots against the previous timestamped screenshots before assuming the build failed; the issue may be subtle sizing or cached previews
- inspect the exported timestamped screenshots directly before reporting success, and use tighter focused screenshots or crops when the visual delta is too small to judge from a full-screen capture
- when replying to the user, link only the timestamped exported files, not the raw `takeScreenshot` outputs
- a reliable shell pattern is `ts=$(date +%Y%m%d-%H%M%S) && mkdir -p tmp-settings-shots/$ts && cp tmp-settings-shots/03-step-sync.png tmp-settings-shots/$ts/${ts}-step-sync.png`

Focused flows:
- `.maestro/wordle-scroll-keyboard.yaml` - verifies the Wordle keyboard still accepts taps after the screen is scrolled and is the first flow to rerun for Wordle touch regressions
- on iOS, that flow still reproduces a stubborn `I`-key miss after scroll; use a fresh `MOBILE_TEST_EMAIL`, inspect `wordle-yuiop-after-scroll.png`, and treat the `I` key as the first place to look if the flow fails
- prefer adding similar focused flows for high-risk interaction bugs instead of relying only on the generic smoke flow

PvP-specific workflow:
- for battle validation, prefer the fixture-backed PvP flows or the Phoenix fixture script so the match state is deterministic
- if you need to exercise a specific match route, use the E2E auth deep link first to establish session state, then open the target route; two-step navigation is often more reliable than a single query-heavy redirect
- when validating live combat interactions, favor stable assertions on `pvp-battle-board`, `pvp-action-modal`, `pvp-card-info-modal`, `pvp-battle-log-button`, and the `pvp-my-unit-*` / `pvp-opponent-unit-*` test ids
- if a Maestro run fails, inspect the debug artifacts under `~/.maestro/tests/<timestamp>/` before changing app code; the screenshot usually tells you whether the failure is splash/login/navigation/board interaction

## Mobile Build And Release Policy

Production mobile build and release work is initiated from this Mac, not from GitHub Actions.

Rules:
- do not add or rely on GitHub Actions workflows to build or release the mobile app
- when the user asks to "release", assume the workflow is build first and release second unless they explicitly say not to build
- when the user asks to "release iOS", run the release workflow from this Mac and prefer the direct local App Store Connect upload path
- when the user asks to "release Android", run the release workflow from this Mac and use EAS as the release backend
- when the user asks to release both platforms, handle Android and iOS in one pass unless they say otherwise
- always bump the app version/build metadata first as part of the release flow; do not skip version bumping unless the user explicitly asks to keep versions unchanged
- EAS is the preferred path for build work and Android submission work; iOS submission defaults to Apple's local upload tooling
- prefer the repo’s dedicated mobile release scripts instead of inventing ad hoc release commands
- Android releases require an appropriate Google Play release note; do not ship Android without one
- Android release notes should be based on the diff between the last released Android commit and the current release commit; use the latest `mobile/android/*` tag as the baseline
- iOS releases should also carry a release note for the release record even if TestFlight changelog upload is unavailable; base it on the diff between the last released iOS commit and the current release commit using the latest `mobile/ios/*` tag as the baseline
- keep iOS and Android release history independently via git tags because one platform may ship without the other; use the latest `mobile/ios/*` and `mobile/android/*` tags as the source of truth for the last released commit on each platform
- if a platform has no prior release tag yet, treat the current ship as the first true release for that platform and create the tag baseline during the release flow
- after a successful platform release, ensure the new per-platform release tag exists locally and remind the user to push tags so future agents can diff from the correct baseline
- use the `../cleantrack` release scripts as the local reference for expected release behavior on this MacBook when adapting or debugging the workflow
- the iOS release path expects signing material such as `apps/mobile/credentials.json`, the referenced Apple certificate/profile files, and local App Store Connect API key settings
- the Android release path expects the signing material, service account credentials, and release-note inputs needed by the release scripts
- when preparing release notes, summarize the meaningful changes in the diff since the platform's last release tag instead of inventing generic copy
- if signing material or App Store Connect identifiers are missing, stop and report the exact missing inputs instead of adding GitHub-based release automation

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
- run `cd apps/mobile && npx expo-doctor`
- treat any new Expo Doctor warning or failure as a regression to fix before finishing, not as background noise
- when `ios/` and `android/` are checked in, the non-CNG sync warning about native config fields may remain; only accept it if it is unchanged and the only Expo Doctor finding, and explicitly call it out in the handoff
- when mobile behavior or interaction code changes, run the narrowest relevant Maestro flow if a stable flow exists for that surface
- if Maestro coverage is missing for the changed surface and the area is high-risk, add or update a focused flow in `.maestro/` instead of relying only on manual reasoning
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
- pull the latest `main` with `git switch main && git pull --ff-only origin main`
- create a fresh working branch from `main` before making changes; use the `codex/` prefix unless the user asks otherwise
- inspect neighboring files and match local conventions
- prefer targeted changes over broad churn
- preserve Phoenix context boundaries
- treat `apps/api` and the PWA as reference material unless the task explicitly targets them
- inspect active services, listeners, and reverse proxy wiring before changing host-level infra

Before finishing:
- commit each completed change or logical change set before moving on
- push committed changes before finishing the task unless the user explicitly asks you not to push
- open a pull request for every finished change set; the user merges manually
- report what changed
- report verification performed
- call out contract changes, migration implications, or operational follow-up

CI/CD workflow:
- GitHub Actions is for validation and Phoenix backend deployment only
- mobile builds and store releases are not run on GitHub
- mobile builds are performed on this Mac
- EAS is the preferred mobile release path
- do not merge pull requests on the user’s behalf unless they explicitly ask

## Docs Sync

`AGENTS.md` is the canonical template.
After updating it, mirror the same structure and state into `CLAUDE.md`, keeping only the document title and one-line intro intentionally different.
