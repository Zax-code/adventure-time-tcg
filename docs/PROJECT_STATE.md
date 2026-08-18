# Adventure Time TCG — Project State

Last verified: 2026-08-18
Repository: `Zax-code/adventure-time-tcg`
Branch: `codex/daily-numbers-solution-hunt`
Commit: `2a9418c4c75ab56b2ed8eb93c97d237addf50909`

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

- **Production backend and website:** the `Deploy Phoenix` workflow completed successfully for `a49bcf0d2effa258bacdc1b99146732a10dd9550` on 2026-08-17 (GitHub Actions run `32040865305`). That revision contains the live daily/weekly leaderboard work, the overall leaderboard, and the Daily Numbers timing correction. The commits after it through current HEAD are the 1.0.28 mobile release merge and do not add a newer Phoenix implementation.
- **Mobile:** annotated tags `mobile/android/1.0.28` and `mobile/ios/1.0.28` both resolve to `f7bd214d34aaeb8a073812d0061355d5e79bccd5`, with release timestamps on 2026-08-17. The release note identifies the Daily Numbers leaderboard timing and formatting fix.
- **Not released:** open pull request #244, “Redesign the Daily Numbers in-game UI,” is not on `main`. The tracked native redesign workspace under `docs/design` is a design specification, not evidence of implemented or released application changes.
- **Not released:** the working branch `codex/daily-numbers-solution-hunt` adds a post-completion Daily Numbers mode for discovering canonical distinct solutions without changing the ranked attempt, reward, or leaderboard result.
- **Local data:** local Docker database observations in this document are explicitly labeled. They are not evidence of production catalog contents.

## Current architecture

- **Mobile application:** Expo Router routes in `apps/mobile/app`, product code in `apps/mobile/src`, checked-in native projects in `apps/mobile/ios` and `apps/mobile/android`, and bundled art in `apps/mobile/assets`. It calls Phoenix through `@adventure-time/api-client`, receives quest changes through a Phoenix channel, polls REST endpoints for current PvP state, and stores session state securely on-device.
- **Web application:** React routes in `apps/web/src/app.tsx` and `apps/web/src/route-manifest.ts`. The production build is copied into Phoenix static assets by `apps/phoenix/Dockerfile`; browser authentication uses secure Phoenix session endpoints.
- **Backend/API:** Phoenix contexts under `apps/phoenix/lib/adventure_time_api`, controllers/channels under `apps/phoenix/lib/adventure_time_api_web`, and the canonical route map at `apps/phoenix/lib/adventure_time_api_web/router.ex`. Phoenix owns authentication, persistence, uploads, jobs, quests, leaderboards, and PvP validation.
- **Database:** PostgreSQL 16 with Ecto schemas in `apps/phoenix/lib/adventure_time_api` and 46 canonical migrations in `apps/phoenix/priv/repo/migrations`. `packages/db` is legacy Drizzle reference material.
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
| Mobile | Expo `57.0.13`, Expo Router `57.0.13`, React Native `0.86.2`, React `19.2.3`, Reanimated `4.5.1`, NativeWind `4.2.3`, Software Mansion Bottom Sheet `0.12.0`, Expo Image, TanStack Query `5.101.4`, Zustand `5.0.15` |
| Web | React `19.2.3`, React Router `7.18.x`, Vite `8.2.1`, TanStack Query `5.101.4`, Vitest `4.1.10` |
| Shared TypeScript | Zod `3.25.76`; TypeScript `6.0.3` for mobile/web and `5.9.3` for shared packages in the installed tree |
| Backend | Elixir `1.19.5` and OTP `28` in CI/release images; Phoenix `1.8.5`, Ecto SQL `3.13.5`, Postgrex `0.22.0`, Bandit `1.10.3`, Oban `2.21.1`, Req `0.5.17`, JOSE `1.11.12`, bcrypt_elixir `3.3.2`, tzdata `1.1.3` |
| Runtime/data | Node `22.14.0`, PostgreSQL `16-alpine`, MinIO `RELEASE.2025-02-28T09-55-16Z` |
| Build/release | npm workspaces, EAS local builds, native Xcode/Gradle projects, Maestro, Docker Buildx, GHCR, Phoenix releases |
| Production infrastructure | Podman Quadlet, systemd, Caddy, GitHub Actions, persistent data under `/srv/adventure-time-tcg` |

