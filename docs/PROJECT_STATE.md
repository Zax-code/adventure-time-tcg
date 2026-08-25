# Adventure Time TCG — Project State

Last verified: 2026-08-25
Repository: `Zax-code/adventure-time-tcg`
Branch: `codex/share-speed-calculus-results`
Verified baseline commit: `e418f884`

## Purpose and authority

This file is the maintained index of the project's verified state. It is intended to give future Codex agents and ChatGPT sessions a reliable starting point without depending on conversational memory. Current source code, Ecto migrations, runtime and release configuration, and Git history remain authoritative when they conflict with this file.

The status labels used here are:

- **COMPLETE** — the described scope is implemented and was located in code; this does not mean bug-free.
- **PARTIAL** — a meaningful part exists, but a stated part is absent or incomplete.
- **IN PROGRESS** — active work is evidenced by an open pull request, branch, or current artifact.
- **PLANNED** — an owner-visible issue or specification exists, but implementation was not found.
- **BLOCKED** — a verified dependency or failing check currently prevents the described work.
- **UNKNOWN** — repository evidence was insufficient to establish the state.

Release state is stated separately from implementation status. A feature can be COMPLETE in source without a confirmed production or store release.

## Product summary

Adventure Time TCG is a collectible-card game with daily quests, pack opening, collection crafting and recycling, card gifting, asynchronous server-authoritative PvP, rankings, profiles, and administrative operations. The actively maintained platforms are:

- an Expo/React Native app for iOS and Android in `apps/mobile`;
- a responsive React/Vite website in `apps/web`;
- a Phoenix JSON API and website host in `apps/phoenix`.

Phoenix, PostgreSQL, and MinIO are the production backend. The Fastify app in `apps/api` and the Drizzle package in `packages/db` are legacy reference code, not active architecture.

### Verified release boundary

- **Production backend and website:** the `Deploy Phoenix` workflow completed successfully for `afaf4875be27a9185d4332b92eb32383c932195c` on 2026-08-18 (GitHub Actions run `32151688930`). That revision includes Daily Numbers visible-step deduplication, player-solution translation/recovery, and migration `20260818190000`.
- **Mobile:** annotated tags `mobile/android/1.0.32` and `mobile/ios/1.0.32` both resolve to `28764a8a1afe5a100c4833ce315a83a5f3a4799e`, with release timestamps on 2026-08-23. Android versionCode 54 was accepted on the Google Play closed-testing track, and iOS build 67 was validated by App Store Connect. The recorded release note is “Improves Perfect Timing result confirmations and fixes profiles for high leaderboard scores.”
- **Local data:** local Docker database observations in this document are explicitly labeled. They are not evidence of production catalog contents.

## Current architecture

- **Mobile application:** Expo Router routes in `apps/mobile/app`, product code in `apps/mobile/src`, checked-in native projects in `apps/mobile/ios` and `apps/mobile/android`, and bundled art in `apps/mobile/assets`. It calls Phoenix through `@adventure-time/api-client`, receives quest changes through a Phoenix channel, polls REST endpoints for current PvP state, and stores session state securely on-device.
- **Web application:** React routes in `apps/web/src/app.tsx` and `apps/web/src/route-manifest.ts`. The production build is copied into Phoenix static assets by `apps/phoenix/Dockerfile`; browser authentication uses secure Phoenix session endpoints.
- **Backend/API:** Phoenix contexts under `apps/phoenix/lib/adventure_time_api`, controllers/channels under `apps/phoenix/lib/adventure_time_api_web`, and the canonical route map at `apps/phoenix/lib/adventure_time_api_web/router.ex`. Phoenix owns authentication, persistence, uploads, jobs, quests, leaderboards, and PvP validation.
- **Database:** PostgreSQL 16 with Ecto schemas in `apps/phoenix/lib/adventure_time_api` and 48 canonical migrations in `apps/phoenix/priv/repo/migrations`. `packages/db` is legacy Drizzle reference material.
- **Authentication:** email/password with verification and password reset, Google and Apple provider identities, signed access/refresh tokens for native clients, refresh-token sessions, secure browser cookies, role/access approval, and rate limits. Primary code is `apps/phoenix/lib/adventure_time_api/accounts.ex`, `apps/phoenix/lib/adventure_time_api/auth.ex`, and the auth controllers/plugs.
- **Object storage and image delivery:** a private MinIO bucket accessed through `apps/phoenix/lib/adventure_time_api/media.ex`. Phoenix signs S3-compatible requests and proxies image bytes through `/media/*` routes.
- **Admin tooling:** role-guarded Phoenix endpoints plus mobile and web admin interfaces for users/access requests, cards, abilities, packs, card backs, featured cards, image assets, quest reset, and leaderboard corrections.
- **Jobs and real-time:** Oban runs gift/invite expiry, access assessment, pruning, and leaderboard lifecycle jobs. Phoenix PubSub and the registered `quests:*` channel push quest changes; PvP refreshes through REST polling and visible push notifications rather than a socket channel.
- **Deployment:** GitHub Actions builds the Phoenix/web release image and deploys it to the VPS. Production runs rootful Podman Quadlets behind Caddy. Mobile builds and releases run locally on the Mac.
- **External services:** Google and Apple sign-in, Fitbit, Apple HealthKit, Android Health Connect, Expo Push, Google Play Integrity, IPQualityScore/range data for advisory access assessment, App Store Connect, Google Play/EAS, GHCR, and MinIO. Their credentials are runtime-only and are not documented here.

## Current technology stack

Versions below come from current manifests, lockfiles, native configuration, and container definitions.

| Layer | Verified technology |
|---|---|
| Mobile | Expo `57.0.16`, Expo Router `57.0.16`, React Native `0.86.2`, React `19.2.3`, Reanimated `4.5.1`, NativeWind `4.2.3`, Software Mansion Bottom Sheet `0.12.0`, Expo Image, TanStack Query `5.101.4`, Zustand `5.0.15` |
| Web | React `19.2.3`, React Router `7.18.x`, Vite `8.2.1`, TanStack Query `5.101.4`, Vitest `4.1.10` |
| Shared TypeScript | Zod `3.25.76`; TypeScript `6.0.3` for mobile/web and `5.9.3` for shared packages in the installed tree |
| Backend | Elixir `1.19.5` and OTP `28` in CI/release images; Phoenix `1.8.5`, Ecto SQL `3.13.5`, Postgrex `0.22.0`, Bandit `1.10.3`, Oban `2.21.1`, Req `0.5.17`, Image `0.72.0`, Vix `0.41.0` with bundled libvips `8.18.3`, JOSE `1.11.12`, bcrypt_elixir `3.3.2`, tzdata `1.1.3` |
| Runtime/data | Node `22.14.0`, PostgreSQL `16-alpine`, MinIO `RELEASE.2025-02-28T09-55-16Z` |
| Build/release | npm workspaces, EAS local builds, native Xcode/Gradle projects, Maestro, focused Appium 3 native multi-touch checks, Docker Buildx, GHCR, Phoenix releases |
| Production infrastructure | Podman Quadlet, systemd, Caddy, GitHub Actions, persistent data under `/srv/adventure-time-tcg` |

