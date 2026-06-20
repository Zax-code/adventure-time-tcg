# Design System Outlier Registry

Last audited: 2026-06-20

This file records UI elements that currently bypass, stretch, or contradict the design system in [DESIGN.md](DESIGN.md). Some are intentional domain-specific exceptions; others are cleanup candidates. The goal is not to flatten the app's personality. The goal is to keep exceptions visible, named, and easier to improve.

Status values:

- `intentional`: acceptable as a domain-specific visual system; keep isolated.
- `watch`: acceptable for now, but should not spread.
- `migrate`: should be normalized when the surface is next touched.
- `fix`: likely bug, theme break, accessibility issue, or maintainability risk.

Priority values:

- `P1`: high user-facing risk or theming/accessibility problem.
- `P2`: visible inconsistency or reusable pattern gap.
- `P3`: cleanup, polish, or documentation debt.

## Summary

The audit found a coherent core system:

- semantic theme tokens in `apps/mobile/src/theme/themes.ts`
- NativeWind token classes in `apps/mobile/tailwind.config.js`
- custom app header and floating tab bar
- shared button, input, switch, loading, error, toast, and modal-sheet primitives
- dedicated admin component layer
- domain-specific card, pack, quest, and PvP game components

The main remaining inconsistencies are:

- raw `Modal` implementations instead of shared sheet/modal primitives
- older React Native shadow/elevation props mixed with `boxShadow`
- one-off gradient buttons instead of `ThemedExpoButton`
- ad hoc page headers and back buttons in minigames
- duplicated or conflicting style literals in a few large files
- domain colors scattered outside central palette files

## Registry

### O-003: Legacy Shadow Props Are Widespread

Status: `migrate`
Priority: `P2`

Files include:

- `apps/mobile/src/components/app-header.tsx`
- `apps/mobile/app/settings.tsx`
- `apps/mobile/app/(tabs)/collection.tsx`
- `apps/mobile/app/(tabs)/quests.tsx`
- `apps/mobile/src/features/quests/speed-calculus/*.tsx`
- `apps/mobile/src/features/pvp/battle-board.tsx`
- `apps/mobile/src/features/pvp/turn-banner.tsx`

Observed:

- Many surfaces use `shadowColor`, `shadowOpacity`, `shadowRadius`, `shadowOffset`, and `elevation`.
- Some newer/admin surfaces use `boxShadow`.

Why it matters:

- Shadow behavior is inconsistent across platforms.
- Inline shadow recipes make it hard to tune depth consistently.

Recommended normalization:

- Introduce shared shadow recipes, for example `soft`, `floating`, `modal`, and `gameOverlay`.
- Prefer `boxShadow` where supported.
- Keep battle/game shadows local only where they are tuned for readability.

### O-004: Raw React Native Modals Bypass Shared Sheet Chrome

Status: `migrate`
Priority: `P2`

Files include:

- `apps/mobile/app/(tabs)/collection.tsx`
- `apps/mobile/app/(tabs)/quests.tsx`
- `apps/mobile/app/quests/wordle.tsx`
- `apps/mobile/src/components/admin/admin-ui.tsx`

Observed:

- Collection dust modal uses raw `Modal`.
- Quest description modal uses raw `Modal`.
- Wordle definition/reset modals use raw `Modal`.
- Admin has both `AdminModal` and `AdminSheet`, which is acceptable, but raw modal structure exists inside the admin UI layer.

Why it matters:

- Modal radius, scrim color, close placement, keyboard handling, and sheet behavior vary.
- Some raw modals do not inherit theme variables as clearly as route sheets.

Recommended normalization:

- Use `ModalSheetRoute` for route-level sheets.
- Use a new shared `ThemedModal` for centered confirmations/info dialogs if center modal behavior is desired.
- Keep `AdminModal` only as the admin-specific centered dialog primitive.

### O-006: Quest List Uses One-Off Gradient Touchable Buttons

Status: `migrate`
Priority: `P2`

Files:

- `apps/mobile/app/(tabs)/quests.tsx`

Observed:

- Quest action, claim, Fitbit, and modal close buttons are built with `TouchableOpacity` plus `LinearGradient`.
- Cards use a mix of NativeWind classes and inline shadow/margin style.

Why it matters:

- Buttons differ from shared primary/secondary button behavior.
- Press, disabled, loading, and accessibility behavior are not centralized.

Recommended normalization:

- Convert action buttons to `ThemedExpoButton` with custom fallback appearances.
- Extract a `QuestCard`, `QuestActionButton`, and `QuestDescriptionModal`.

### O-007: Minigame Back Buttons Are Ad Hoc

Status: `migrate`
Priority: `P3`

Files:

- `apps/mobile/app/quests/wordle.tsx`
- `apps/mobile/app/quests/speed-calculus/index.tsx`
- `apps/mobile/app/quests/speed-calculus/training.tsx`
- `apps/mobile/app/quests/daily-numbers-play.tsx`

Observed:

- Several minigames render their own full-width "back to quests" button.
- Shapes, colors, placement, and text colors vary.

Why it matters:

- The route escape hatch is important and should look consistent.

Recommended normalization:

- Add a reusable `QuestBackButton`.
- Use a consistent `rounded-xl`, primary/ghost variant, and safe-area spacing.

### O-008: Wordle Uses Raw Modal and Duplicate Style Fragments

Status: `fix`
Priority: `P2`

Files:

- `apps/mobile/app/quests/wordle.tsx`

Observed:

- Wordle definition/reset modals are raw `Modal`.
- Audit output showed duplicated fragments around `ref={keyboardContainerRef}` and a duplicated closing `</Text>` in the inspected section.
- The screen uses `shadow shadow-black/10` utility style while many other screens use explicit shadow/elevation or `boxShadow`.

Why it matters:

- Duplicate JSX fragments can be benign if generated by nearby code context, but they should be checked before future edits.
- Wordle is a high-risk touch surface with Maestro coverage.

Recommended normalization:

- Inspect and clean duplicate JSX if present in source.
- Move definition/reset modal into a shared themed info dialog.
- Preserve focused Wordle Maestro coverage after any touch handling change.

### O-009: Speed Calculus Uses Legacy Shadow Recipes

Status: `migrate`
Priority: `P3`

Files:

- `apps/mobile/app/quests/speed-calculus/index.tsx`
- `apps/mobile/app/quests/speed-calculus/training.tsx`
- `apps/mobile/src/features/quests/speed-calculus/*.tsx`

Observed:

- Cards and overlays repeatedly define similar old shadow props.
- Keypad, summary, history, HUD, and overlays each carry their own recipe.

Why it matters:

- The minigame is visually consistent internally, but hard to tune globally.

Recommended normalization:

- Add local speed-calculus panel primitives or shared shadow constants.
- Keep key dimensions and gesture handling unchanged unless testing with Maestro.

### O-010: PvP Battle Board Uses Hard-Coded Field and Overlay Colors

Status: `intentional`
Priority: `P3`

Files:

- `apps/mobile/src/features/pvp/battle-board.tsx`
- `apps/mobile/src/features/pvp/unit-card.tsx`
- `apps/mobile/src/features/pvp/bench-card.tsx`
- `apps/mobile/src/features/pvp/action-buttons.tsx`
- `apps/mobile/src/features/pvp/floating-number.tsx`

Observed:

- Live battle uses hard-coded rose/sky/slate/black overlays, HP colors, type badge colors, and battle field shadow colors.

Why it matters:

- These values are needed for game readability, rapid target recognition, and contrast over art.

Recommended guardrail:

- Treat this as an intentional battle palette.
- Centralize battle palette constants over time.
- Do not reuse battle colors in lobby, settings, admin, or normal app cards.

### O-011: PvP Action and Card Info Sheets Use White/Slate Instead of Theme Surfaces

Status: `migrate`
Priority: `P2`

Files:

- `apps/mobile/src/features/pvp/action-modal.tsx`
- `apps/mobile/src/features/pvp/card-info-modal.tsx`
- `apps/mobile/src/components/pvp/loadout-card-details-content.tsx`

Observed:

- Action/card info layouts use `bg-white`, `bg-slate-900`, `bg-slate-800`, `bg-slate-700`, and hard-coded close/icon colors.

Why it matters:

- In `nightosphere`, these sheets can feel detached from the theme.
- PvP lobby/loadout surfaces are more theme-consistent than these detail sheets.

Recommended normalization:

- Keep dark image panels if needed for art contrast.
- Replace outer containers with `bg-surface`, `border-primaryTint`, and theme-aware panel colors.
- Move hard-coded action card colors to a PvP action palette keyed by theme.

### O-012: PvP Loadout Builder Uses White Headers/Footer and Inputs

Status: `migrate`
Priority: `P2`

