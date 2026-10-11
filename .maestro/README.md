## Maestro smoke tests

These flows exercise the highest-risk mobile interaction shells we migrated during the Expo 56 / Expo UI pass.

Prerequisites:
- Phoenix running locally on `http://127.0.0.1:4200`
- dedicated E2E app installed with the scripts below
- Maestro CLI installed locally
- Test user prepared with `apps/phoenix/scripts/ensure-mobile-test-user.sh`

Run:

```bash
MOBILE_TEST_PASSWORD=password123 npm run build:mobile:e2e:ios
MOBILE_TEST_PASSWORD=password123 npm run install:mobile:e2e:ios
MOBILE_TEST_PASSWORD=password123 npm run test:mobile:e2e:ios
MOBILE_TEST_PASSWORD=password123 npm run test:mobile:e2e:pvp:ios
MOBILE_TEST_PASSWORD=password123 npm run test:mobile:e2e:pvp:head-to-head:ios

MOBILE_TEST_PASSWORD=password123 npm run build:mobile:e2e:android
MOBILE_TEST_PASSWORD=password123 npm run install:mobile:e2e:android
MOBILE_TEST_PASSWORD=password123 npm run test:mobile:e2e:android
MOBILE_TEST_PASSWORD=password123 npm run test:mobile:e2e:pvp:android
MOBILE_TEST_PASSWORD=password123 npm run test:mobile:e2e:pvp:head-to-head:android
```

The flows expect:
- `mobile-test@leaetzak.love`
- the password supplied through `MOBILE_TEST_PASSWORD`

Coverage:
- authenticated session bootstrap through a real backend-issued token pair
- bottom-tab navigation
- gifts filter controls
- PvP mechanics/reference entry and dismissal
- settings modal entry with authenticated preferences visible
- deterministic PvP fixture setup with two E2E users, valid loadouts, and an in-progress match
- PvP match entry, combat log visibility, card long-press details, action modal, basic targeting, and end-turn confirmation

Implementation note:
- the smoke flow no longer types credentials into the app UI
- `scripts/maestro.sh` logs into the local Phoenix backend first, injects the returned tokens plus user payload into the deep link, and the `e2e-auth` screen applies that session before navigating to PvP
- the dedicated PvP flow also provisions a deterministic local match through `apps/phoenix/scripts/ensure-mobile-test-pvp-fixture.sh` before the app launches
- this keeps the PvP validation focused on post-auth UI behavior instead of the Expo dev-client or text-input automation path
- the head-to-head PvP command injects a primary token session, verifies the live match board, advances the turn through Phoenix, injects an opponent token session, verifies the same match, records an opponent concede through Phoenix, and then opens the winner replay with a fresh primary token session
- `scripts/maestro-pvp-head-to-head.sh` runs those Maestro stages while `apps/phoenix/scripts/monitor-mobile-test-pvp-match.sh` prints backend match state, snapshots, and newly persisted events to `.maestro/test-output/pvp-head-to-head/<timestamp>/`

Build profile notes:
- `e2e-ios` builds a simulator app with `EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:4200`
- `e2e-android` builds an APK with `EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:4200`
- both profiles avoid the Expo dev-client launcher so Maestro can `launchApp` directly

## Flow index

Run any flow through the wrapper (never raw `maestro test`): `MOBILE_TEST_PASSWORD='<password>' ./scripts/maestro.sh test --platform <ios|android> .maestro/<flow>.yaml`. Shared steps live in `.maestro/subflows/`. "Last change" is the flow file's last commit.

### Smoke and auth

| Flow | Purpose | Command | Last change |
|------|---------|---------|-------------|
| `smoke.yaml` | Adventure Time mobile smoke | `npm run test:mobile:e2e:ios` | 2026-06-04 |
| `login-invalid-email.yaml` | Login invalid email shows friendly error | wrapper | 2026-06-06 |
| `auth-provider-buttons-screenshot.yaml` | Auth provider buttons screenshot | wrapper | 2026-06-28 |
| `orientation-tab-lock.yaml` | Orientation lock across PvP and tabs | wrapper | 2026-06-27 |
| `settings-sheet-screenshots.yaml` | Settings sheet focused screenshots | wrapper | 2026-06-03 |

### Quests

| Flow | Purpose | Command | Last change |
|------|---------|---------|-------------|
| `quests-redesign-smoke.yaml` | Quests redesign navigation smoke | `npm run test:mobile:e2e:quests:ios` | 2026-08-25 |
| `quest-midnight-cutoff.yaml` | Quest midnight cutoff | `npm run test:mobile:e2e:quest-cutoff:ios` | 2026-07-11 |
| `quests-list-reliability.yaml` | Quest list loads and keeps every quest card separated | wrapper | 2026-08-08 |
| `quests-order-customization.yaml` | Quest hub order can be customized | wrapper | 2026-08-08 |
| `quests-grouped-sheet-scroll.yaml` | Quest grouped sheet remains scrollable | wrapper | 2026-07-11 |
| `quests-perfect-timing-share.yaml` | Quest recap includes Perfect Timing | wrapper | 2026-08-08 |
| `quests-speed-calculus-share.yaml` | Quest recap shares Speed Calculus runs | wrapper | 2026-08-25 |
| `quest-reward-strike-screenshot.yaml` | Quest step card screenshot | wrapper | 2026-07-10 |
| `store-listing-quest-screenshots.yaml` | Store listing quest screenshots | wrapper | 2026-07-10 |
| `wordle-scroll-keyboard.yaml` | Wordle keyboard works after scroll | wrapper | 2026-06-03 |
| `daily-numbers-smoke.yaml` | Daily Numbers smoke | wrapper | 2026-07-14 |
| `daily-numbers-result-screenshots.yaml` | Daily Numbers result screenshots | wrapper | 2026-07-14 |
| `daily-numbers-archive-screenshots.yaml` | Daily Numbers archive screenshots | wrapper | 2026-07-14 |
| `perfect-timing.yaml` | Perfect Timing daily quest and training smoke | wrapper | 2026-08-23 |
| `perfect-timing-background.yaml` | Perfect Timing background stop | wrapper | 2026-08-08 |
| `perfect-timing-recovery.yaml` | Perfect Timing abrupt recovery | wrapper | 2026-08-08 |
| `perfect-timing-third-miss-share.yaml` | Perfect Timing third Miss and failed sharing | wrapper | 2026-08-23 |
| `speed-calculus-timer-drain.yaml` | Speed Calculus timer drains continuously across answers | wrapper | 2026-08-18 |
| `speed-calculus-training-keypad.yaml` | Speed Calculus training keypad accepts rapid input | wrapper | 2026-07-02 |

