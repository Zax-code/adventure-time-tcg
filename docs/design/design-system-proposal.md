# Design system proposal (2026-10-10)

Companion to `docs/design/design-system-proposal.pen`. The Pencil file is the
deliverable; this page summarizes what it says so the findings are searchable
and reviewable in a pull request.

Sources: the 50 iOS captures in `docs/design/view-inventory.pen`
(main @ a404cfa, pull request #324), the shared component code
(`apps/mobile/src/components`, `apps/web/src/components/ui.tsx`,
`apps/web/src/styles.css`) and the token package `packages/theme`.

Status: proposal. No application code has changed.

## Boards in the .pen file

| Board | Content |
| --- | --- |
| 00 Audit | 12 findings, each with the captures where it shows and the component that fixes it |
| 01 Foundations | 39 theme colors on a `candy / ice / nightosphere` axis, type scale, radius, spacing, control heights, elevation, icon set |
| 02 Components | 20 reusable components with tone and size variants |
| 03 Patterns & rules | Surface taxonomy for all 23 overlays, screen anatomy, tone semantics, rarity and quest mapping, button hierarchy |
| 04 Screens | Before / after pairs rebuilt only from the components |
| Appendix | The current captures, unchanged |

## What is inconsistent today

1. **Seven ways to title a screen.** No title on Home, centered pink title on
   Collection, left brown title on Quests and Rankings, hero cards on PvP and
   Gifts, left pink title on a white band on Loadouts, indigo title on Spectate.
2. **Four back buttons.** Pink outlined square (quests), bare grey chevron on a
   white band (PvP screens), grey filled circle (public profile), and the
   Perfect Timing header sits lower than Speed Calculus.
3. **Nine button specs.** Pill gradient, yellow pill, dark-magenta rounded-12
   rect, flat pink rect, yellow rect, outline rect, radius-22 auth CTA,
   full-width save/archive bars, radius-16 admin button. Code confirms it:
   `PrimaryButton` (999 radius, 15/700), `AdminButton` (16, 13/800),
   `QuestActionButton` (12), auth CTA (22, 58 high), PvP action circles (48).
4. **Seven segmented-control shapes.** Rankings stacks two different ones.
5. **Seven stat-tile layouts** across Home, Gifts, PvP hub, Match history,
   Admin, Card details and Profile.
6. **About 20 corner radii** on mobile; web defines four radius variables and
   uses them four times against roughly 200 hardcoded values.
7. **No type scale.** Six hero-title specs between 24 and 36, over 30 text
   sizes, 9px tab labels, uppercase eyebrows in some cards only, and web
   requests weight 900 which is not loaded.
8. **Colors mean different things.** Yellow is coins, rewards, warnings,
   Legendary and the Archive pill; purple is admin, Epic, themes, the Daily
   Numbers target and the Spectate title; dark magenta is a quest CTA, a
   history banner and the admin segmented control.
9. **Overlays.** Three sheet-header styles, three dialog styles and four
   backdrop colors (`rgba(0,0,0,.4)`, `rgba(6,1,10,.84)`, `primaryStrong` at
   33%, web 68%).
10. **Chips** come in six sizes and two cases (ARCHIVE, LIVE · PROVISIONAL
    versus Fresh, Epic, 1 ready).
11. **Empty states** have four patterns: icon card, plain sentence, nothing,
    mint notice.
12. **Web and mobile drift at the token level.** `apps/web/src/theme/theme.css`
    hand-copies 116 hex values from `packages/theme`; modal radius is 32 on web,
    28 in `ThemedModal`, 30 in `AdminModal`; the web dock has Gifts and no
    Rankings in a different order from the mobile tab bar; the 43 hand-coded
    SVG icons carry 97 raw hex values and ignore the theme.

## Proposal

### Foundations

- **Color**: the existing 39 semantic colors of `packages/theme` become the only
  palette for mobile and web, with a theme axis. Mobile `global.css`, the web
  `theme.css` and the card/rarity palettes in `src/components/theme.ts` are
  generated from it. The dead `pinkLight … lavender` tokens are removed.
- **Type**: Nunito 400/600/700/800, eight roles: display 34, h1 28, h2 22,
  h3 17, body 15, sm 13, caption 12, overline 11. Tab labels move from 9 to 11.
- **Radius**: sm 12, md 16, lg 24, xl 28, pill. Cards are always 24, sheets and
  dialogs 28.
- **Spacing**: 4-point scale; gutter 16, card padding 16, card gap 12, section
  gap 24.
- **Controls**: button heights 52 / 44 / 36, icon buttons 40, inputs 48,
  headers 56, tab bar 68.
- **Elevation**: flat (cards), float (tab bar, buttons), overlay (sheets,
  dialogs). One `backdrop` token.
- **Icons**: one outline set at 20 / 24 tinted by tone text tokens.

### Components (board 02)

Button (primary, secondary, ghost, danger; lg, md, sm), Icon Button, Chip,
Segmented Control, Icon Tile, Stat Tile, Card, Section Header, Notice (info,
warning, success, danger), List Row, Input, Progress Bar, App Header, Page
Title, Stack Header, Sheet Header, Tab Bar, Dialog, State Panel.

Mapping to code: Button replaces `PrimaryButton` / `SecondaryButton` /
`GhostButton` / `AdminButton` / `QuestActionButton` and the auth CTA; Notice
replaces `AdminNotice`, `ToastBanner` and the ad-hoc banners; State Panel
replaces `PageErrorState`, `SectionErrorState`, `LoadingPanel`,
`PageLoadingState` and `AdminEmptyState`; Stat Tile replaces `AdminStat` and
the per-screen tiles; Segmented Control replaces `AdminSegmentedControl` and
the six screen-local switches. On web the same names land in
`components/ui.tsx`.

### Patterns (board 03)

- **Six surfaces** cover every view: Tab page, Stack page, Route sheet, Inline
  sheet, Dialog, Takeover. Route and inline sheets share one Sheet Header.
- **Screen anatomy**: App Header (56, no title) then Page Title (h1, left, fg)
  then content; pushed screens use the Stack Header instead. One primary action
  per screen, full width in the lead card.
- **Tone semantics**: primary = brand and selection; secondary = coins, rewards,
  Legendary, warnings inside a Notice; accent = admin, Epic, themes, Daily
  Numbers; success = ready, live, Uncommon, Steps; info = system guidance,
  stats, Rare, Speed Calculus; danger = destructive and penalties.
- **Button hierarchy**: Primary, Secondary (money only), Ghost, Danger, Icon
  Button for navigation only.
- **Navigation**: the same six tab members in the same order on mobile and web
  (Home, Packs, PvP, Quests, Collection, Rankings); Gifts stays a header action.

## Adoption order (suggested)

1. Tokens: export radius, spacing, type and backdrop from `packages/theme`;
   generate `global.css` and web `theme.css`; delete dead tokens.
2. Button, Chip, Segmented Control, Stat Tile, Notice, State Panel, Icon
   Button: build once, migrate screens file by file.
3. Headers: App Header + Page Title on tabs, Stack Header on pushed screens,
   Sheet Header for inline sheets.
4. Tab bar parity on web; icon set swap.

## Not covered

- Website screens are compared at the code level only; the inventory has no
  web captures yet.
- Card art frames, pack-opening animation and the battle board keep their
  current visuals; only their chrome (headers, buttons, chips, dialogs) is
  covered.