Files:

- `apps/mobile/app/pvp-loadouts.tsx`

Observed:

- Header/footer use `bg-white/90` and `bg-white/95`.
- Name input and some cards use `#FFFFFF`.
- The screen background is a fixed primary/accent gradient.

Why it matters:

- The builder is otherwise a strong themed surface, but white chrome weakens dark theme support.

Recommended normalization:

- Use `tc.surface` / `tc.surfaceMuted` with alpha.
- Keep the gradient if it remains readable in all themes.
- Replace `#FFFFFF` with `tc.surface` unless a real card-art backing requires white.

### O-013: App Header Uses Legacy Shadows and Inline SVG

Status: `migrate`
Priority: `P3`

Files:

- `apps/mobile/src/components/app-header.tsx`

Observed:

- Header pill/buttons use old shadow/elevation props.
- Admin shield icon is an inline SVG local to the header.

Why it matters:

- Header is global chrome; it should model the preferred patterns.

Recommended normalization:

- Move the shield/user icon to `apps/mobile/src/components/icons.tsx`.
- Replace shadows with a shared chrome shadow recipe.

### O-014: Settings Has Solid Local Patterns That Should Be Extracted

Status: `watch`
Priority: `P3`

Files:

- `apps/mobile/app/settings.tsx`

Observed:

- Settings defines useful local primitives: `SurfaceCard`, `ChoiceCard`, `SummaryChip`, `SettingsToggleRow`, `StatTile`, `ToneBanner`, and `SettingsActionButton`.
- These mostly match the design system but are route-local.
- Some style issues appear in the inspected code, including duplicated `tc={tc}` and old shadows.

Why it matters:

- Settings is one of the most complete examples of the desired design language.
- Route-local primitives may be copied inconsistently elsewhere.

Recommended normalization:

- Promote generally useful primitives to `src/components/` if another feature needs them.
- Clean duplicate props while touching the file.
- Convert local shadows to shared recipes.

### O-015: Admin UI Has Good Primitives But Mixed Modal Infrastructure

Status: `watch`
Priority: `P3`

Files:

- `apps/mobile/src/components/admin/admin-ui.tsx`
- `apps/mobile/src/components/admin/admin-shell.tsx`

Observed:

- Admin has a strong component layer and theme-aware alpha helpers.
- It uses `ModalBottomSheet` for `AdminSheet` and raw `Modal` for `AdminModal`.
- `AdminShell` uses Ionicons plus custom icons and `BottomTabBarFrame`.

Why it matters:

- Admin is cohesive, but its modal layer should remain the only accepted exception to app-level `ModalSheetRoute`.

Recommended guardrail:

- Keep all admin modals routed through `AdminModal` or `AdminSheet`.
- Do not create screen-local raw modals inside admin pages.
- Consider moving shared admin shadows into `admin-palette.ts`.

### O-016: Admin and Settings Use Ionicons While App Uses Custom Icons

Status: `watch`
Priority: `P3`

Files include:

- `apps/mobile/app/settings.tsx`
- `apps/mobile/src/components/admin/admin-shell.tsx`
- `apps/mobile/src/components/admin/admin-ui.tsx`
- `apps/mobile/app/admin/*.tsx`

Observed:

- Standard gameplay/app surfaces mostly use custom icons from `icons.tsx`.
- Admin/settings/loading/error use Ionicons.

Why it matters:

- This is acceptable if treated as a secondary operational icon language.
- It should not become a random mix within the same feature.

Recommended guardrail:

- Gameplay and user-facing feature surfaces should prefer `icons.tsx`.
- Admin/settings may use Ionicons for operational utility icons.
- Repeated domain icons should be added to `icons.tsx`.

### O-018: CardTile Action Labels Are Hard-Coded

Status: `fix`
Priority: `P2`

Files:

- `apps/mobile/src/components/card-tile.tsx`

Observed:

- Optional action buttons render hard-coded `Recycle` and `Craft`.

Why it matters:

- Violates localization rules.
- `CardTile` is reused in localized app surfaces.

Recommended normalization:

- Use `t("collection.detail.recycle")` and `t("collection.detail.craft")`.
- Consider routing those action buttons through a compact shared control.

### O-019: CardTile Contains Domain-Specific Hard-Coded Fallback Colors

Status: `intentional`
Priority: `P3`

Files:

- `apps/mobile/src/components/card-tile.tsx`
- `apps/mobile/src/components/theme.ts`