### PvP

| Flow | Purpose | Command | Last change |
|------|---------|---------|-------------|
| `pvp-smoke.yaml` | Adventure Time PvP battle smoke | `npm run test:mobile:e2e:pvp:ios` | 2026-06-27 |
| `pvp-head-to-head-primary.yaml` | Adventure Time PvP head-to-head primary board | `npm run test:mobile:e2e:pvp:head-to-head:ios` | 2026-06-21 |
| `pvp-head-to-head-opponent.yaml` | Adventure Time PvP head-to-head opponent board | (driven by the head-to-head script) | 2026-06-21 |
| `pvp-head-to-head-replay.yaml` | Adventure Time PvP head-to-head replay | (driven by the head-to-head script) | 2026-06-21 |
| `pvp-board-core.yaml` | Adventure Time PvP board core smoke | wrapper | 2026-06-27 |
| `pvp-board-points.yaml` | Adventure Time PvP board point smoke | wrapper | 2026-06-27 |
| `pvp-modal-regression.yaml` | Adventure Time PvP modal regression | wrapper | 2026-06-29 |
| `pvp-modal-screenshots.yaml` | PvP modal focused screenshots | wrapper | 2026-06-27 |
| `pvp-lobby-sheet-screenshots.yaml` | PvP lobby and sheet focused screenshots | wrapper | 2026-06-04 |
| `pvp-loadout-editor-screenshots.yaml` | PvP loadout editor focused screenshots | wrapper | 2026-07-02 |
| `pvp-reference-sheet-screenshots.yaml` | PvP reference sheet focused screenshots | wrapper | 2026-06-04 |
| `pvp-redesign-screenshots.yaml` | PvP board and replay redesign screenshots | wrapper | 2026-06-22 |

### Collection and packs

| Flow | Purpose | Command | Last change |
|------|---------|---------|-------------|
| `collection-ownership-filters.yaml` | Collection ownership filters | wrapper | 2026-06-15 |
| `collection-animation-lifecycle.yaml` | Collection animation lifecycle | wrapper | 2026-07-15 |
| `collection-detail-background-retention.yaml` | Collection remains mounted through card detail | wrapper | 2026-07-16 |
| `collection-card-sheet-screenshots.yaml` | Collection card sheet focused screenshots | wrapper | 2026-06-04 |
| `pack-opening-sequence-smoke.yaml` | Pack opening sequence smoke | wrapper | 2026-06-08 |
| `pack-opening-setup-storefront.yaml` | Pack opening setup storefront | wrapper | 2026-06-08 |
| `pack-opening-trigger-open.yaml` | Pack opening trigger open | wrapper | 2026-06-08 |
| `pack-opening-trigger-open-premium.yaml` | Pack opening trigger open premium | wrapper | 2026-06-08 |
| `pack-opening-reveal-summary-premium.yaml` | Pack opening reveal summary premium | wrapper | 2026-06-08 |
| `pack-opening-summary-card-preview.yaml` | Pack opening summary card preview | wrapper | 2026-06-21 |
| `pack-opening-finish-screenshots.yaml` | Pack opening finish screenshots | wrapper | 2026-06-08 |

### Rankings

| Flow | Purpose | Command | Last change |
|------|---------|---------|-------------|
| `rankings-screenshots.yaml` | Rankings focused screenshots | wrapper | 2026-08-17 |
| `rankings-board-results-screenshots.yaml` | Rankings board result screenshots | wrapper | 2026-08-17 |
| `rankings-tied-podium.yaml` | Rankings tied podium screenshot | wrapper | 2026-08-19 |
| `rankings-weekly-summaries.yaml` | Rankings weekly summary screenshots | wrapper | 2026-08-19 |

### Admin

| Flow | Purpose | Command | Last change |
|------|---------|---------|-------------|
| `admin-users-review.yaml` | Admin users review | wrapper | 2026-06-04 |
| `admin-user-editor-review.yaml` | Admin user editor review screenshots | wrapper | 2026-06-04 |
| `admin-card-editor-review.yaml` | Admin card editor review screenshots | wrapper | 2026-06-03 |
| `admin-ability-editor-review.yaml` | Admin ability editor review screenshots | wrapper | 2026-06-03 |
| `admin-abilities-toggle.yaml` | Admin abilities toggle | wrapper | 2026-06-03 |
| `admin-ability-toggle-screenshots.yaml` | Admin ability toggle focused screenshots | wrapper | 2026-06-03 |
