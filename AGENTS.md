# AGENTS.md

Guidance for coding agents working in `adventure-time-native`.

## Mission
This repo is a native-first rebuild of `~/adventure-time-tcg`, the legacy PWA.
It is still a copy-in-progress, not a finished rewrite.
When in doubt, preserve parity with the PWA in gameplay rules, API contracts, naming, reward logic, and UX intent while fitting the native stack.
You are usually operating on the Arch Linux VPS that hosts both the legacy PWA and the native app server.
You have sudo access on that machine.

## Rule Files
Checked sources for extra agent rules:
- no `.cursorrules`
- no `.cursor/rules/`
- no `.github/copilot-instructions.md`
If any of those files are added later, merge their instructions into this file.

## Monorepo Shape
Npm workspaces:
- `apps/api` - Fastify REST API
- `apps/mobile` - Expo / React Native app
- `packages/db` - Drizzle schema, migrations, DB client
- `packages/shared` - Zod schemas and shared DTOs
- `packages/game-engine` - pure combat and PvP engine
- `packages/api-client` - typed API client used by mobile
Architecture rules:
- mobile talks to the backend through `@adventure-time/api-client`
- shared request/response schemas live in `@adventure-time/shared`
- API owns I/O, auth, persistence, uploads, and DB access
- `@adventure-time/game-engine` must stay pure and must not access DB, network, env, or filesystem
- Drizzle schema is the DB source of truth

## Commands
Run commands from the repo root unless a package-specific command is clearer.
Root:
- `npm run dev:api`
- `npm run dev:mobile`
- `npm run dev:mobile:tunnel`
- `npm run build`
- `npm run typecheck`
- `npm run lint` - currently no workspace defines `lint`
- `npm run db:generate`
- `npm run db:migrate`
Workspace:
- API: `npm run dev -w @adventure-time/api`, `npm run build -w @adventure-time/api`, `npm run typecheck -w @adventure-time/api`
- API scripts: `npm run abilities:translate-description -w @adventure-time/api`, `npm run abilities:backfill-fr -w @adventure-time/api`, `npm run abilities:retranslate-fr -w @adventure-time/api`
- PWA migration: `npm run migrate:pwa-users:audit -w @adventure-time/api`, `npm run migrate:pwa-users:dry-run -w @adventure-time/api`, `npm run migrate:pwa-users:apply -w @adventure-time/api`, `npm run migrate:pwa-users:verify -w @adventure-time/api`
- mobile: `npm run dev -w @adventure-time/mobile`, `npm run dev:tunnel -w @adventure-time/mobile`, `npm run typecheck -w @adventure-time/mobile`
- packages: `npm run typecheck -w @adventure-time/db`, `npm run typecheck -w @adventure-time/shared`, `npm run typecheck -w @adventure-time/game-engine`, `npm run typecheck -w @adventure-time/api-client`
- DB package: `npm run db:generate -w @adventure-time/db`, `npm run db:migrate -w @adventure-time/db`, `npm run db:repair-history -w @adventure-time/db`

## Tests
Current state:
- there is no configured test runner
- there are no `test` scripts in workspace `package.json` files
- there are no `*.test.*` or `*.spec.*` files in the repo
Implications:
- there is no supported command for “run all tests”
- there is no supported command for “run a single test”
- do not invent Jest, Vitest, Playwright, or similar commands in agent output
Until a test runner exists, verify changes with:
- targeted `npm run typecheck -w <workspace>`
- targeted builds such as `npm run build -w @adventure-time/api`
- manual API or mobile flow checks for touched behavior
If you add tests later, also add and document:
- a root `npm test`
- workspace-level `test` scripts
- the exact single-file and single-case invocation

