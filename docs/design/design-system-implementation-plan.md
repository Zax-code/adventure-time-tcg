# Design system implementation plan

Turns `docs/design/design-system-proposal.pen` (summary in
`docs/design/design-system-proposal.md`) into code, one lot per pull request.
Each lot leaves the app shippable. No gameplay, contract, backend or data
change is part of this plan.

Status: all eight lots are built and in review as a stack of pull requests
(`codex/ds-0-tokens` on #325, then `codex/ds-1-primitives`,
`codex/ds-2-headers`, `codex/ds-3-tab-screens`, `codex/ds-4-games`,
`codex/ds-5-admin`, `codex/ds-6-web`, `codex/ds-7-icons`). Prerequisite: pull requests #324 (view inventory) and #325
(proposal) merged, or the branch based on #325.

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

Lot 0 as built:

- `packages/theme/src/index.ts` exports `RADIUS`, `SPACE`, `TYPE`,
  `FONT_WEIGHT`, `LINE_HEIGHT`, `CONTROL`, `SHADOW` (float and overlay per
  theme) and `BACKDROP` per theme. `npm run build -w @adventure-time/theme`
  runs `scripts/generate.ts`, which writes `apps/mobile/global.css`,
  `apps/web/src/theme/theme.css` and `packages/theme/generated/tailwind-tokens.cjs`;
  `npm run check -w @adventure-time/theme` fails on stale output and runs in CI.
- Tailwind keys for the new scales carry a `ds-` prefix (`rounded-ds-lg`,
  `p-ds-4`, `text-ds-h1`) and control heights use semantic keys
  (`h-control-lg`, `h-icon-button`, `h-input`, `h-header`, `h-tab-bar`).
  Overriding Tailwind's `rounded-2xl`, `text-sm` or `p-4` would have changed
  hundreds of existing screens, which lot 0 must not do.
- Mobile `global.css` holds only the default (candy) theme in `:root`: React
  Native has no attribute selectors, so ice and nightosphere keep coming from
  `THEME_VARS` at runtime, which is built from the same package export and now
  also carries `--color-backdrop` and `--color-shadow`.
- The spec draws the overlay shadow for candy only (20% primaryStrong). Ice
  uses the same rule; nightosphere uses black at 65%, next to its 50% float
  shadow.
- `components/theme.ts` card type and rarity palettes stay as raw values with
  a comment: they are card art, and binding them to UI tokens would let a token
  change recolor a card frame, which the spec forbids. The unused
  `SECONDARY_TINT` constant was removed.
- Weight 900 was in `apps/web/src/styles/*.css` and `balance-page.css`
  (44 sites, not 36 in `styles.css`); all now ask for 800. The SVG text in web
  `icons.tsx` still asks for 900 and is left to lot 7.

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

Lot 1 as built:

- The 14 primitives live one per file in `apps/mobile/src/components/ui/`
  (no barrel file; React Doctor flags barrel imports). Shared tone classes,
  the `IconSlot` type (Ionicons name, element or render function) and the
  backdrop and elevation helpers are in `ui/tokens.tsx`. Icons follow the
  spec's Lucide names through `lucide-react-native` 1.48.0, imported one file
  per icon (`lucide-react-native/icons/coins`) at a 1.75 stroke; a mobile
  test checks every such import has a runtime file, because renamed icons
  (`trash-2` is now `trash`) keep a type alias but no module. The app-wide
  `icons.tsx` swap stays in lot 7; the Apple and Google marks stay Ionicons
  logos because Lucide has no brand icons. `ON_PRIMARY` was
  added to `packages/theme` for `$onPrimary`, so `ui/` has no hex literal.
- `app/e2e-ui-kit.tsx` renders every variant in dev and E2E builds, with a
  theme switch; `.maestro/ui-kit-screenshots.yaml` captures it in candy and
  nightosphere.