The Expo 57 migration itself is merged, but the current Expo Doctor result is not clean; see Known issues and technical debt.

## Applications and services

| Component | Purpose and communication | Location | Status | Release posture |
|---|---|---|---|---|
| Expo mobile app | Primary native player/admin client; REST via `@adventure-time/api-client`, a Phoenix quest channel, PvP polling, and push notifications | `apps/mobile` | COMPLETE | Actively released; iOS and Android 1.0.28 are tagged |
| Responsive website | Browser player/admin client using the same client/contracts; served as Phoenix static content in production | `apps/web` | COMPLETE | Active; deployed with Phoenix at `a49bcf0…` |
| Phoenix API | Canonical backend, auth, gameplay, persistence, media, jobs, and web session host | `apps/phoenix` | COMPLETE | Active production service |
| PostgreSQL | Canonical persistent store and Oban job store | Ecto schemas and `apps/phoenix/priv/repo/migrations` | COMPLETE | PostgreSQL 16 production container |
| MinIO | Private card, profile, card-back, and catalog image objects | `apps/phoenix/lib/adventure_time_api/media.ex`, `infra/containers/quadlet` | COMPLETE | Active production service |
| Oban | Expiry, assessment, pruning, and leaderboard lifecycle processing | `apps/phoenix/lib/adventure_time_api/workers` | COMPLETE | Runs inside Phoenix production release |
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
| Quests | Daily Numbers | COMPLETE | Deterministic 1-5, 2-4, and 3-3 modes; server-validated arithmetic; score-scaled rewards; one daily result/mode; 30-day archive; mobile/web UI; per-mode and family boards; post-completion Solution Hunt with canonical solution enumeration and per-user progress | `apps/phoenix/lib/adventure_time_api/quests/daily_numbers_engine.ex`; `apps/phoenix/lib/adventure_time_api/quests/daily_numbers_solver.ex`; `apps/phoenix/lib/adventure_time_api/quests/daily_numbers_solution_hunt.ex`; Daily Numbers routes/tests |
| Quests | Speed Calculus | COMPLETE | Three 30-second scored runs, deterministic server questions, pause/resume, server answer scoring, training, cash-out, reward up to 80 coins, and latest-run leaderboard reconciliation | `apps/phoenix/lib/adventure_time_api/quests/speed_calculus_engine.ex`; `apps/phoenix/lib/adventure_time_api/quests.ex`; commit `5f8b08b7` |
| Quests | Perfect Timing | COMPLETE | Deterministic 3–10 second target, three-attempt state machine, monotonic client measurement with server plausibility checks/recovery, tiered rewards, training/sharing, and leaderboard | `apps/phoenix/lib/adventure_time_api/quests/perfect_timing.ex`; `apps/phoenix/lib/adventure_time_api/quests/perfect_timing_engine.ex`; commit `b40970d` |
| Rankings | Per-quest leaderboards | COMPLETE | Steps, three Daily Numbers modes, English/French Wordle, Speed Calculus, and Perfect Timing source boards are implemented and deployed | `apps/phoenix/lib/adventure_time_api/leaderboards/boards.ex`; `apps/phoenix/lib/adventure_time_api_web/controllers/leaderboards_controller.ex`; `apps/phoenix/priv/repo/migrations/20260815160000_create_leaderboard_foundation.exs`; deploy `a49bcf0` |
| Rankings | Family, weekly, daily, history, and overall boards | COMPLETE | Daily Numbers and Wordle family sums, live daily/weekly projections, finalized history, and overall/all-quests are implemented with mobile period/board selectors | `apps/phoenix/lib/adventure_time_api/leaderboards/projection.ex`; `apps/phoenix/lib/adventure_time_api/leaderboards/query.ex`; `apps/phoenix/priv/repo/migrations/20260817150000_enable_sum_all_weekly_scoring.exs`; `apps/phoenix/priv/repo/migrations/20260817160000_add_overall_quests_leaderboard.exs` |
| Rankings | Leaderboard rewards and prizes | COMPLETE | Finalized eligible weekly podiums receive gold/silver/bronze achievements and 3/2/1 family crowns through idempotent grants. Daily and overall boards do not award crowns. | `apps/phoenix/lib/adventure_time_api/leaderboards/prizes.ex`; `apps/phoenix/lib/adventure_time_api/leaderboards/lifecycle.ex`; reward schemas/tests |
| PvP | Asynchronous battles | COMPLETE | Invites, accept/decline/expiry, server-validated actions, energy/cooldowns/statuses/passives, 24-hour turns, persistence journal/snapshots, history/replay, spectating, REST polling, and push notifications | `apps/phoenix/lib/adventure_time_api/pvp.ex`; `apps/phoenix/lib/adventure_time_api/pvp/battle_engine.ex`; PvP controllers/tests |
| PvP | Deck/loadout management | COMPLETE | CRUD for unique six-card owned loadouts with rarity caps; mobile and web editors exist | `apps/phoenix/lib/adventure_time_api/pvp/loadout.ex`; `apps/phoenix/lib/adventure_time_api/pvp.ex`; mobile/web loadout routes |
| Social | Card gifting | COMPLETE | One-way card gifts with pending/accept/decline/expiry behavior and push notification | `apps/phoenix/lib/adventure_time_api/social.ex`; `apps/phoenix/lib/adventure_time_api/social/card_gift.ex`; gift routes/screens |
| Social | Trading | UNKNOWN | No reciprocal trade schema, route, UI, or owner-approved implementation plan was found. Gifting is not trading. | Router, schemas, and repository search |
| Sharing | Quest/result sharing | PARTIAL | Mobile share images/results exist for Wordle, Daily Numbers, and Perfect Timing. Steps and Speed Calculus are not shareable. Card transfers between users are separately implemented as gifts. | `apps/mobile/src/features/quests/quest-hub-model.ts`; `apps/mobile/src/features/quests/grouped-quest-share-image.tsx`; `apps/phoenix/lib/adventure_time_api/social.ex` |
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

