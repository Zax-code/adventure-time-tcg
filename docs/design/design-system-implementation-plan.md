# Design system implementation plan

Turns `docs/design/design-system-proposal.pen` (summary in
`docs/design/design-system-proposal.md`) into code, one lot per pull request.
Each lot leaves the app shippable. No gameplay, contract, backend or data
change is part of this plan.

Status: planned, not started. Prerequisite: pull requests #324 (view
inventory) and #325 (proposal) merged, or the branch based on #325.

## Ground rules

- Behavior does not change. Every screen keeps its routes, data, actions,
  copy and test ids; only chrome, hierarchy and controls move to shared parts.
- The `.pen` is the spec. When a value is in doubt, read it from the file
  (board 01 for tokens, board 02 for component anatomy, board 03 for rules,
  board 04 for each screen).
- Collectible cards (`card-tile.tsx`, pack reveal, gifts) are never wrapped in
  a Card or captioned tile. Their art and rarity outline stay as they are.
- NativeWind `className` first on mobile; `style` only for gradients, blur,
  animation, measured sizes, safe-area math and `contentContainerStyle`.
- Command buttons go through the shared button layer only. Direct `Pressable`
  stays for cards, rows, chips, segments, keys, game-board controls and
  backdrops.
- One lot per branch and pull request, named `codex/ds-<lot>`. The user merges.

## Lots

### Lot 0: tokens as the single source

Goal: `packages/theme` owns every token; mobile and web consume generated
output instead of hand-copied values.

Changes:

- `packages/theme/src/index.ts`: keep the 39 `THEME_COLORS` per theme; add
  `RADIUS` (sm 12, md 16, lg 24, xl 28, pill 999), `SPACE` (1:4, 2:8, 3:12,
  4:16, 5:20, 6:24, 8:32), `TYPE` (display 34, h1 28, h2 22, h3 17, body 15,
  sm 13, caption 12, overline 11; weights 400/600/700/800; line heights 1.2
  titles, 1.45 body), `CONTROL` (lg 52, md 44, sm 36, iconButton 40, input
  48, header 56, tabBar 68), `SHADOW` and `BACKDROP` per theme (values from
  board 01).
- Add a small generator script in `packages/theme` that writes:
  - `apps/mobile/global.css` (all three themes, no hardcoded candy block),
  - `apps/web/src/theme/theme.css` (replaces the 116 hand-copied hex values).
  Wire it to `npm run build` of the package and check the output in.
- `apps/mobile/tailwind.config.js`: expose radius, spacing, font size and
  control heights from the package; delete the dead `pinkLight`, `pinkMedium`,
  `pinkDark`, `yellowLight`, `yellowMedium`, `mint`, `lavender` tokens (zero
  usages).
- `apps/mobile/src/theme/themes.ts`: build `THEME_VARS` from the same
  export; `apps/mobile/src/theme/layout.ts` reads header, tab bar and gaps
  from `CONTROL`.
- `apps/web/src/styles.css`: replace the four `--radius-*` variables with the
  generated scale; drop every `font-weight: 900` (36 sites) to 800.
- `apps/mobile/src/components/theme.ts`: keep the card type and rarity
  palettes but express them from theme tokens where a token exists; document
  the ones that must stay bespoke (card art).

Acceptance: `grep -c "#[0-9A-Fa-f]\{6\}" apps/web/src/theme/theme.css` is
generated output only; no `pinkLight` et al. in the repo; `npm run typecheck`,
`npm run build:web`, `cd apps/mobile && npx expo-doctor` pass.

### Lot 1: mobile primitives

Goal: the board 02 components exist once in `apps/mobile/src/components/ui/`
and nothing else defines their look.

Build, in this order, each with a Storybook-free preview route under
`app/e2e-ui-kit.tsx` (dev only, like `e2e-auth.tsx`) so Maestro can capture
the kit:

1. `Button` (tone primary / secondary / ghost / danger; size lg 52 / md 44 /
   sm 36; optional icon; pill; label 15/700, sm 13/700). Replace
   `primary-button.tsx`, `secondary-button.tsx`, `ghost-button.tsx` with
   re-exports, delete `fallbackAppearance` overrides in callers
   (`(tabs)/pvp.tsx` 19, `collection-card-detail.tsx` 8, `pvp-loadouts.tsx`
   6, `gifts.tsx`, `settings.tsx`, `pvp-history.tsx`, `pvp-match.tsx`,
   `pvp-spectate.tsx`, `pvp-replay.tsx`). `features/quests/quest-action-button.tsx`
   and the auth CTA in `auth-form.tsx` become `Button` instances.
2. `IconButton` (40 circle, 20 icon, surface + primaryBorder, tone override).
3. `Chip` (28 high, 12/700, optional 14 icon, tones neutral / primary /
   secondary / accent / success / info / danger / selected). Replaces
   `QuestVariantChip`, `AdminChip`, `AbilityTypeChip`, `AdminFilterChip`,
   `ActionEnergyPill`, the card-tile badge, the error eyebrow pill. Sentence
   case only.
4. `SegmentedControl` (pill container 44, 4 padding, primary active segment,
   counts inline).
5. `IconTile` (40 or 32, radius 16, tone tint + tone text icon).
6. `StatTile` (label 12/700, value 24/800, optional caption; neutral or tone
   tint). Replaces `AdminStat` and every per-screen tile.
7. `Card` (surface, radius 24, padding 16, 1px primaryBorder, no shadow; tone
   tint variant). Replaces `AdminPanel`, `QuestHubCard` shells.
8. `SectionHeader` (22/800 title, 13 subtitle, trailing ghost-sm action).
9. `Notice` (IconTile 32 + 15/800 title + 13 body, radius 16, tones info /
   warning / success / danger). Replaces `AdminNotice`, `ToastBanner` body,
   the rule banners in sheets and the mint pills.
10. `ListRow` (IconTile + title 15/700 + meta 13 + trailing chip / value /
    chevron, 56 min, hairline divider).
11. `Input` (48 high, radius 16, 1px border, 2px primary when focused,
    optional leading icon). Wraps `ThemedExpoTextInput`; replaces `AdminField`
    and `AdminSearchInput` chrome and the auth input styles.
12. `ProgressBar` (8 high pill, primaryTint track, primary fill, successDark
    when complete).
13. `StatePanel` (IconTile 48 + 17/800 title + 15 body + optional Button sm;
    variants empty / error / loading). Replaces `PageErrorState`,
    `SectionErrorState`, `LoadingPanel`, `PageLoadingState`,
    `AdminEmptyState`, `AdminLoadingState`.
14. `Dialog` (342 wide, radius 28, IconTile 48 + 20/800 title + 15 body,
    actions row Ghost + Primary or one full-width Primary, `$backdrop`).
    Replaces `ThemedModal` and `AdminModal` chrome.

Acceptance: the kit route renders every variant; `npm run doctor` clean;
no new hex literals in `src/components/ui/`.

### Lot 2: headers, sheets and navigation

- `AppHeader` (`app-header.tsx`): 56 high, coin `Chip` left, up to three
  `IconButton`s right, transparent. Never renders a title.
- New `PageTitle` (28/800 left, 15 subtitle, optional trailing ghost-sm).
- New `StackHeader` (IconButton back, centered 17/800 title, optional
  trailing IconButton, 56 high, transparent). Replaces
  `features/quests/quest-screen-header.tsx` and the ad-hoc headers in
  `pvp-loadouts`, `pvp-history`, `pvp-spectate`, `pvp-match`, `pvp-replay`,
  `pvp-card-details`, `pvp-spectate-match`, `public-profile-screen`,
  `quests/daily-numbers.tsx`. Remove the white top bands.