- `PrimaryButton`, `SecondaryButton` and `GhostButton` are tone wrappers in
  `components/button.tsx`; `primary-button.tsx`, `secondary-button.tsx`,
  `ghost-button.tsx` and `button-types.ts` are gone. `QuestActionButton`
  takes `tone` and `size` instead of colors. The auth provider buttons are
  ghost lg Buttons with the provider logo.
- Only command buttons moved in this lot. `ThemedExpoButton` still renders
  26 rows, cards, tab-like filters, steppers and section toggles (PvP hub,
  collection detail, gifts filters, settings option cards, history and
  spectate rows) plus the battle board and admin buttons. Those become Card,
  ListRow, SegmentedControl or Chip in lots 3 to 5, and `ThemedExpoButton`
  is deleted after lot 5.
- Spec question: the secondary Button uses `$secondaryText` on the
  secondary gradient in every theme; in nightosphere that is #FDBA74 on
  #F97316 to #EA580C, which reads poorly. Built as specified; needs a design
  decision.
- The Chip, StatTile, Card, Notice, Input, StatePanel and Dialog
  replacements listed above (QuestVariantChip, AdminStat, AdminPanel,
  ToastBanner, PageErrorState, ThemedModal and the rest) are left for the
  screen lots 3 to 5, which own those call sites.

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

Lot 2 as built:

- `ui/page-title.tsx`, `ui/stack-header.tsx` and `ui/sheet-header.tsx` are new.
  AppHeader and the admin header share a `CoinChip` and IconButtons (Lucide
  `coins`, `gift`, `shield`, `house`, `settings`); both tab bars share
  `TabBarItem` in `bottom-tab-bar-frame.tsx` (Lucide `house`, `package`,
  `swords`, `scroll-text`, `layers`, `trophy`; admin `layers`, `package`,
  `copy`, `images`, `star`, `zap`, `users`). The selector no longer falls back
  to Home on hidden tabs (Gifts).
- PageTitle on Quests, Rankings, Collection, Gifts, Packs and the PvP hub with
  their existing copy. Home keeps no title: the spec's "Good morning, Finn"
  greeting is new copy, which this plan excludes.
- StackHeader on Wordle, Daily Numbers play and history, Speed Calculus and
  training, Perfect Timing (moved out of its ScrollView, so it now sits at
  the same y), loadouts, match history, spectate and the public profile
  (replacing the native stack header). Subtitles of history and spectate stay
  as a centered muted line under the header. `pvp-match`, `pvp-replay`,
  `pvp-spectate-match` and `pvp-card-details` are takeovers and keep their
  chrome; `quests/daily-numbers.tsx` is a redirect.
- SheetHeader in `ModalSheetRoute`, the dust guide, quest launch, quest recap,
  quest order and pack preview sheets; the dust guide loses its icon tile.
  Sheets use radius 28.
- One backdrop token for ModalSheetRoute, every ModalBottomSheet scrim,
  ThemedModal, AdminModal, BattleFullScreenSheet and the PvP confirm dialog.

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

Lot 3 as built (one commit per screen):

- Home: Notice with inline Buttons for the notifications prompt, reward Card
  (secondary tint) with a Chip and a Primary lg Button, collection Card with
  ProgressBar and StatTiles, quick actions as ListRows, drop rates and
  featured cards under SectionHeaders. No PageTitle (no existing copy).
- Quests: the summary is a primary-tinted Card with an overline, display
  counter, ProgressBar and the existing actions; reward, status and variant
  pills are Chips toned by lifecycle (`QuestTone.chipTone`). Quest cards keep
  their variant chips, per-quest progress and footer actions instead of
  collapsing to the board's ListRows, which would drop behavior.
- Rankings: SegmentedControls for both period switches, Chips for boards and
  modes, a period Card with a status Chip and the live countdown, standings
  in a flush Card, StatePanel when empty, ghost help Button.
- Collection: StatTiles for dust and card stats (still open the dust sheet and
  stats dialog), Input search with a clear control, SegmentedControl with
  inline counts, rarity Chips, ghost sort Button; stats and sort modals are
  Dialogs. Grid items stay the bare CardTile.