## Environment
Env files:
- API: `apps/api/.env`
- mobile: `apps/mobile/.env`
Important vars include `PORT`, `HOST`, `DATABASE_URL`, `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, MinIO settings, and `EXPO_PUBLIC_API_BASE_URL`.
Do not hardcode secrets or commit env values.
Local documented DB URL is PostgreSQL on `127.0.0.1:5434/adventure_time_native`.
MinIO is configured separately and typically uses port `9100`.

## Mobile Styling: NativeWind First
For mobile UI work, NativeWind must be the default styling system.
Always prefer `className` utilities first.
Avoid React Native `style` props at all costs.
If a `style` prop is truly necessary, keep it minimal and use theme tokens instead of raw hex values.
Use semantic classes first:
- `bg-bg`, `text-fg`, `bg-surface`, `bg-surfaceMuted`
- `text-fgMuted`, `border-primaryBorder`, `bg-primaryTint`
- `text-primaryText`, `text-dangerDark`, `bg-infoTint`
- Nunito font utilities from `apps/mobile/tailwind.config.js`
Acceptable reasons for `style`:
- `LinearGradient`, `BlurView`, animated transforms, measured dimensions
- safe-area math, `contentContainerStyle`, `placeholderTextColor`
- values NativeWind cannot express cleanly
Even then:
- prefer `THEME_COLORS[themeName]` over hardcoded colors
- prefer semantic tokens over one-off values
- do not add new style-heavy UI when a `className` solution works

## Theme System
Theme runtime is powered by Zustand plus NativeWind CSS variables.
Main sources:
- `apps/mobile/src/stores/theme-store.ts` - active theme state
- `apps/mobile/src/theme/themes.ts` - `THEME_COLORS` and `THEME_VARS`
- `apps/mobile/global.css` - default CSS variable values
- `apps/mobile/tailwind.config.js` - semantic Tailwind token mapping
- `apps/mobile/app/_layout.tsx` - root `THEME_VARS[themeName]` application
Theme rules:
- keep `apps/mobile/global.css` and `apps/mobile/src/theme/themes.ts` in sync when tokens change
- use `THEME_COLORS[themeName]` for JS-only values like gradients, icons, shadows, and placeholders
- apply `THEME_VARS[themeName]` on new full-screen roots when needed
- do not invent new font utility names; use the existing Nunito aliases only

## Imports, Formatting, and Types
Import order:
1. external packages
2. workspace aliases like `@adventure-time/*`
3. local relative imports
Other rules:
- use `import type` for type-only imports when practical
- prefer workspace aliases instead of deep cross-workspace relative paths
- keep a blank line between import groups
- remove unused imports
- TypeScript is `strict: true`
- use semicolons and double quotes
- use trailing commas in multiline structures
- keep files ASCII unless Unicode is already required
- prefer small helpers over deeply nested inline logic
- avoid `any`; prefer `unknown` plus validation/parsing
- validate external input with Zod
- keep DTOs serializable and defined in `packages/shared`

## Naming and Structure
- files use kebab-case
- React components use PascalCase
- hooks use `useSomething`
- stores use `something-store.ts`
- service modules use `*-service.ts`
- route registration functions use names like `authRoutes`
- Zod exports use `fooSchema` and `fooResponseSchema`
- DB tables use plural camelCase TS names mapped to snake_case SQL

## API, DB, and Error Handling
- keep Fastify routes thin: parse, auth, call service, map expected failures
- keep business rules in services
- expected user-facing failures should return clear messages and sensible status codes
- let unexpected failures reach the global error handler
- do not silently swallow real errors unless the endpoint is intentionally best-effort
- prefer Drizzle query builders over raw SQL
- set `updatedAt` on mutable writes where the schema tracks it
- serialize `Date` values to ISO strings before returning JSON
- use transactions for multi-step writes that must stay consistent
After DB schema changes:
- run `npm run db:generate`
- review generated migration SQL
- run `npm run db:migrate`

## Working Style
Before editing:
- inspect neighboring files and match local patterns
- prefer minimal, targeted changes
- preserve architecture boundaries across workspaces
- remember this repo is still copying behavior from the legacy PWA
Before finishing:
- run the narrowest relevant verification commands
- at minimum run typecheck for touched workspaces
- run builds for touched workspaces that define a build script
- explicitly note anything you could not verify