The Expo 57 migration and subsequent patch alignment are complete; Expo Doctor passes all 20 checks.

## Applications and services

| Component | Purpose and communication | Location | Status | Release posture |
|---|---|---|---|---|
| Expo mobile app | Primary native player/admin client; REST via `@adventure-time/api-client`, a Phoenix quest channel, PvP polling, and push notifications | `apps/mobile` | COMPLETE | Actively released; iOS and Android 1.0.32 are tagged |
| Responsive website | Browser player/admin client using the same client/contracts; served as Phoenix static content in production | `apps/web` | COMPLETE | Active; deployed with Phoenix at `a49bcf0…` |
| Phoenix API | Canonical backend, auth, gameplay, persistence, media, jobs, and web session host | `apps/phoenix` | COMPLETE | Active production service |
| PostgreSQL | Canonical persistent store and Oban job store | Ecto schemas and `apps/phoenix/priv/repo/migrations` | COMPLETE | PostgreSQL 16 production container |
| MinIO | Private card, profile, card-back, and catalog image objects | `apps/phoenix/lib/adventure_time_api/media.ex`, `infra/containers/quadlet` | COMPLETE | Active production service |
| Oban | Media cleanup, expiry, assessment, pruning, and leaderboard lifecycle processing | `apps/phoenix/lib/adventure_time_api/workers` | COMPLETE | Runs inside Phoenix production release |
| Shared API client/contracts | Typed transport and Zod wire contracts shared by web/mobile | `packages/api-client`, `packages/contracts` | COMPLETE | Active runtime packages |
| Shared game engine/theme | Pure TS combat helpers used by mobile and shared visual tokens/assets | `packages/game-engine`, `packages/theme` | COMPLETE | Active; Phoenix remains authoritative for persisted PvP actions |
| Fastify API | Archived implementation reference only | `apps/api` | COMPLETE | Legacy; excluded from npm workspaces and not deployed |
| Drizzle database package | Archived schema/migration reference | `packages/db` | COMPLETE | Legacy; Ecto is authoritative |

## Feature status