- Gifts: status Chip plus three StatTiles, SegmentedControl filters, danger
  Notice, StatePanel empty states, SectionHeaders, quick send Card; gift cards
  are Cards with direction, status and meta Chips around the CardTile.
- PvP hub: StatTiles, challenge Card with a ready Chip and a Primary lg Button,
  loadouts/spectate/mechanics/reference as ListRows; section titles 22/800.
  The incoming, active, sent and recent lists keep their row components until
  lot 4 touches PvP.
- Packs: summary Card with a success Chip, danger Notice for errors, pack
  cards keep their pack color and art with the Card radius, a secondary price
  Chip and an accent recommended Chip.

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

Lot 4 as built:

- `ui/game/` holds GameTile, GameKey, KeypadKey, GameHud and one state
  palette (`game-state.ts`); the UI kit route renders every state.
- Wordle tiles and keys take the GameCell palette and sizes (tiles 56/16,
  keys 44/12, typed letters "filled"); key Pressables, hit slop and the flip
  and shake animations are untouched.
- Speed Calculus: keypad keys use the KeypadKey palette (digits default, ±
  action, delete and clear operator, submit primary) on the existing
  multitouch layer; the HUD follows the Game HUD anatomy with the animated
  drain; round-over and pause overlays use the Dialog anatomy in place;
  gradient Pressables are Buttons.
- Daily Numbers number tiles and operators use the KeypadKey palette;
  mode tabs keep their status line and animated indicator (SegmentedControl
  has no second line).
- Perfect Timing's mode switch is a SegmentedControl; quest game cards move
  to the 24/16 radius scale; uppercase eyebrows use the overline role.
- PvP: the battle board action buttons are IconButtons, the energy pill a
  Chip, the action modal cards token-coloured; history stats are StatTiles
  and its empty state a StatePanel. Every remaining `ThemedExpoButton`
  outside admin became a Pressable row on the radius scale.
- Shared loading and error states render the StatePanel anatomy;
  `ThemedModal` matches the Dialog panel.

### Lot 5: admin

- `admin/admin-ui.tsx`: `AdminButton` → `Button`, `AdminStat` → `StatTile`
  (sentence-case labels), `AdminNotice` → `Notice`, `AdminSegmentedControl`
  → `SegmentedControl`, `AdminFilterChip`/`AdminChip` → `Chip`,
  `AdminField`/`AdminSearchInput` → `Input`, `AdminPanel` → `Card`,
  `AdminModal` → `Dialog`, `AdminEmptyState`/`AdminLoadingState` →
  `StatePanel`, `AdminHero` → `PageTitle` inside the Operations console.
- Keep `AdminShell` and the editor sheets; they only swap primitives.

Acceptance: `admin-ui.tsx` exports only thin wrappers or is removed.

Lot 5 as built: `admin-ui.tsx` keeps its export names and props (so the
admin screens did not change) and every export is a thin wrapper:
AdminButton → Button (the accent "warning" variant renders as ghost, since
Button has no accent tone), AdminStat → StatTile with sentence-case labels,
AdminNotice → Notice, AdminSegmentedControl → SegmentedControl (test ids
`admin-segment-*` kept), AdminFilterChip/AdminChip/AbilityTypeChip → Chip,
AdminSearchInput/AdminField → Input, AdminPanel → Card, AdminHero → the
section Card under the shell's "Operations console" PageTitle (board 04),
AdminModal → Dialog anatomy with a close IconButton and scrollable body,
AdminEmptyState/AdminLoadingState → StatePanel. `ThemedExpoButton` had no
callers left and is deleted.

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

Lot 6 as built:

- `components/ui.tsx`: Button takes `size` (lg/md/sm), and Chip, PageTitle,
  StatTile (StatCard kept as an alias) and StatePanel exist with the mobile
  names; LoadingState, ErrorState and EmptyState render StatePanel.