- `SheetHeader`: extract the header of `modal-sheet-route.tsx` (handle 40x4,
  22/800 title, 13 subtitle, hairline) and use it in every direct
  `ModalBottomSheet` (dust guide, quest launch, quest order, pack preview).
- `bottom-tab-bar.tsx` / `bottom-tab-bar-frame.tsx`: 68 high, label 11/700,
  active = primaryTint pill + primaryText, inactive fgMuted, order Home,
  Packs, PvP, Quests, Collection, Rankings; admin tab bar is the same
  component with its own items.
- One `$backdrop` token for `ModalSheetRoute`, `ThemedModal`/`Dialog`,
  `AdminModal` and `BattleFullScreenSheet`.

Acceptance: every tab screen = AppHeader + PageTitle; every pushed screen =
StackHeader at the same y; every sheet = SheetHeader. Maestro
`view-inventory-screenshots.yaml` still passes (test ids unchanged).

### Lot 3: tab screens

Migrate one screen per commit, matching board 04:

- Home `(tabs)/index.tsx`: Notice + inline actions, reward Card (secondary
  tint) with StatTiles and one Primary lg, collection Card with ProgressBar,
  quick actions as ListRows.
- Quests `(tabs)/quests.tsx` + `quest-hub-components.tsx`: PageTitle, today
  Card (primary tint, overline, count, ProgressBar, Primary lg), ListRows
  with reward Chips.
- Rankings `rankings-screen.tsx`: two SegmentedControls, family Chips, period
  Card with info Chip, standings list, StatePanel when empty, Ghost help.
- Collection `(tabs)/collection.tsx`: StatTiles (dust, owned), Input,
  SegmentedControl, rarity Chips, SectionHeader with Sort action; grid items
  stay the bare `CardTile`.
- Gifts `(tabs)/gifts.tsx`: PageTitle, three StatTiles, SegmentedControl,
  StatePanel, send Card with Primary.
- PvP `(tabs)/pvp.tsx`: PageTitle, StatTiles, success Notice for the active
  battle, challenge Card with Primary lg, ListRows.
- Packs `(tabs)/packs.tsx`: PageTitle, pack cards keep their art but use Card
  radius/padding, price as secondary Chip; pack opening screens unchanged.

Acceptance: `npx react-doctor --scope changed --base main` clean; raw
`Pressable` command buttons in these files = 0; re-run the view-inventory
Maestro flows and attach the new captures to the pull request.

### Lot 4: stack screens and games

- Quest hubs: Speed Calculus index and training, Daily Numbers history,
  Perfect Timing idle: StackHeader, Notice, Cards, StatTiles, Button.
- Game kit in `src/components/ui/game/`: `GameTile` (56, radius 16, states
  empty / filled / correct / present / absent), `GameKey` (32x44, Enter 56,
  Delete 44, same states), `KeypadKey` (56 high, radius 16, default /
  selected / operator / used / action), `GameHud` (Card with two stats,
  optional Pause ghost-sm, ProgressBar). Keep the existing hit-testing and
  scroll behavior of the Wordle keyboard (see `.maestro/wordle-scroll-keyboard.yaml`).
- Wordle, Daily Numbers play, Speed Calculus run panel, Perfect Timing
  running: swap visuals to the kit; results use `Dialog`.
- PvP: `pvp-loadouts`, `pvp-history`, `pvp-spectate`, `public-profile`:
  StackHeader, StatTiles, ListRows, StatePanel. Battle board
  (`features/pvp/battle-board.tsx`, `action-buttons.tsx`, `action-modal.tsx`,
  `card-info-modal.tsx`): chrome only, IconButtons, Chips, Card action strip,
  Dialog header for the landscape panels; board, unit cards and HP bars
  unchanged.

Acceptance: `.maestro/wordle-scroll-keyboard.yaml` and the PvP smoke flows
pass; `npm run test:mobile:appium:speed-calculus:ios` still passes.

### Lot 5: admin