| Area | Feature | Status | Current implementation | Evidence |
|---|---|---|---|---|
| Accounts | Account creation and authentication | COMPLETE | Email registration/verification, password reset/change, Google/Apple sign-in, approval state, access/refresh sessions, logout, deletion, and browser sessions | `apps/phoenix/lib/adventure_time_api/accounts.ex`; `apps/phoenix/lib/adventure_time_api_web/controllers/auth_controller.ex`; `apps/phoenix/lib/adventure_time_api_web/router.ex` |
| Profiles | Display names and profile pictures | COMPLETE | Mutable 1–64 character display names, stable public profile ID/discriminator, visibility/eligibility fields, authenticated profile images, and fallback avatars | `apps/phoenix/lib/adventure_time_api/accounts/user.ex`; `apps/phoenix/lib/adventure_time_api/leaderboards/public_profiles.ex`; `apps/mobile/src/features/leaderboards/leaderboard-avatar.tsx` |
| Profiles | Unique username handles | UNKNOWN | No `username` field or handle route was found. Display names are not unique; leaderboard discriminators provide stable disambiguation. No owner-approved username plan was found. | `apps/phoenix/lib/adventure_time_api/accounts/user.ex`; `apps/phoenix/priv/repo/migrations/20260815160000_create_leaderboard_foundation.exs` |
| Collection | Collection browsing, filtering, crafting, and recycling | COMPLETE | Owned/locked cards, counts and completion, detail sheets/pages, dust values, duplicate recycling, and dust crafting exist on mobile/web with server transactions | `apps/phoenix/lib/adventure_time_api/inventory.ex`; `apps/mobile/app/(tabs)/collection.tsx`; `apps/web/src/pages/player/core-pages.tsx` |
| Cards | Card display and detail views | COMPLETE | Mobile and web render art, frames, rarity/type treatments, descriptions, stats, ownership, and PvP ability detail | `apps/mobile/src/components/card-tile.tsx`; `apps/mobile/app/collection-card-detail.tsx`; `apps/web/src/components/cards.tsx` |
| Cards | Statistics, types, rarities, and abilities | COMPLETE | HP/attack/defense/speed; ten canonical types; five rarities; basic combat plus optional passive, skill, and ultimate slots | `apps/phoenix/lib/adventure_time_api/catalog/card.ex`; `apps/phoenix/lib/adventure_time_api/catalog/card_type.ex`; `apps/phoenix/lib/adventure_time_api/pvp/ability_def.ex`; `apps/phoenix/lib/adventure_time_api/pvp/card_ability.ex` |
| Cards | Card administration | COMPLETE | Admin CRUD, image upload, archive/feature controls, ability CRUD/assignment, pack and card-back management exist in Phoenix, mobile, and web | Admin routes/controller; `apps/mobile/app/admin`; `apps/web/src/pages/admin` |
| Cards | Agent-assisted card generation | PARTIAL | A local review workflow, catalog snapshot script, art preparation, insertion verification, and explicit live-deploy approval gate exist. It is not an end-user generator and still depends on supplied art, research, and a working local DB/MinIO stack. | `.agents/skills/generate-card` |
| Packs | Pack storefront and opening | COMPLETE | Server deducts coins, chooses rarity/card drops, applies guarantees, spark counters, weekly Legendary pack limit, records openings, and returns reveal sources; mobile/web opening UIs exist | `apps/phoenix/lib/adventure_time_api/inventory.ex`; `apps/phoenix/lib/adventure_time_api/inventory/pack_opening.ex`; pack routes and tests |
| Assets | Pack artwork and card frame/back assets | COMPLETE | Five pack covers and 15 Candy/Ice/Nightosphere × rarity frame/back combinations are bundled for mobile; responsive AVIF/PNG equivalents exist for web; DB card-back mappings exist | `apps/mobile/assets`; `apps/web/src/assets/game`; `apps/phoenix/lib/adventure_time_api/catalog/card_back_visual.ex` |
| Assets | Standalone rarity icons | PARTIAL | Five-shape `RarityIcon` rendering code exists but is private and has no call site. Rarity is otherwise represented through frame, color, and shimmer treatments. | `apps/mobile/src/components/icons.tsx` |
| Rewards | Daily login reward | COMPLETE | One 50-coin claim per reset day, separate from daily quests | `apps/phoenix/lib/adventure_time_api/quests.ex`; mobile/web home screens |
| Quests | Steps quest | COMPLETE | 10,000-step target, 75 coins, device-health or Fitbit snapshots, mobile sync/background/widget support, and leaderboard result recording | `apps/phoenix/lib/adventure_time_api/quests.ex`; `apps/phoenix/lib/adventure_time_api/health.ex`; `apps/phoenix/lib/adventure_time_api/fitbit.ex` |
| Quests | Wordle | COMPLETE | Separate English/French deterministic daily words, dictionary validation, six attempts, definitions, 35-coin rewards, sharing, and leaderboards | `apps/phoenix/lib/adventure_time_api/quests.ex`; `apps/phoenix/lib/adventure_time_api/quests/wordle_engine.ex`; Wordle routes/screens/tests |
| Quests | Daily Numbers | COMPLETE | Deterministic 1-5, 2-4, and 3-3 modes; server-validated arithmetic; score-scaled rewards; one daily result/mode; 30-day archive; mobile/web UI; per-mode and family boards; post-completion Solution Hunt with AST canonicalization plus visible-step equivalence, canonical solution enumeration, and per-user progress | `apps/phoenix/lib/adventure_time_api/quests/daily_numbers_engine.ex`; `apps/phoenix/lib/adventure_time_api/quests/daily_numbers_expression.ex`; `apps/phoenix/lib/adventure_time_api/quests/daily_numbers_solver.ex`; `apps/phoenix/lib/adventure_time_api/quests/daily_numbers_solution_hunt.ex`; Daily Numbers routes/tests |
| Quests | Speed Calculus | COMPLETE | Three 30-second scored runs, deterministic server questions, pause/resume, server answer scoring, training, cash-out, reward up to 80 coins, latest-run leaderboard reconciliation, share images for every recorded run with correct/total ratio, accuracy, and score, coordinate-routed multi-touch keypad input, a ring-only entry countdown, and focused Appium multi-pointer coverage | `apps/phoenix/lib/adventure_time_api/quests/speed_calculus_engine.ex`; `apps/phoenix/lib/adventure_time_api/quests.ex`; `apps/mobile/src/features/quests/speed-calculus/share-result.ts`; `apps/mobile/src/features/quests/speed-calculus/quest-share-card.tsx`; `apps/mobile/src/features/quests/speed-calculus/keypad.tsx`; `apps/mobile/src/features/quests/speed-calculus/keypad-touch.ts`; `apps/mobile/test/appium/speed-calculus-multitouch.mjs` |
| Quests | Perfect Timing | COMPLETE | Deterministic 3–10 second target, three-attempt state machine, monotonic client measurement with server plausibility checks/recovery, tiered rewards, training/sharing, and leaderboard | `apps/phoenix/lib/adventure_time_api/quests/perfect_timing.ex`; `apps/phoenix/lib/adventure_time_api/quests/perfect_timing_engine.ex`; commit `b40970d` |
| Rankings | Per-quest leaderboards | COMPLETE | Steps, three Daily Numbers modes, English/French Wordle, Speed Calculus, and Perfect Timing source boards are implemented and deployed | `apps/phoenix/lib/adventure_time_api/leaderboards/boards.ex`; `apps/phoenix/lib/adventure_time_api_web/controllers/leaderboards_controller.ex`; `apps/phoenix/priv/repo/migrations/20260815160000_create_leaderboard_foundation.exs`; deploy `a49bcf0` |
| Rankings | Family, weekly, daily, history, and overall boards | COMPLETE | Daily Numbers and Wordle family sums, live daily/weekly projections, finalized history, and overall/all-quests are implemented with mobile period/board selectors. Weekly rows summarize every selected daily result: Steps and Speed Calculus show additive totals; Daily Numbers, Wordle, and Perfect Timing total only successful outcomes alongside participation; All Quests shows the scored/played ratio. Mobile keeps the classic podium for unique winners and switches to equal-height rank groups when any top-three rank is tied. | `apps/phoenix/lib/adventure_time_api/leaderboards/projection.ex`; `apps/phoenix/lib/adventure_time_api/leaderboards/weekly_summary.ex`; `apps/mobile/src/features/leaderboards/format-raw-result.ts`; `apps/mobile/src/features/leaderboards/rankings-presentation.ts`; `apps/phoenix/priv/repo/migrations/20260817150000_enable_sum_all_weekly_scoring.exs`; `apps/phoenix/priv/repo/migrations/20260817160000_add_overall_quests_leaderboard.exs` |
| Rankings | Leaderboard rewards and prizes | COMPLETE | Finalized eligible weekly podiums receive gold/silver/bronze achievements and 3/2/1 family crowns through idempotent grants. Daily and overall boards do not award crowns. | `apps/phoenix/lib/adventure_time_api/leaderboards/prizes.ex`; `apps/phoenix/lib/adventure_time_api/leaderboards/lifecycle.ex`; reward schemas/tests |
| PvP | Asynchronous battles | COMPLETE | Invites, accept/decline/expiry, server-validated actions, energy/cooldowns/statuses/passives, 24-hour turns, persistence journal/snapshots, history/replay, spectating, REST polling, and push notifications | `apps/phoenix/lib/adventure_time_api/pvp.ex`; `apps/phoenix/lib/adventure_time_api/pvp/battle_engine.ex`; PvP controllers/tests |
| PvP | Deck/loadout management | COMPLETE | CRUD for unique six-card owned loadouts with rarity caps; mobile and web editors exist | `apps/phoenix/lib/adventure_time_api/pvp/loadout.ex`; `apps/phoenix/lib/adventure_time_api/pvp.ex`; mobile/web loadout routes |
| Social | Card gifting | COMPLETE | One-way card gifts with pending/accept/decline/expiry behavior and push notification | `apps/phoenix/lib/adventure_time_api/social.ex`; `apps/phoenix/lib/adventure_time_api/social/card_gift.ex`; gift routes/screens |
| Social | Trading | UNKNOWN | No reciprocal trade schema, route, UI, or owner-approved implementation plan was found. Gifting is not trading. | Router, schemas, and repository search |
| Sharing | Quest/result sharing | PARTIAL | Mobile share images/results exist for Wordle, Daily Numbers, Perfect Timing, and Speed Calculus. Speed Calculus sharing is available after any recorded run and includes all one-to-three run results. Steps are not shareable. Card transfers between users are separately implemented as gifts. | `apps/mobile/src/features/quests/quest-hub-model.ts`; `apps/mobile/src/features/quests/grouped-quest-share-image.tsx`; `apps/mobile/src/features/quests/speed-calculus/quest-share-card.tsx`; `apps/phoenix/lib/adventure_time_api/social.ex` |
| Notifications | Local and push notifications | COMPLETE | Preferences, Expo token registration, daily-reset and step-goal local scheduling, PvP/gift visible pushes, Fitbit widget refresh pushes, and response routing exist | `apps/phoenix/lib/adventure_time_api/notifications.ex`; `apps/mobile/src/lib/app-notifications.ts`; notification hooks |
| Localization | English and French product copy | PARTIAL | Mobile UI locale trees are aligned for English/French, Wordle supports both, abilities have optional French copy, and pushes localize. The website UI is primarily hard-coded English and card names/descriptions are single-language fields. | `apps/mobile/src/i18n`; `apps/mobile/src/lib/combat-i18n.ts`; `apps/phoenix/lib/adventure_time_api/pvp/ability_def.ex`; web pages |
| Admin | Operations tooling | COMPLETE | User/access assessment, approvals/roles, quest reset, card/pack/asset/card-back/ability management, feature controls, balance lab, and leaderboard corrections exist | Admin controllers/routes; mobile/web admin directories |
| Packs | Albums and themed pack pools | PLANNED | An exploration issue exists, but no album schema, route, or implementation was found on `main`. | GitHub issue #256 |