- `styles.css` ends with a parity block on the generated variables: buttons
  44 (lg 52, sm 36) with 15/700 labels, flat 24-radius panels with 16 padding,
  StatTile 12/24/12 type without the decorative ring, Notice radius 16,
  StatePanel 24 radius with a 48 icon tile, SegmentedControl 44 with a primary
  active segment, Dialog radius 28 on the backdrop token, inputs 48/16, an
  8-high progress bar, dock labels 11/700 with a primaryTint active pill.
  `admin.css` page titles use the h1 to display scale.
- The dock follows the mobile order (Home, Packs, PvP, Quests, Collection);
  Gifts is an icon button in the header. Rankings is not in the dock because
  the website has no rankings page yet (out of scope here).
- `route-manifest.ts` lists `/admin/leaderboard-integrity`; the admin nav links
  `/admin/balance`.
- Not done: the admin pages' own metric, table and editor components in
  `styles/admin.css` (about 1,900 lines) keep their look apart from page
  titles; they are a follow-up.

### Lot 7: icons

- Replace `apps/mobile/src/components/icons.tsx` (43 SVGs, 97 hex) and
  `apps/web/src/components/icons.tsx` with one outline set tinted by tone
  text tokens, following the mapping on board 01 (house, package, swords,
  scroll-text, layers, trophy, gift, shield, settings, grid-3x3, hash, timer,
  alarm-clock, footprints, coins, sparkles, crown).
- Keep rarity and type glyphs that are part of the card art.

Acceptance: no hex literal in either `icons.tsx`.

Lot 7 as built: mobile and web `icons.tsx` keep every exported name and prop
(41 mobile, 43 web) and render the Lucide icons from board 01 at a 1.75
stroke (`lucide-react-native` and `lucide-react`, both pinned to 1.48.0).
Mobile icons without a `color` take their tone text token (primaryText,
secondaryText for coins, dust and crowns, successText/dangerText for the
check and cross circles); web icons use `currentColor`. Neither file has a
hex literal. The Google and Apple sign-in marks keep their brand colors in
`apps/web/src/components/brand-logos.tsx`; on mobile they already use
Ionicons logos. Coins are the Lucide `coins` glyph everywhere, replacing the
illustrated gold coin. The PvP results overlay also moved to the Dialog
anatomy and the backdrop token.

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
| Dead mobile color tokens (`pinkLight` et al.) | 0 (lot 0; was 7) | 0 |
| `font-weight: 900` in web CSS | 0 (lot 0; was 44) | 0 |
| Distinct corner radii in `apps/mobile/app` | ~20; lot 3 tab screens: 142 raw radius literals (23 distinct) down to 72 (17), the rest in lists and game screens | 5 |
| Distinct text sizes in `apps/mobile/app` | 30+; lot 3 tab screens: 259 raw size literals (22 distinct) down to 142 (18) | 8 |
| Button implementations | 9 before; after lot 5: 1 (`ui/Button`; PrimaryButton, SecondaryButton, GhostButton, QuestActionButton and AdminButton are thin wrappers, `ThemedExpoButton` deleted) | 1 |
| Segmented-control implementations | 7; after lot 5: 1 (`ui/SegmentedControl`; Daily Numbers mode tabs stay bespoke for their status line) | 1 |
| Stat-tile implementations | 7; after lot 5: 1 (`ui/StatTile`, AdminStat wraps it) | 1 |
| Header implementations | 4 + 9 ad hoc; after lot 2: AppHeader, StackHeader, SheetHeader (+ 4 PvP takeover chromes) | 3 |
| Backdrop colors | 4; after lot 7: 1 token for every sheet, dialog and overlay | 1 |
| Hex literals in web `theme.css` | 122 generated (lot 0; was 116 hand-copied) | generated |
| Hex literals in `icons.tsx` (mobile + web) | 97 + 54; after lot 7: 0 + 0 | 0 |
| Tab label size | 9; after lot 2: 11 | 11 |

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