Observed:

- Trading-card type, rarity, shimmer, and fallback colors are hard-coded.

Why it matters:

- This is a collectible card visual system and should not be replaced by app semantic colors.

Recommended guardrail:

- Keep card domain colors centralized in `components/theme.ts`.
- Add theme-specific card maps there when needed.
- Do not scatter new card colors in screens.

### O-020: Packs Opening Effects Use Hard-Coded Cinematic Colors

Status: `intentional`
Priority: `P3`

Files:

- `apps/mobile/app/(tabs)/packs.tsx`
- `apps/mobile/src/components/pack-opening-visuals.tsx`
- `apps/mobile/src/components/pack-opening-art.tsx`
- `apps/mobile/src/components/pack-opening-sequence-dom.tsx`

Observed:

- Pack-opening uses glow, particles, SVG gradients, and pack accent colors.

Why it matters:

- These effects are part of the reward moment and should be more expressive than standard app cards.

Recommended guardrail:

- Keep cinematic values isolated to pack-opening code.
- Storefront cards, pack rows, prices, and error/loading states should remain tokenized.

### O-021: Some Screen Headers Ignore Shared App Header Pattern

Status: `watch`
Priority: `P3`

Files include:

- `apps/mobile/app/pvp-history.tsx`
- `apps/mobile/app/pvp-spectate.tsx`
- `apps/mobile/app/pvp-loadouts.tsx`
- quest minigame routes

Observed:

- Several non-tab or full-screen routes define custom headers with `bg-white/90`, local back buttons, or independent safe-area logic.

Why it matters:

- Non-tab routes need custom headers, but they should still use a shared route-header pattern.

Recommended normalization:

- Add a reusable `RouteHeader` or `SheetHeader` component.
- Use theme-aware surface backgrounds and standard icon button dimensions.

### O-022: Mixed Button Primitives in Feature Screens

Status: `migrate`
Priority: `P2`

Files include:

- `apps/mobile/app/(tabs)/quests.tsx`
- `apps/mobile/app/quests/wordle.tsx`
- `apps/mobile/app/quests/speed-calculus/index.tsx`
- `apps/mobile/app/(tabs)/collection.tsx`
- `apps/mobile/app/(tabs)/packs.tsx`

Observed:

- Shared `PrimaryButton`/`SecondaryButton`/`ThemedExpoButton` coexist with local `Pressable`, `TouchableOpacity`, and gradient button implementations.

Why it matters:

- Disabled/loading/pressed states diverge.
- Button shape and typography drift.

Recommended normalization:

- Use shared buttons for commands.
- Reserve raw `Pressable` for cards, rows, tabs, custom game keys, and icon-only controls.

### O-023: Theme-Aware Alpha Helpers Are Duplicated

Status: `migrate`
Priority: `P3`

Files:

- `apps/mobile/src/components/bottom-tab-bar-frame.tsx`
- `apps/mobile/src/components/admin/admin-palette.ts`
- `apps/mobile/src/features/quests/speed-calculus/palette.ts`

Observed:

- Multiple local `withAlpha` implementations or palette helpers exist.

Why it matters:

- Alpha conversion behavior may diverge.
- New UI has to choose among local helpers.

Recommended normalization:

- Move a shared color helper to `apps/mobile/src/theme/`.
- Re-export where admin or quest modules need it.

### O-024: Theme Color Font Family Name Drift

Status: `fix`
Priority: `P3`

Files include:

- `apps/mobile/app/settings.tsx`
- `apps/mobile/src/components/admin/admin-ui.tsx`
- `apps/mobile/src/components/expo-ui/themed-segmented-control.tsx`

Observed:

- Some JS style objects use names like `Nunito-SemiBold` or `Nunito-Bold`.
- Most React Native fallback styling uses loaded Expo names such as `Nunito_600SemiBold`.

Why it matters:

- Font fallback behavior may differ between native, Expo UI hosts, and React Native text.

Recommended normalization:

- Use NativeWind font classes where possible.
- In React Native JS styles, prefer loaded Expo font names.
- Keep Expo UI modifier font names only where that API expects them.

### O-025: Collection Card Detail Has Inline Style Duplication

Status: `fix`
Priority: `P3`

Files:

- `apps/mobile/app/collection-card-detail.tsx`

Observed:

- Audit output showed duplicated style properties such as `width: "47.5%"` in a metric tile.
- The sheet uses many repeated inline card recipes.