## Card and rarity system

### Data and rules

- `cards` stores name, character, description, HP, attack, defense, speed, canonical type, rarity, image asset, featured state, and archive state (`apps/phoenix/lib/adventure_time_api/catalog/card.ex`).
- Canonical types, in source order, are Hero, Tech, Royalty, Candy, Undead, Ice, Fire, Magic, Demon, and Cosmic (`apps/phoenix/lib/adventure_time_api/catalog/card_type.ex`).
- Canonical rarity order from most common to least common is Common, Uncommon, Rare, Epic, Legendary. Current configured drop weights are 52/28/15/4/1 (`apps/phoenix/priv/repo/migrations/20260701120000_add_hidden_pack_spark_counters.exs`; verified in the local DB).
- `ability_defs` supports `PASSIVE`, `SKILL`, and `ULTIMATE`, structured battle payloads, cost/cooldown/once-per-match, and English/French names/descriptions. `card_abilities` assigns at most one of each slot per card. Basic attacks are engine actions, not `BASIC` ability rows.
- The local Docker catalog snapshot on 2026-08-17 contained 105 active cards: 37 Common, 26 Uncommon, 17 Rare, 15 Epic, and 10 Legendary. All 105 had image assets and card-ability assignments; all had skill/ultimate assignments and the 10 Legendary cards had passives. This is local review data, not a production count.

### UI and finished assets

- `apps/mobile/src/components/card-tile.tsx` renders theme/rarity frame overlays, cached artwork, locked-card treatment, description, and type. The collection detail route renders HP/attack/defense/speed; PvP detail also renders localized abilities.
- Mobile has 15 finished card outline PNGs and 15 card-back PNGs for Candy, Ice, and Nightosphere across all five rarities, plus five finished pack cover PNGs. Web has responsive AVIF sources with PNG fallbacks for the same families.
- The local DB has 15 populated card-back visual mappings and five active packs: Basic (2 cards/150 coins), Standard (5/400, Uncommon guaranteed), Premium (5/900, Rare), Epic (6/2200, Epic), and Legendary (7/4500, Legendary). Pack values are runtime data and can be changed administratively.
- Epic and Legendary mobile cards add premium shimmer treatments. Rarity-specific standalone icon code is not integrated, so that asset behavior is PARTIAL even though frames/colors are complete.

No missing bundled frame, back, or pack-cover file was found for the supported theme/rarity matrix. Completeness of production card art and production ability assignments was not directly queried and is therefore UNKNOWN.

### Generation and translation workflow

- `.agents/skills/generate-card` defines an agent-assisted workflow: inspect the running local catalog, research lore, design within existing stat/mechanic bands, edit supplied art, insert a local review draft, and verify it through DB/API/media.
- Generation is local-first. Production insertion requires explicit owner approval, a production backup, service checks, the smallest reviewed data change, and live API/media verification.
- Ability translations are stored as `name_fr`/`description_fr` and edited in admin. Card names and descriptions have no localized columns; mobile localizes canonical types, rarities, statuses, and ability labels at render time.

## Image and MinIO infrastructure

- **Model:** `image_assets` stores `kind` (`card`, `profile`, or `catalog`), MIME type, object key, optional placeholder SVG, and nullable width, height, byte size, and SHA-256 content hash metadata. Migration `20260824120000_add_image_asset_metadata.exs` leaves legacy rows compatible without a backfill. Cards, users, packs, and card-back visuals reference image assets.
- **Uploads:** authenticated users upload their profile image at `POST /settings/upload`; admins upload card images at `POST /admin/cards/:id/image` and catalog assets at `POST /admin/image-assets` (`apps/phoenix/lib/adventure_time_api_web/router.ex`, `apps/phoenix/lib/adventure_time_api_web/controllers/media_controller.ex`, `apps/phoenix/lib/adventure_time_api_web/controllers/admin_controller.ex`).
- **Formats and limits:** card/profile uploads accept decoded JPEG, PNG, or WebP only; the declared MIME type must agree with the actual format. Phoenix enforces a structured 12 MiB application request/file limit below Caddy's 16 MB outer limit and a 40-megapixel decoded-pixel ceiling. Catalog upload behavior remains separate and continues to allow trusted PNG, JPEG, WebP, and SVG.
- **Processing:** Image/Vix/libvips reads the multipart temp file, applies orientation, and emits only metadata-stripped WebP at quality 82/effort 6. Card art is not upscaled, preserves aspect ratio, and has a 1,600-pixel longest edge. Profile art uses a centered square crop on a 512x512 canvas; sources under 512 pixels remain native-size and receive transparent padding instead of upscaling. Only the processed WebP is buffered and sent to MinIO.
- **Keys:** new profile objects use `profile/<user-id>/<uuid>.webp`, card objects use `card/<card-id>/<uuid>.webp`, and general catalog objects retain `catalog/<uuid>`. Imported/seeded assets keep their existing deterministic keys.
- **Storage:** `Media` implements AWS Signature V4 GET, PUT, HEAD, and idempotent DELETE requests with Req against the private MinIO bucket. Production uses the `private-images` bucket and persistent MinIO data under `/srv/adventure-time-tcg/minio`. Vix bundles libvips for the supported release targets; no separate libvips runtime package is required in the current container mode.
- **Delivery:** `/media/card/:id` and `/media/catalog/:id` are public. `/media/profile/:id` requires authentication. Card/catalog responses use `public, max-age=31536000, immutable`; profile responses use `private, max-age=3600`.
- **Fallbacks:** missing object keys or object 404s return kind-specific placeholder SVGs. Other storage failures return a gateway error.
- **Replacement and cleanup:** the new WebP object is uploaded first; one Ecto transaction locks the owner, inserts the new asset, swaps the foreign key, and enqueues the old asset's maintenance job. A failed transaction triggers immediate best-effort deletion of the new object while returning the original database error. After commit, the retryable Oban worker locks and rechecks the old row, protects all card/user/pack/card-back references and shared object keys, then deletes the object before its row. Account deletion atomically enqueues the same post-commit cleanup without changing the existing account transaction boundary.
- **Audit:** `mix media.audit_orphans` reports unreferenced `image_assets` rows grouped by kind with review identifiers and metadata. It is always read-only. Historical objects are not deleted automatically, and MinIO-only bucket scanning is a follow-up rather than part of this audit.
- **Clients:** mobile card/catalog images use `expo-image` memory/disk cache keys and prefetch helpers (`apps/mobile/src/lib/card-images.ts`, `apps/mobile/src/lib/catalog-images.ts`). Authenticated profile images attach the access token. Web card/catalog images are lazy/async; profile images are fetched as authenticated object URLs.
- **Current limitations:** delivery still buffers complete stored objects, only one stored size exists, no responsive variants are generated, and the audit cannot identify MinIO-only historical objects.