- `admin/admin-ui.tsx`: `AdminButton` → `Button`, `AdminStat` → `StatTile`
  (sentence-case labels), `AdminNotice` → `Notice`, `AdminSegmentedControl`
  → `SegmentedControl`, `AdminFilterChip`/`AdminChip` → `Chip`,
  `AdminField`/`AdminSearchInput` → `Input`, `AdminPanel` → `Card`,
  `AdminModal` → `Dialog`, `AdminEmptyState`/`AdminLoadingState` →
  `StatePanel`, `AdminHero` → `PageTitle` inside the Operations console.
- Keep `AdminShell` and the editor sheets; they only swap primitives.

Acceptance: `admin-ui.tsx` exports only thin wrappers or is removed.

### Lot 6: web parity

- `apps/web/src/components/ui.tsx`: same names and metrics as mobile
  (Button, Chip, SegmentedControl, StatCard → StatTile, Notice, StatePanel,
  Dialog radius 28, Input 48/16/1px, SectionHeader, PageTitle).
- `apps/web/src/styles.css`: radii from the generated scale; remove weight
  900; `.dialog` 28; `.state-panel` 24.
- `apps/web/src/components/layout.tsx`: dock members and order match the
  mobile tab bar (Home, Packs, PvP, Quests, Collection, Rankings); Gifts moves
  to the header; add the missing `/admin/leaderboard-integrity` entry to
  `route-manifest.ts` and `/admin/balance` to the admin nav.
- Rankings and public profile web pages are out of scope here (feature gap,
  tracked separately).

Acceptance: `npm run test:web`, `npm run build:web`; a screenshot pass of the
web views added to the inventory.

### Lot 7: icons

- Replace `apps/mobile/src/components/icons.tsx` (43 SVGs, 97 hex) and
  `apps/web/src/components/icons.tsx` with one outline set tinted by tone
  text tokens, following the mapping on board 01 (house, package, swords,
  scroll-text, layers, trophy, gift, shield, settings, grid-3x3, hash, timer,
  alarm-clock, footprints, coins, sparkles, crown).
- Keep rarity and type glyphs that are part of the card art.

Acceptance: no hex literal in either `icons.tsx`.

## Verification per lot

- `npm run typecheck`, `npm run doctor`, `cd apps/mobile && npx expo-doctor`.
- Rebuild the iOS E2E app (`npm run build:mobile:e2e:ios`, then
  `npm run install:mobile:e2e:ios`) and re-run
  `.maestro/view-inventory-screenshots.yaml` and
  `.maestro/view-inventory-overlays.yaml` through `scripts/maestro.sh`.
  Export the captures into a timestamped folder and compare with
  `docs/design/view-inventory/mobile/`.
- Update the inventory `.pen` images at the end of each lot so the "before"
  of the next lot is real.
- Update `docs/PROJECT_STATE.md` when a lot lands.

## Metrics to track (from the audit)

| Metric | Today | Target |
| --- | --- | --- |
| Distinct corner radii in `apps/mobile/app` | ~20 | 5 |
| Distinct text sizes in `apps/mobile/app` | 30+ | 8 |
| Button implementations | 9 | 1 |
| Segmented-control implementations | 7 | 1 |
| Stat-tile implementations | 7 | 1 |
| Header implementations | 4 + 9 ad hoc | 3 |
| Backdrop colors | 4 | 1 |
| Hex literals in web `theme.css` | 116 hand-copied | generated |
| Hex literals in `icons.tsx` (mobile + web) | 97 + 54 | 0 |
| Tab label size | 9 | 11 |

## Risks

- Wordle keyboard hit-testing after scroll regressed once already; keep the
  Maestro flow in the loop for lot 4.
- Expo native (`ThemedExpoButton`) path is never used today
  (`preferFallback`); do not resurrect it, delete it when `Button` lands.
- Pack opening and the battle board carry bespoke animation code; lot 3 and
  lot 4 touch their chrome only.
- Web and mobile share names but not code; keep parity through the generated
  tokens and the metrics table, not through a shared UI package (out of
  scope).