Why it matters:

- Low immediate user risk, but this file is large and easy to drift.

Recommended normalization:

- Extract local `MetricTile`, `ActionPanel`, and `ExpandableActionSection`.
- Remove duplicate style entries while touching the file.

### O-026: Surface Radius Values Are Close But Not Named

Status: `watch`
Priority: `P3`

Files:

- app-wide

Observed:

- Common radii include 16, 18, 20, 22, 24, 28, 30, 32, and 34.
- Most are visually compatible, but the app does not name radius roles.

Why it matters:

- New contributors may add arbitrary radii.

Recommended normalization:

- Keep the documented radius roles in `DESIGN.md`.
- Optionally add helper constants for JS-only styles: `radius.control`, `radius.card`, `radius.panel`, `radius.sheet`.

### O-027: Page-Level Empty States Are Not Fully Unified

Status: `migrate`
Priority: `P3`

Files include:

- `apps/mobile/app/(tabs)/gifts.tsx`
- `apps/mobile/app/(tabs)/collection.tsx`
- `apps/mobile/app/(tabs)/quests.tsx`
- `apps/mobile/app/(tabs)/pvp.tsx`
- admin list pages

Observed:

- Empty states range from polished icon cards to bare text.

Why it matters:

- Empty states are important first-use surfaces.

Recommended normalization:

- Create shared `EmptyStatePanel` for user-facing pages.
- Keep `AdminEmptyState` for admin.
- Bare text is acceptable only inside an already-labeled compact card.

### O-028: Toast Patterns Are Not Fully Unified

Status: `migrate`
Priority: `P3`

Files include:

- `apps/mobile/src/components/toast-banner.tsx`
- `apps/mobile/app/pvp-loadouts.tsx`
- `apps/mobile/app/quests/speed-calculus/index.tsx`
- admin pages

Observed:

- `ToastBanner` exists and is used in several tabs/sheets.
- Some feature screens still implement local absolute toast views.

Why it matters:

- Placement, animation, and contrast differ.

Recommended normalization:

- Use `ToastBanner` for standard app toasts.
- Add an admin wrapper if admin needs different placement.
- Keep game HUD toasts local only if tied to the game loop.

### O-029: App Launch Screen Is Its Own Brand Moment

Status: `intentional`
Priority: `P3`

Files:

- `apps/mobile/src/components/app-launch-screen.tsx`

Observed:

- Launch screen uses image, gradient, translucent panels, and hard-coded white text.

Why it matters:

- This is a bootstrap/brand moment and can be more cinematic than standard app surfaces.

Recommended guardrail:

- Keep it isolated.
- Ensure contrast remains acceptable in all themes or deliberately theme it later.

### O-030: Some Views Use `bg-white` as Generic Surface

Status: `migrate`
Priority: `P2`

Files include:

- `apps/mobile/app/pvp-history.tsx`
- `apps/mobile/app/pvp-spectate.tsx`
- `apps/mobile/app/pvp-loadouts.tsx`
- `apps/mobile/src/features/pvp/action-modal.tsx`
- `apps/mobile/src/features/pvp/card-info-modal.tsx`
- `apps/mobile/app/pvp-match.tsx`
- `apps/mobile/src/features/pvp/combat-log-modal.tsx`

Observed:

- White is used as a generic surface, especially in PvP-adjacent routes.

Why it matters:

- White does not adapt to `nightosphere`.

Recommended normalization:

- Replace generic white with `bg-surface` or `tc.surface`.
- Keep white only inside true card/art thumbnails that require a neutral backing.

## Migration Order

Recommended order for future cleanup:

1. Fix localization issues: O-017 and O-018.
2. Normalize generic white/slate surfaces in PvP sheets and loadouts: O-011, O-012, O-030.
3. Replace raw collection/quest/Wordle modals with shared themed modal primitives: O-004, O-005, O-006, O-008.
4. Tokenize login so all themes are respected: O-001.
5. Introduce shared shadow and alpha helpers: O-003, O-023.
6. Promote reusable settings/admin/page empty-state patterns: O-014, O-027, O-028.
7. Centralize battle and minigame palettes without changing their interaction behavior: O-009, O-010.

## When Adding a New Outlier

Add a new entry with:

- unique ID
- status
- priority
- file path(s)
- what was observed
- why it matters
- recommended normalization or guardrail

If an outlier is intentional, explain the boundary so it does not spread into normal app UI.