- **Model:** `image_assets` stores `kind` (`card`, `profile`, or `catalog`), MIME type, object key, and optional placeholder SVG (`apps/phoenix/lib/adventure_time_api/catalog/image_asset.ex`; migration `apps/phoenix/priv/repo/migrations/20260324130500_create_foundation_tables.exs`). Cards, users, packs, and card-back visuals reference image assets.
- **Uploads:** authenticated users upload their profile image at `POST /settings/upload`; admins upload card images at `POST /admin/cards/:id/image` and catalog assets at `POST /admin/image-assets` (`apps/phoenix/lib/adventure_time_api_web/router.ex`, `apps/phoenix/lib/adventure_time_api_web/controllers/media_controller.ex`, `apps/phoenix/lib/adventure_time_api_web/controllers/admin_controller.ex`).
- **Formats and limits:** catalog uploads allow PNG, JPEG, WebP, and SVG. Card/profile backend paths accept the multipart-declared MIME type without their own allowlist, content sniffing, dimension validation, or decoder validation. Phoenix does not override Plug's 8,000,000-byte multipart default (`apps/phoenix/lib/adventure_time_api_web/endpoint.ex`); the production Caddy site has a separate 16 MB outer request-body limit.
- **Processing:** upload handlers read the temporary file into memory and store the same bytes/MIME type. No resize, recompression, metadata stripping, transcoding, responsive variant generation, or thumbnail pipeline exists. There is one stored object, not a separate retained raw upload plus optimized outputs.
- **Keys:** new profile objects use `profile/<user-id>/<uuid>`, card objects use `card/<card-id>/<uuid>`, and general catalog objects use `catalog/<uuid>`. Imported/seeded catalog assets may use deterministic catalog keys.
- **Storage:** `Media` implements AWS Signature V4 requests with Req against the private MinIO bucket. Production uses the `private-images` bucket and persistent MinIO data under `/srv/adventure-time-tcg/minio`.
- **Delivery:** `/media/card/:id` and `/media/catalog/:id` are public. `/media/profile/:id` requires authentication. Card/catalog responses use `public, max-age=31536000, immutable`; profile responses use `private, max-age=3600`.
- **Fallbacks:** missing object keys or object 404s return kind-specific placeholder SVGs. Other storage failures return a gateway error.
- **Replacement and cleanup:** uploading a replacement creates a new object and row, then changes the card/user foreign key. The prior asset row/object is not removed. Account deletion removes the avatar asset row, but no MinIO delete request exists, so the object remains. No general asset-delete route or orphan cleanup job was found.
- **Clients:** mobile card/catalog images use `expo-image` memory/disk cache keys and prefetch helpers (`apps/mobile/src/lib/card-images.ts`, `apps/mobile/src/lib/catalog-images.ts`). Authenticated profile images attach the access token. Web card/catalog images are lazy/async; profile images are fetched as authenticated object URLs.
- **Current limitations:** upload and delivery paths buffer whole objects in application memory, images are single-size originals, and replacement/deletion can leave unreferenced MinIO objects. These are descriptions of current behavior, not proposed designs.

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
- **Quests/health:** `daily_quests`, step snapshots, Fitbit accounts, Wordle dictionary/definitions/attempts, Speed Calculus runs, Daily Numbers daily/archive attempts, shared Daily Numbers solution sets and canonical expressions, per-user Solution Hunt discoveries, and Perfect Timing attempts.
- **Leaderboards:** boards, immutable scoring versions, user competition slots, ranked sessions, daily results, periods, snapshots/rows/corrections, telemetry, achievements, reward wallets, and idempotent grants.
- **Operations:** notification devices and Oban job tables.

