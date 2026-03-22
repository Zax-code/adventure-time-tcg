# CLAUDE.md

Repo-specific guidance for Claude Code and similar agents working in `adventure-time-native`.

## Project Overview
`adventure-time-native` is a native-first rebuild of `~/adventure-time-tcg`, the legacy PWA.
It is still a copy-in-progress, so preserve parity with the PWA wherever practical: gameplay, contracts, naming, reward logic, and UX intent should stay aligned unless the task explicitly changes them.

## Extra Rule Files
Checked rule sources:
- no `.cursorrules`
- no `.cursor/rules/`
- no `.github/copilot-instructions.md`
If any appear later, merge their instructions into this document.

## Repo Shape
Npm workspace monorepo:
- `apps/api` - Fastify REST API
- `apps/mobile` - Expo / React Native app
- `packages/db` - Drizzle schema, migrations, DB client
- `packages/shared` - Zod schemas and shared DTOs
- `packages/game-engine` - pure combat and PvP engine
- `packages/api-client` - typed API client used by mobile
Architecture expectations:
- mobile talks to the backend through `@adventure-time/api-client`
- shared request/response schemas belong in `@adventure-time/shared`
- API handles auth, persistence, uploads, DB access, and orchestration
- `@adventure-time/game-engine` stays pure with no DB, network, filesystem, or env access
- Drizzle schema is the DB source of truth

## Commands
Run commands from the repo root unless a package-specific command is clearer.
```bash
# Root
npm run dev:api
npm run dev:mobile
npm run dev:mobile:tunnel
npm run build
npm run typecheck
npm run lint
npm run db:generate
npm run db:migrate

# API
npm run dev -w @adventure-time/api
npm run build -w @adventure-time/api
npm run typecheck -w @adventure-time/api
npm run abilities:translate-description -w @adventure-time/api
npm run abilities:backfill-fr -w @adventure-time/api
npm run abilities:retranslate-fr -w @adventure-time/api
npm run migrate:pwa-users:audit -w @adventure-time/api
npm run migrate:pwa-users:dry-run -w @adventure-time/api
npm run migrate:pwa-users:apply -w @adventure-time/api
npm run migrate:pwa-users:verify -w @adventure-time/api

# Mobile and packages
npm run dev -w @adventure-time/mobile
npm run dev:tunnel -w @adventure-time/mobile
npm run typecheck -w @adventure-time/mobile
npm run typecheck -w @adventure-time/db
npm run typecheck -w @adventure-time/shared
npm run typecheck -w @adventure-time/game-engine
npm run typecheck -w @adventure-time/api-client
npm run db:generate -w @adventure-time/db
npm run db:migrate -w @adventure-time/db
npm run db:repair-history -w @adventure-time/db
```

## Tests
There is currently no configured test runner.
There are no `test` scripts and no `*.test.*` or `*.spec.*` files.
There is therefore no supported command for running all tests or a single test.
Until tests exist, verify with targeted workspace typechecks, targeted builds, and manual API/mobile checks.
If tests are added later, document both the general test command and the exact single-file or single-case invocation.

## Environment
Env files:
- API: `apps/api/.env`
- mobile: `apps/mobile/.env`
Common API vars include `PORT`, `HOST`, `DATABASE_URL`, `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, and MinIO settings.
Mobile uses `EXPO_PUBLIC_API_BASE_URL`.
Do not hardcode secrets or commit env values.

## Mobile UI: NativeWind First
NativeWind is the primary mobile styling system and should always be used first.
Prefer `className` utilities over React Native `style` props.
Avoid `style` props whenever possible.
If a `style` prop is unavoidable, keep it small and source colors from theme tokens instead of raw literals.
Preferred semantic classes include:
- `bg-bg`, `text-fg`, `bg-surface`, `bg-surfaceMuted`
- `text-fgMuted`, `border-primaryBorder`, `bg-primaryTint`
- `text-primaryText`, `text-secondaryText`, `text-dangerDark`
- Nunito font utilities defined in `apps/mobile/tailwind.config.js`
Use `style` only for cases like gradients, animated transforms, measured dimensions, safe-area math, `contentContainerStyle`, or placeholder colors.
Even there, prefer `THEME_COLORS[themeName]` over hardcoded colors.

## Theme System
Theme data is split across NativeWind CSS vars and JS token maps.
Main files:
- `apps/mobile/src/stores/theme-store.ts`
- `apps/mobile/src/theme/themes.ts`
- `apps/mobile/global.css`
- `apps/mobile/tailwind.config.js`
- `apps/mobile/app/_layout.tsx`
Rules:
- keep `global.css` and `src/theme/themes.ts` aligned when changing tokens
- use `THEME_COLORS[themeName]` for JS-only color values
- use `THEME_VARS[themeName]` for root/full-screen themed containers when needed
- do not invent new font utility names; use the existing Nunito aliases only

## Code Style
Imports:
1. external packages
2. workspace aliases like `@adventure-time/*`
3. local relative imports
Formatting and typing:
- use `import type` when practical
- use semicolons and double quotes
- keep trailing commas in multiline structures
- TypeScript is `strict: true`
- prefer Zod validation at boundaries
- keep shared DTOs in `packages/shared`
- avoid `any`; prefer narrower types and validation
- keep files ASCII unless Unicode is already justified
Naming:
- kebab-case files
- PascalCase React components
- `useSomething` hooks
- `something-store.ts` store files
- `*-service.ts` service files
- `fooSchema` / `fooResponseSchema` for Zod exports
- plural camelCase table identifiers mapped to snake_case SQL names

## API, DB, and Errors
- keep Fastify routes thin
- put business rules in services
- return clear expected user-facing errors
- let unexpected failures reach the server error handler
- prefer Drizzle query builders over raw SQL
- serialize `Date` values to ISO strings before returning JSON
- use transactions for multi-step writes
After schema changes, run:
```bash
npm run db:generate
npm run db:migrate
```

## Working Style
Before editing, inspect neighboring files and preserve existing local patterns.
Prefer minimal changes and preserve architecture boundaries.
For mobile work, avoid introducing new style-prop-heavy code when NativeWind and theme tokens can express the UI.
Before finishing, run the narrowest relevant verification commands.
At minimum, typecheck touched workspaces and build any touched workspace that defines a build script.
Explicitly say what you could not verify.
