---
paths:
  - "apps/mobile/**"
  - "packages/api-client/**"
  - "packages/contracts/**"
  - "packages/game-engine/**"
  - "DESIGN.md"
  - "DESIGN_OUTLIERS.md"
---

# Mobile and Shared Package Rules

Use these rules for Expo mobile, mobile-facing contracts, API client code, and shared game-engine work.

## Styling and Design

- NativeWind is the default styling system. Prefer `className` utilities using semantic tokens such as `bg-bg`, `text-fg`, `bg-surface`, `text-fgMuted`, `border-primaryBorder`, `bg-primaryTint`, and status tokens.
- Use `THEME_COLORS[themeName]` only when a JS-only value is needed, such as gradients, icon colors, placeholder colors, or calculated alpha.
- Use `THEME_VARS[themeName]` for root/full-screen themed containers and modal/sheet surfaces that need local theme variables.
- Follow `DESIGN.md` for typography, radii, spacing, cards, buttons, inputs, sheets, loading/error states, and domain-specific game surfaces.
- Check `DESIGN_OUTLIERS.md` before reusing a one-off pattern. Do not spread outliers unless the outlier entry marks the pattern as intentional.

## Mobile UI Structure

- Tab screens should account for the custom app header and floating tab bar with `useAppHeaderHeight()` and `useBottomTabBarContentPadding()`.
- Use `ModalSheetRoute` for route-level app sheets unless a specialized admin or game sheet is required.
- Use shared controls where possible: `PrimaryButton`, `SecondaryButton`, `GhostButton`, `ThemedExpoButton`, `ThemedExpoTextInput`, `ThemedExpoSwitch`, `PageLoadingState`, `PageErrorState`, `SectionErrorState`, and `ToastBanner`.
- Use `KeyboardScreenView` and `KEYBOARD_AWARE_SCROLL_PROPS` for forms, editors, search, and keyboard-sensitive sheets.
- Preserve existing `testID` values, especially auth, settings, Wordle, PvP, collection detail, and Maestro-targeted surfaces.

## Translations

- UI translations live only in `apps/mobile/src/i18n/`.
- Keep English and French locale file structures aligned.
- Do not reintroduce a `native.` prefix or split translations by platform.
- Preserve dynamic key families mentioned in `AGENTS.md`, including quest, combat, PvP reference, settings step sources, admin, and gift status labels.

## Verification

- Run `npm run typecheck` for mobile/shared TypeScript changes.
- Run `cd apps/mobile && npx expo-doctor` for mobile app changes.
- Treat new Expo Doctor warnings as regressions.
- For risky mobile interactions, run the narrowest relevant Maestro flow through `scripts/maestro.sh`; never call raw `maestro test` unless intentionally bypassing auth/fixture injection.