## Quest and leaderboard system

The backend materializes eight daily quest rows grouped into five product families. Quest dates use each user's stored IANA timezone; the default is `Europe/Paris`. Normal day rollover creates/uses the next date's rows without deleting history, and clients reject stale date/version responses at the boundary. The separate admin reset operation deletes and rematerializes the selected user's current-date quest/attempt rows, optionally for one quest type, records the reset actor, and broadcasts the reset.

| Quest | Measurement and reward | Authority and daily behavior | Leaderboard result |
|---|---|---|---|
| Steps | 10,000 steps; 75 coins | Phoenix stores per-user/date/source snapshots. Fitbit is fetched server-side; device-health totals are submitted by the authenticated mobile client. Preferred source decides quest/board input. | Steps, 1 point per 20 steps; next-day 13:00 UTC publication cutoff |
| Wordle EN/FR | Solve each five-letter word in ≤6 guesses; 35 coins each | Server selects the deterministic daily word from the DB, validates dictionary membership, evaluates guesses, and stores every attempt. | 1200/1000/800/600/400/200 points for 1–6 guesses; failure 0; language family sums both |
| Daily Numbers 1-5/2-4/3-3 | Improve on the best starting tile; base rewards 45/60/75 scaled by the validated 0–100 score | Server deterministically generates puzzles and validates every arithmetic step/final distance. One daily submission per mode. The 30-day archive has no reward. Elapsed time is measured/persisted by the client. | Exact results use a piecewise power curve anchored at 1000 points for 10 seconds; non-exact results score 0; family sums three modes |
| Speed Calculus | Correct answers in each 30-second run; 2 coins/answer, capped at 80; up to 3 runs | Server seeds questions, checks answers, enforces run deadlines/pause rules, and scores settled runs. Current quest cash-out and board reconciliation use the latest settled run, despite an outdated “best run” docstring. | 50 points per correct answer from the latest finalized run |
| Perfect Timing | Stop within 300 ms of a deterministic 3–10 second target; rewards: Perfect 100, Amazing 75, Great 63, Close 55, Miss 0 | Client measures with a monotonic clock; server owns attempt state, validates plausibility against server elapsed time, recovers interrupted attempts, and finalizes kept/failed results. | Successful results scale linearly from 1200 at 0 ms error to 100 at 300 ms; miss 0 |

### Leaderboard periods, identity, and prizes

- Launch date is 2026-08-15. Scoring version `2026-W34-v2`, effective 2026-08-17, is defined in `apps/phoenix/lib/adventure_time_api/leaderboards/scoring.ex`.
- Source boards exist for each measured quest/mode. Derived boards sum the three Daily Numbers modes, sum both Wordle languages, and sum the five quest-family totals into `overall/all-quests`.
- Live daily and weekly projections are returned for open periods; immutable snapshots back closed history. Weekly scoring sums all eligible daily results. At least one result is required to rank; missing family members contribute zero.
- Weekly display summaries use those same selected daily results. Steps total steps; Speed Calculus totals correct answers; Daily Numbers totals exact-result time; Wordle totals solved-result guesses; Perfect Timing totals successful-result absolute error. The three outcome-based summaries also show successful/played counts, while All Quests shows the scored/played ratio.
- User-local competition slots preserve their original timezone boundaries. Skill results must be submitted before that local day closes; steps have the later publication cutoff noted above.
- `LeaderboardLifecycleWorker` runs every minute, reconciles quest results, materializes periods, closes due periods, snapshots rankings, and awards weekly prizes. Leaderboard failures are isolated from successful quest writes.
- Results record normalized server-derived outcomes, scoring version, integrity/eligibility state, source references, and milli-points. Clients never submit leaderboard points.
- Rows show display name, stable public profile ID/discriminator, authenticated profile picture or deterministic bundled fallback avatar, and public-profile achievements/crowns.
- Prize-enabled weekly source/family boards award ranks 1/2/3 gold/silver/bronze achievements and 3/2/1 crowns in that quest family. Daily periods never award prizes; the overall board has prizes disabled.
- Current source and deployment history show the leaderboard as implemented and released, not unfinished. Evidence includes PR merges `7e9d6b9c` and `ff90fd37`, live-period commit `6f81d791`, overall commit `dc63807a`, deployment `a49bcf0…`, leaderboard migrations, 12 Phoenix leaderboard test modules, and mobile ranking regression/Maestro flows.

Known qualification caveats are explicit: device-health steps originate from the client, and Daily Numbers leaderboard time is client-measured even though the arithmetic result is server-validated. No stronger attestation for those two measurements was found.

## Database state

Ecto migrations are the schema source of truth. Important conceptual groups are:

- **Identity/auth:** `users`, `email_auth_credentials`, `auth_sessions`, `auth_provider_identities`, access requests, verification codes, auth attempts, integrity challenges, advisory access assessments/snapshots, and audited IP reveals.
- **Catalog/inventory/media:** `rarities`, `cards`, `packs`, `image_assets`, `card_back_visuals`, `owned_cards`, `pack_openings`, `ability_defs`, and `card_abilities`.
- **Social/PvP:** `card_gifts`, `pvp_loadouts`, `pvp_matches`, compact `pvp_match_events`, and reconstructed-state `pvp_match_snapshots`.
- **Quests/health:** `daily_quests`, step snapshots, Fitbit accounts, Wordle dictionary/definitions/attempts, Speed Calculus runs, Daily Numbers daily/archive attempts, versioned shared Daily Numbers solution sets, structural expression keys, visible-step solution keys, per-user Solution Hunt discoveries, and Perfect Timing attempts.
- **Leaderboards:** boards, immutable scoring versions, user competition slots, ranked sessions, daily results, periods, snapshots/rows/corrections, telemetry, achievements, reward wallets, and idempotent grants.
- **Operations:** notification devices and Oban job tables.

The foundation begins at `apps/phoenix/priv/repo/migrations/20260324130500_create_foundation_tables.exs`; leaderboard state is introduced by `apps/phoenix/priv/repo/migrations/20260815160000_create_leaderboard_foundation.exs` and extended by `apps/phoenix/priv/repo/migrations/20260817150000_enable_sum_all_weekly_scoring.exs` and `apps/phoenix/priv/repo/migrations/20260817160000_add_overall_quests_leaderboard.exs`. Do not infer current schema from `packages/db`.

At verification time the local development and test databases and production were migrated through `20260818190000_deduplicate_daily_numbers_solution_traces.exs`. Production's 2026-08-18 official sets contain 17 solutions for 1-5, 81 for 2-4, and 4 for 3-3 under solution-key version 3. The deployed lazy upgrade replaced official rows, translated player discoveries through canonical AST materialization, and reconstructed exact ranked solutions as a recovery source. Every exact ranked attempt had a matching player discovery after verification, with no null or duplicate solution keys.

## Deployment and releases

- **Target:** `https://app.leaetzak.love`, reverse-proxied by Caddy to Phoenix on `127.0.0.1:4200`. The checked-in Caddy site sets a 16 MB body limit and HSTS (`infra/caddy/app.leaetzak.love.Caddyfile`). Phoenix exposes the canonical Fitbit OAuth callback at `/api/fitbit/callback` and subscriber endpoint at `/api/fitbit/webhook`; transitional aliases remain at `/fitbit/callback` and `/fitbit/webhook` on the same host.
- **Production services:** `adventure-time-tcg-api`, PostgreSQL 16, and MinIO run as the `adventure-time-tcg` Podman pod through Quadlet/systemd. Host-only ports are 4200 for Phoenix, 5434 for PostgreSQL, and 9100/9101 for MinIO API/console.
- **Persistence:** production PostgreSQL and MinIO data live under `/srv/adventure-time-tcg`. Runtime environment files and signing credentials live outside source control.
- **Backend/web delivery:** `.github/workflows/deploy-phoenix.yml` builds an immutable GHCR image containing the Vite bundle and Phoenix release, deploys the selected SHA over SSH, renders container env files, runs `AdventureTimeApi.Release.migrate`, installs/restarts Quadlets, then checks API and media readiness.
- **CI:** `.github/workflows/ci.yml` conditionally runs infrastructure tests, workspace typechecks/builds/web tests, Phoenix tests, and container validation. Run `32044367068` passed for the pre-Solution-Hunt mainline; PR #285 carries the Solution Hunt CI validation.
- **Mobile version:** `apps/mobile/package.json`, `apps/mobile/app.json`, Android `versionName`, and iOS `CFBundleShortVersionString` are 1.0.32. iOS `CFBundleVersion` is 67. EAS uses remote app-version state and production auto-increment; the released Android versionCode is 54 while the checked-in `versionCode 1` remains a local placeholder.
- **Mobile release:** `scripts/release-mobile.mjs` orchestrates one or both platforms. Android builds a local AAB, submits through EAS/Google Play, requires a release note, and updates Play release notes. iOS builds a local IPA and uploads directly with Apple's `xcrun altool` and App Store Connect API credentials. Successful releases create annotated per-platform Git tags.
- **Environment convention:** Phoenix uses `apps/phoenix/.env`, mobile uses `apps/mobile/.env`, and production secrets are supplied through external runtime env files. `FITBIT_REDIRECT_URI` is `https://app.leaetzak.love/api/fitbit/callback`; the Fitbit developer portal's subscriber endpoint is `https://app.leaetzak.love/api/fitbit/webhook`. No secret value belongs in this document.
- **Current blockers:** none recorded for the 1.0.32 mobile release; the local iOS signing/App Store Connect path and Android signing/Google Play submission path both completed successfully according to the annotated release tags. The local development database is current through the Solution Hunt migration.

## Completed recently