The foundation begins at `apps/phoenix/priv/repo/migrations/20260324130500_create_foundation_tables.exs`; leaderboard state is introduced by `apps/phoenix/priv/repo/migrations/20260815160000_create_leaderboard_foundation.exs` and extended by `apps/phoenix/priv/repo/migrations/20260817150000_enable_sum_all_weekly_scoring.exs` and `apps/phoenix/priv/repo/migrations/20260817160000_add_overall_quests_leaderboard.exs`. Do not infer current schema from `packages/db`.

At verification time the local development database was migrated through the Solution Hunt migration and Phoenix `/ready` returned successfully. Production remains on the release boundary above until this branch is deployed and its migration runs.

## Deployment and releases

- **Target:** `https://app.leaetzak.love`, reverse-proxied by Caddy to Phoenix on `127.0.0.1:4200`. The checked-in Caddy site sets a 16 MB body limit and HSTS (`infra/caddy/app.leaetzak.love.Caddyfile`).
- **Production services:** `adventure-time-tcg-api`, PostgreSQL 16, and MinIO run as the `adventure-time-tcg` Podman pod through Quadlet/systemd. Host-only ports are 4200 for Phoenix, 5434 for PostgreSQL, and 9100/9101 for MinIO API/console.
- **Persistence:** production PostgreSQL and MinIO data live under `/srv/adventure-time-tcg`. Runtime environment files and signing credentials live outside source control.
- **Backend/web delivery:** `.github/workflows/deploy-phoenix.yml` builds an immutable GHCR image containing the Vite bundle and Phoenix release, deploys the selected SHA over SSH, renders container env files, runs `AdventureTimeApi.Release.migrate`, installs/restarts Quadlets, then checks API and media readiness.
- **CI:** `.github/workflows/ci.yml` conditionally runs infrastructure tests, workspace typechecks/builds/web tests, Phoenix tests, and container validation. Run `32044367068` passed for the pre-Solution-Hunt mainline; this working branch has not run in GitHub CI.
- **Mobile version:** `apps/mobile/package.json`, `apps/mobile/app.json`, Android `versionName`, and iOS `CFBundleShortVersionString` are 1.0.28. iOS `CFBundleVersion` is 63. EAS uses remote app-version state and production auto-increment; Android's checked-in `versionCode 1` is therefore not the released build number.
- **Mobile release:** `scripts/release-mobile.mjs` orchestrates one or both platforms. Android builds a local AAB, submits through EAS/Google Play, requires a release note, and updates Play release notes. iOS builds a local IPA and uploads directly with Apple's `xcrun altool` and App Store Connect API credentials. Successful releases create annotated per-platform Git tags.
- **Environment convention:** Phoenix uses `apps/phoenix/.env`, mobile uses `apps/mobile/.env`, and production secrets are supplied through external runtime env files. No secret value belongs in this document.
- **Current blockers:** release 1.0.28 is already tagged on both platforms. For the next mobile change, Expo Doctor remains BLOCKED by 11 pre-existing Expo 57 patch mismatches. Availability of future signing/service-account material was deliberately not exposed or revalidated and is UNKNOWN. The local development database is current through the Solution Hunt migration.