- **2026-08-25 — Speed Calculus result sharing and Expo patch alignment:** mobile can share one, two, or all three recorded Speed Calculus runs from the quest screen or the daily recap; every run shows correct/total answers, accuracy percentage, and absolute score. The workspace and iOS Pod lock are aligned with Expo/Expo Router 57.0.16 and the current SDK 57 patch matrix; Expo Doctor passes all 20 checks.
- **2026-08-25 — canonical Phoenix Fitbit provider endpoints:** Phoenix now owns `https://app.leaetzak.love/api/fitbit/callback` and `https://app.leaetzak.love/api/fitbit/webhook`, including OAuth fallback generation, subscriber verification, signed webhook handling, route tests, deployment examples, and an external provider-registration runbook. Same-host `/fitbit/*` aliases remain temporarily for transition traffic; `game.leaetzak.love` no longer needs API proxy exceptions once the Fitbit developer settings are updated.
- **2026-08-24 — safe card/profile media lifecycle:** new uploads now enforce actual JPEG/PNG/WebP decoding, a 12 MiB/40 MP safety policy, orientation-aware WebP normalization and metadata, transactional reference swaps, retryable reference-safe MinIO cleanup, account-deletion cleanup, and a read-only database orphan audit. Catalog SVG behavior and all media URL/cache contracts remain unchanged. This is implemented on `codex/media-ingestion-lifecycle` and is not recorded as deployed.
- **2026-08-23 — mobile 1.0.32:** Perfect Timing now uses the themed confirmation modal before discarding a result, high leaderboard scores no longer break public-profile parsing, and the Expo 57 patch dependencies are aligned. Android versionCode 54 was accepted on the Google Play closed-testing track and iOS build 67 was validated by App Store Connect; tags `mobile/android/1.0.32` and `mobile/ios/1.0.32` point to `28764a8a`.
- **2026-08-23 — Perfect Timing result confirmation:** the native system alert shown before discarding an attempt result has been replaced by the shared themed modal and shared button layer. The dialog now offers explicit stay/discard actions, keeps English/French copy aligned, and has focused UI and Maestro coverage for both choices.
- **2026-08-23 — high-scoring player-profile compatibility:** the shared public-profile contract now accepts any non-negative integer personal-best score instead of rejecting valid scores above the obsolete 1,000-point ceiling. A focused contract regression reproduces the mobile error boundary and preserves negative-score rejection; a read-only production audit confirmed legitimate over-1,000 daily rows across multiple boards.
- **2026-08-23 — Expo 57 patch alignment:** Expo, Expo Router, the associated SDK 57 native modules, workspace overrides, npm lock, and iOS Pod lock were advanced to the current patch matrix. A clean npm install is reproducible and Expo Doctor passes all 20 checks with no duplicate native modules.
- **2026-08-19 — mobile 1.0.31:** Daily Numbers redesign and weekly leaderboard summary/tie improvements shipped through the production iOS and Android release workflows. Tags `mobile/ios/1.0.31` and `mobile/android/1.0.31` point to `250f3363`.
- **2026-08-19 — tie-aware mobile leaderboard podium:** unique first/second/third results retain the classic podium. Any tie in ranks 1–3 switches the full winning area to stacked placement groups, gives every tied player equal visual weight, and resumes the ordinary list at the next competition rank. English/French copy, pure presentation tests, authenticated-avatar coverage, and a fresh iOS Maestro screenshot validate the three-way third-place case.
- **2026-08-19 — weekly leaderboard result summaries:** weekly Phoenix projections and future snapshots now retain readable totals across all selected daily results rather than repeating one day. Outcome quests exclude failed/missed results from their time, guess, or error totals, while All Quests uses a compact scored/played ratio. The shared contract, English/French mobile formatting, help copy, focused backend/UI tests, and Maestro screenshot flow were updated together.
- **2026-08-18 — stale PR reconciliation (#244, #286, #291):** the 1.0.30 release record and historical 1.0.29 record were merged without downgrading current mobile metadata. The July Daily Numbers redesign branch was reconciled against the evolved Solution Hunt, result animation, sharing, navigation, and timing implementation; current gameplay behavior remains authoritative, while its still-relevant shared-button accessibility-state fallback was retained. Orphaned prototype-only helpers and Maestro flows were not carried into current source.
- **2026-08-18 — mobile 1.0.29:** Daily Numbers Solution Hunt shipped to both mobile platforms. Android version code 51 was submitted to Google Play and iOS build 64 was validated by App Store Connect; tags `mobile/android/1.0.29` and `mobile/ios/1.0.29` point to `baf3904e`. This historical release was superseded later the same day by mobile 1.0.30.
- **2026-08-18 — mobile 1.0.30:** Speed Calculus now routes simultaneous keypad contacts independently, the initial session countdown relies on its ring without incorrect resume/seconds copy, and focused Appium checks passed on fresh iOS and Android builds. Android version code 52 was accepted on the Google Play closed-testing track and iOS build 65 was validated in App Store Connect; tags `mobile/android/1.0.30` and `mobile/ios/1.0.30` point to `ea35255a`.
- **2026-08-18 — Speed Calculus multi-touch validation:** an E2E-only route now hosts the production answer box and keypad for a focused Appium 3 test. A fresh iOS simulator build registered 20/20 two-finger inputs across 0/1/4/8/16 ms pointer offsets, and a fresh Android emulator build registered 20/20 synchronized two-finger inputs. UiAutomator2 cannot synthesize staggered pointer downs as one valid Android multi-touch event, so Android coverage intentionally uses a 0 ms action tick.
- **2026-08-18 — Daily Numbers player-solution translation (PR #288):** solver output and player submissions now derive visible-step identity from the same canonical AST materialization. The version-3 lazy upgrade atomically replaces disposable official rows, translates retained player submissions, and reconstructs exact ranked attempts. Production deploy `afaf4875`/`32151688930` passed API/media readiness; all 2026-08-18 exact ranked attempts were represented after upgrade.
- **2026-08-18 — Daily Numbers visible-step deduplication (PR #287):** solution sets now count deterministic visible operation traces rather than structurally distinct ASTs that present the same calculations. Migration `20260818190000` and lazy version-2 replacement are deployed at `af4e0bfd`; the verified 2026-08-18 production totals are 17/81/4 for modes 1-5/2-4/3-3.
- **2026-08-18 — deterministic leaderboard reconciliation time (PR #285):** historical or explicitly timed reconciliation now propagates its supplied `now` value through result synchronization instead of consulting the wall clock again. Date-sensitive leaderboard tests pin source timestamps and derive controller snapshot dates from the current day, so cutoff scenarios no longer expire as the calendar advances.
- **2026-08-18 — Expo 57 patch alignment (PR #285):** Expo, Expo Router, and nine related native modules were aligned with the current SDK 57 compatibility matrix; root workspace overrides, npm resolution, and the iOS Pod lock were refreshed. Expo Doctor passes 20/20 checks, the dependency tree is deduplicated, and the lockfile mobile workspace version matches 1.0.30.
- **2026-08-18 — Daily Numbers Solution Hunt (PR #285):** completed ranked puzzles expose an optional no-reward/no-leaderboard replay mode. Phoenix canonicalizes associative/commutative addition and multiplication, enumerates and persists the complete solution set once on the challenge's first state load, records the accepted deterministic generation attempt for cheap reconstruction, tracks idempotent per-user discoveries, safely covers a challenge generated before deployment, and bounds future puzzle generation by a configurable solution-count range. The authoritative response numbers player solutions by discovery order and remaining solutions by stable canonical order; mobile and web show each route in a collapsed entry, hide the remaining set behind a reveal, and keep submissions on a separate endpoint. Hunt play replaces the ranked timer display with “Solution found” once a discovery exists.
- **2026-08-17 — leaderboard profile compatibility and log hygiene (mainline):** public-profile summaries omit derived-overall rows so installed clients whose board enum predates `overall/all-quests` can still render profiles; scheduled reconciliation no longer warns for the expected `result_window_closed` outcome. Focused Phoenix regression tests cover both behaviors.
- **2026-08-17 — mobile 1.0.28:** version bump, Expo 57 Hermes lock refresh, Android release build metaspace adjustment, and iOS/Android store release tags (`553e6cf1`, `cb52ae17`, `f7bd214d`, merge PR #283 at `580c832e`).
- **2026-08-17 — Daily Numbers ranking time:** rankings now use the saved quest's client chronometer instead of the server interval accidentally created by opening the screen; zero-minute formatting was improved (`ef44b0ef`, `4f084c98`, PR #282). Production Phoenix deploy `a49bcf0…` includes this work.
- **2026-08-17 — live and overall leaderboards:** live Daily/Weekly periods, all-eligible weekly sums, history cutoff behavior, latest Speed Calculus reconciliation, all-quests aggregate, explanations, and focused tests/flows (`6f81d791`, `5f8b08b7`, `dc63807a`, PRs #277/#278/#280).
- **2026-08-16 — Expo SDK 57:** Expo/React Native/native project and lockfile upgrade merged in PR #271 (`9d34b453`, merge `92814284`).
- **2026-08-16 — access request assessment:** canonical client IP handling, advisory trust evidence/scoring, Play Integrity challenges, admin review controls, retention, and tests merged in PR #272 (`2038794c` merge lineage).
- **2026-08-15 — leaderboard launch:** foundation, mobile rankings/public profiles, server result recording, lifecycle/finalization, corrections, weekly standings, and prizes merged in PRs #263/#264 (`7e9d6b9c`, `ff90fd37`).
- **2026-08-08 — Perfect Timing:** backend state machine, mobile game/training/share UI, migration, and tests landed in commit/PR lineage beginning at `b40970d…`.

## Work currently in progress

- **PLANNED — broader native redesign:** `docs/design/adventure-time-tcg-redesign.pen` and `docs/design/adventure-time-tcg-redesign-assets/` preserve a native-app baseline, three visual directions, a recommended “Tournament Companion” direction, design-system guidance, and handoff notes. No corresponding application-code implementation was found; the handoff explicitly leaves behavior changes subject to product approval.
- No open pull request remains after reconciling #244, #286, and #291. GitHub issue #256 is PLANNED exploration, not active implementation.

## Known issues and technical debt

### Confirmed

- **PARTIAL — media delivery variants:** card/profile ingestion and replacement cleanup are implemented, but media delivery still buffers each stored object, responsive variants are absent, and MinIO-only historical objects are outside the database orphan audit.
- **PARTIAL — stale prose:** README's iOS release note still describes temporary EAS profile submission rather than the current direct `xcrun altool` upload, omits `apps/mobile/src/i18n/locales/en/rankings.ts` and `apps/mobile/src/i18n/locales/fr/rankings.ts`, and admin overview copy says seven quest definitions although source defines eight. The Speed Calculus cash-out docstring says “best run,” while current code and recent reconciliation deliberately use the latest settled run.
- **PARTIAL — rarity icon integration:** `RarityIcon` exists but is private and unused.

### Suspected risks, not confirmed bugs

- Daily Numbers ranking time trusts a client-maintained elapsed millisecond value. Arithmetic correctness is server-validated, but no timing attestation or upper-bound validation was found.
- Device-health step totals are accepted from the authenticated client. Fitbit data has a server-side provider path, but no equivalent attestation was found for local device-health snapshots.
- The old open Daily Numbers UI pull request predates several current implementation changes and may require substantial reconciliation; merge conflict/behavior impact is UNKNOWN.

## Important decisions and invariants

- `Zax-code/adventure-time-tcg` is the authoritative repository for this state document. Do not use similarly named PWA/native repositories as current truth.
- Phoenix is the authoritative backend and Ecto migrations are the authoritative schema. `apps/api` and `packages/db` are legacy references.
- Web and mobile use `@adventure-time/api-client`; wire schemas and enums live in `@adventure-time/contracts`. UI translations do not.
- Persisted game state and PvP legality are server-authoritative. Client previews never override Phoenix. Measurement sources that remain client-originated are called out explicitly above.
- MinIO is private storage. Image access goes through Phoenix media routes; profile images require authentication.
- Active supported products are Phoenix, the responsive website, and Expo mobile for iOS/Android. Mobile store releases originate from the Mac, not GitHub Actions.
- Fitbit provider traffic terminates at Phoenix on `app.leaetzak.love`; the legacy PWA host must not be required for OAuth callbacks or subscriber notifications.
- Quest days follow the user's stored IANA timezone, defaulting to `Europe/Paris`. Existing leaderboard competition-slot boundaries remain immutable after creation.
- Mobile UI copy must remain aligned in English and French under `apps/mobile/src/i18n/locales/en` and `fr`. Canonical backend values stay raw and are localized at render time.
- Rarity names/order are Common, Uncommon, Rare, Epic, Legendary. Supported card themes are Candy, Ice, and Nightosphere. Supported card types are the ten canonical values listed in Card and rarity system.
- Leaderboard scoring is versioned and stored in milli-points. Clients submit quest actions/results, never points. Daily periods are provisional/no-prize; eligible finalized weekly boards award crowns/achievements; overall currently has no prizes.
- Card generation is local-review-first and live deployment requires explicit owner approval and backup/verification.
- Production database name is `adventure_time_tcg`; production persisted service data belongs under `/srv/adventure-time-tcg`.

## Realistic next priorities

1. **Reconcile stale operational prose.** Why: README release instructions no longer match the iOS script. Dependencies: none. Completion: release, translation, quest-count, and Speed Calculus documentation matches executable configuration.
2. **Add streaming and responsive media delivery only when prioritized.** Why: ingestion and cleanup are safe, but delivery still buffers one stored WebP and generates no variants. Dependencies: client sizing/caching policy and a variant storage strategy. Completion: bounded-memory delivery and documented responsive URL/cache behavior without breaking existing media routes.
## Open questions

- Should the active website eventually reach mobile feature parity for Rankings, Perfect Timing, full localization, and native-only health capabilities, or is its smaller scope intentional?
- Is reciprocal card trading a desired product feature? The repository currently establishes gifting only and contains no verified trading plan.
- What is the required retention/deletion policy for replaced card/profile/catalog objects in MinIO?
- Is issue #256 (albums and themed pack pools) approved roadmap work or only an exploration placeholder?

## Maintenance instructions

Future Codex tasks that materially affect the project should:

1. Verify affected sections against current code, migrations, configuration, release records, and recent Git history.
2. Update statuses when implementation or release state changes.
3. Update the verification date, branch, and full commit SHA.
4. Record important new decisions, invariants, or blockers.
5. Move completed work out of active sections and into Completed recently when still useful.
6. Keep this document concise, factual, and free of secrets or temporary debugging notes.