## Completed recently

- **2026-08-18 — Daily Numbers Solution Hunt (working branch):** completed ranked puzzles expose an optional no-reward/no-leaderboard replay mode. Phoenix canonicalizes associative/commutative addition and multiplication, enumerates and persists the complete solution set once on the challenge's first state load, records the accepted deterministic generation attempt for cheap reconstruction, tracks idempotent per-user discoveries, safely covers a challenge generated before deployment, and bounds future puzzle generation by a configurable solution-count range. The authoritative response numbers player solutions by discovery order and remaining solutions by stable canonical order; mobile and web show each route in a collapsed entry, hide the remaining set behind a reveal, and keep submissions on a separate endpoint. Hunt play replaces the ranked timer display with “Solution found” once a discovery exists.
- **2026-08-17 — leaderboard profile compatibility and log hygiene (working branch):** public-profile summaries omit derived-overall rows so installed clients whose board enum predates `overall/all-quests` can still render profiles; scheduled reconciliation no longer warns for the expected `result_window_closed` outcome. Focused Phoenix regression tests cover both behaviors.
- **2026-08-17 — mobile 1.0.28:** version bump, Expo 57 Hermes lock refresh, Android release build metaspace adjustment, and iOS/Android store release tags (`553e6cf1`, `cb52ae17`, `f7bd214d`, merge PR #283 at `580c832e`).
- **2026-08-17 — Daily Numbers ranking time:** rankings now use the saved quest's client chronometer instead of the server interval accidentally created by opening the screen; zero-minute formatting was improved (`ef44b0ef`, `4f084c98`, PR #282). Production Phoenix deploy `a49bcf0…` includes this work.
- **2026-08-17 — live and overall leaderboards:** live Daily/Weekly periods, all-eligible weekly sums, history cutoff behavior, latest Speed Calculus reconciliation, all-quests aggregate, explanations, and focused tests/flows (`6f81d791`, `5f8b08b7`, `dc63807a`, PRs #277/#278/#280).
- **2026-08-16 — Expo SDK 57:** Expo/React Native/native project and lockfile upgrade merged in PR #271 (`9d34b453`, merge `92814284`).
- **2026-08-16 — access request assessment:** canonical client IP handling, advisory trust evidence/scoring, Play Integrity challenges, admin review controls, retention, and tests merged in PR #272 (`2038794c` merge lineage).
- **2026-08-15 — leaderboard launch:** foundation, mobile rankings/public profiles, server result recording, lifecycle/finalization, corrections, weekly standings, and prizes merged in PRs #263/#264 (`7e9d6b9c`, `ff90fd37`).
- **2026-08-08 — Perfect Timing:** backend state machine, mobile game/training/share UI, migration, and tests landed in commit/PR lineage beginning at `b40970d…`.

## Work currently in progress

- **IN PROGRESS — Daily Numbers UI redesign:** pull request #244 (`codex/daily-numbers-ui-redesign` → `main`) remains open. It was last updated 2026-07-14, before later Daily Numbers and leaderboard work; current merge/rebase fitness was not established.
- **PLANNED — broader native redesign:** `docs/design/adventure-time-tcg-redesign.pen` and `docs/design/adventure-time-tcg-redesign-assets/` preserve a native-app baseline, three visual directions, a recommended “Tournament Companion” direction, design-system guidance, and handoff notes. No corresponding application-code implementation was found; the handoff explicitly leaves behavior changes subject to product approval.
- No other open pull request was returned by the repository query. GitHub issue #256 is PLANNED exploration, not active implementation.

## Known issues and technical debt

### Confirmed

- **BLOCKED — Expo Doctor:** 19/20 checks pass, but the SDK dependency check expects 11 newer Expo 57 patch versions, including Expo/Router 57.0.14 instead of installed 57.0.13. This finding is unchanged by the Solution Hunt work.
- **PARTIAL — release metadata consistency:** `package-lock.json` records the `apps/mobile` workspace version as 1.0.22 while the package/app/native manifests and release tags are 1.0.28.
- **PARTIAL — media validation/lifecycle:** card/profile uploads have no backend MIME allowlist or image validation; replacement and account deletion do not remove corresponding MinIO objects; whole files are buffered for upload/delivery.
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
- Quest days follow the user's stored IANA timezone, defaulting to `Europe/Paris`. Existing leaderboard competition-slot boundaries remain immutable after creation.
- Mobile UI copy must remain aligned in English and French under `apps/mobile/src/i18n/locales/en` and `fr`. Canonical backend values stay raw and are localized at render time.
- Rarity names/order are Common, Uncommon, Rare, Epic, Legendary. Supported card themes are Candy, Ice, and Nightosphere. Supported card types are the ten canonical values listed in Card and rarity system.
- Leaderboard scoring is versioned and stored in milli-points. Clients submit quest actions/results, never points. Daily periods are provisional/no-prize; eligible finalized weekly boards award crowns/achievements; overall currently has no prizes.
- Card generation is local-review-first and live deployment requires explicit owner approval and backup/verification.
- Production database name is `adventure_time_tcg`; production persisted service data belongs under `/srv/adventure-time-tcg`.

## Realistic next priorities

1. **Align Expo 57 patch dependencies.** Why: Expo Doctor currently fails and repository policy makes that a mobile completion blocker. Dependencies: current Expo 57 compatibility matrix and checked-in native projects. Completion: `npx expo-doctor`, typecheck, focused mobile tests, and native dependency checks pass without new findings.
2. **Reconcile mobile release metadata and stale operational prose.** Why: the lockfile reports 1.0.22 while released manifests/tags are 1.0.28, and README release instructions no longer match the iOS script. Dependencies: none beyond preserving current dependency resolution. Completion: install metadata is consistent and release/translation/quest-count documentation matches executable configuration.
3. **Define and enforce the media replacement/validation lifecycle.** Why: current upload paths accept unvalidated card/profile bytes and leave MinIO objects behind after replacement/deletion. Dependencies: owner decision on retention and accepted formats/limits. Completion: documented policy, validated uploads, object cleanup/reconciliation, and tests for replacement/account deletion.
4. **Triage pull request #244 against current Daily Numbers.** Why: it is the only open implementation PR and predates the current game, timing, Expo 57, and leaderboard changes. Dependencies: owner confirmation that the redesign is still desired. Completion: refresh and verify it against current `main`, or close it explicitly.

## Open questions

- Is pull request #244 still the desired Daily Numbers visual direction, or should it be closed in favor of the current implementation?
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
