# Adventure Time TCG Design System

Last audited: 2026-06-29

This document defines the current design system for the Expo mobile app in `apps/mobile`. It is based on an audit of the active app routes, shared components, feature components, theme tokens, and admin surfaces. It is meant to be the source of truth for new UI work and for normalizing existing screens.

The app should feel like a playful, collectible card game wrapped in a dependable mobile product. Standard app surfaces should be soft, readable, token driven, and consistent across themes. Game surfaces may be more expressive, but they still need to respect the same theme, spacing, typography, and accessibility rules around their interactive shell.

Outliers and migration candidates are tracked in [DESIGN_OUTLIERS.md](DESIGN_OUTLIERS.md).

## Scope

The design system applies to:

- Expo routes under `apps/mobile/app/`
- reusable UI under `apps/mobile/src/components/`
- PvP UI under `apps/mobile/src/features/pvp/`
- quest UI under `apps/mobile/src/features/quests/`
- admin UI under `apps/mobile/src/components/admin/` and `apps/mobile/app/admin/`
- shared theme files under `apps/mobile/src/theme/`, `apps/mobile/global.css`, and `apps/mobile/tailwind.config.js`

It does not redefine backend contracts, game engine rules, or card data. Canonical backend and engine values remain raw; UI localizes them at render time.

## Design Principles

1. Token-first theming.
   Every standard screen should read from `THEME_COLORS`, `THEME_VARS`, and NativeWind semantic classes. Hard-coded colors are reserved for true artwork, card-game rarity/type colors, battle readability overlays, and temporary entries listed in the outlier registry.

2. Playful but structured.
   The app can be bright and game-like, but layout should be calm: clear sections, predictable cards, readable typography, obvious actions, and enough spacing to scan quickly.

3. Mobile native ergonomics.
   Screens should account for safe areas, the floating app header, the floating tab bar, the keyboard, and bottom sheets. Controls should be finger-sized, stable, and not shift when labels change.

4. Domain-specific components are allowed.
   Trading cards, pack-opening scenes, Wordle boards, Daily Numbers boards, Speed Calculus keypads, and PvP battle boards have their own visual systems. Their surrounding chrome, sheets, buttons, labels, and empty/error states still follow this document.

5. Admin is dense but not harsh.
   Admin screens are operational tools. They should use compact panels, lists, filters, and sheets, while retaining the app theme and Nunito typography.

## Theme Architecture

### Source Files

- `apps/mobile/src/theme/themes.ts`
- `apps/mobile/global.css`
- `apps/mobile/tailwind.config.js`
- `apps/mobile/src/stores/theme-store.ts`
- `apps/mobile/app/_layout.tsx`
- `apps/mobile/src/components/theme.ts`

### Supported Themes

The app currently supports three themes:

- `candy`: default warm pink/yellow Adventure Time candy palette.
- `ice`: light blue/cyan variant.
- `nightosphere`: dark red/orange/purple variant.

`ThemeName` is defined in `apps/mobile/src/theme/themes.ts`. Adding a theme requires updating:

- `ThemeName`
- `THEME_COLORS`
- `THEME_VARS`
- `global.css` defaults if the default theme changes
- any theme preview or settings copy
- any domain palettes that need theme-specific overrides

### Token Families

Every theme exposes these semantic color families:

- Base: `bg`, `fg`, `surface`, `surfaceMuted`, `fgMuted`, `muted`
- Primary: `primary`, `primaryDark`, `primaryText`, `primaryStrong`, `primaryBorder`, `primaryBg`, `primaryTint`
- Secondary: `secondary`, `secondaryDark`, `secondaryText`, `secondaryTint`, `secondaryBorder`
- Accent: `accent`, `accentDark`, `accentText`, `accentStrong`, `accentTint`, `accentBorder`
- Status: `success`, `successDark`, `successText`, `successTint`, `successBorder`
- Status: `danger`, `dangerDark`, `dangerText`, `dangerTint`, `dangerBorder`
- Status: `info`, `infoDark`, `infoText`, `infoTint`, `infoBorder`

Use semantic meaning, not hue preference. For example:

- Use `primary*` for the main app action or active state.
- Use `secondary*` for coins, rewards, pack purchase accents, and positive collectible economy moments.
- Use `accent*` for secondary feature emphasis, PvP/reference actions, and non-primary selections.
- Use `success*`, `danger*`, and `info*` only for their state meaning.

### NativeWind Classes

NativeWind is the default styling system for mobile UI. Prefer semantic classes:

- `bg-bg`, `text-fg`
- `bg-surface`, `bg-surfaceMuted`
- `text-fgMuted`, `text-muted`
- `border-primaryBorder`, `bg-primaryBg`, `bg-primaryTint`, `text-primaryText`, `text-primaryStrong`
- `bg-secondaryTint`, `text-secondaryText`, `border-secondaryBorder`
- `bg-accentTint`, `text-accentText`, `border-accentBorder`
- `bg-successTint`, `text-successText`, `border-successBorder`
- `bg-dangerTint`, `text-dangerText`, `border-dangerBorder`
- `bg-infoTint`, `text-infoText`, `border-infoBorder`

Use `THEME_COLORS[themeName]` when a value must be passed to JS-only APIs such as `LinearGradient`, icon colors, `placeholderTextColor`, Expo UI host colors, or calculated alpha values.

Use `THEME_VARS[themeName]` at the root of screens, modals, or surfaces that may render outside the normal app root, especially modal sheets and admin backgrounds.

### Legacy Static Tokens

`global.css` and `tailwind.config.js` still expose older decorative tokens such as `pinkLight`, `pinkMedium`, `pinkDark`, `yellowLight`, `yellowMedium`, `mint`, and `lavender`. Do not use these for new feature UI. Prefer semantic tokens unless the component is a deliberately theme-agnostic illustration.

### Domain Palettes

`apps/mobile/src/components/theme.ts` defines card type and rarity colors. These are domain palettes, not general UI palettes.

Use them for:

- collectible card frames
- rarity crests
- type badges
- pack/card reveal art
- loadout card thumbnails

Do not use them for:

- page backgrounds
- general buttons
- generic notification banners
- settings/admin controls

Where domain colors need theme-specific behavior, add explicit theme-aware maps instead of scattering hard-coded fallback colors across feature screens.

## Typography

### Font Family

The app uses Nunito loaded in `apps/mobile/app/_layout.tsx`:

- `Nunito_400Regular`
- `Nunito_600SemiBold`
- `Nunito_700Bold`
- `Nunito_800ExtraBold`

NativeWind aliases are defined in `apps/mobile/tailwind.config.js`:

- `font-nunito`
- `font-nunito-semibold`
- `font-nunito-bold`
- `font-nunito-extrabold`

Do not invent new font utility names. In JS style objects, use the loaded font names consistently. Existing code contains both underscore and hyphen forms in a few places; new code should prefer the loaded Expo font family names already used by most primitives, such as `Nunito_700Bold`.

### Type Scale

Use these sizes as the standard app scale:

- Page title: `text-[28px]` to `text-3xl`, `font-nunito-extrabold`, line height around 34.
- Sheet title: `text-2xl` or `text-[24px]`, `font-nunito-extrabold`.
- Section title: `text-lg` to `text-xl`, `font-nunito-bold`.
- Card title: `text-base` to `text-lg`, `font-nunito-bold`.
- Body: `text-sm`, `font-nunito`, `leading-5` or `leading-6`.
- Secondary body: `text-xs` to `text-sm`, `font-nunito`, `text-fgMuted`.
- Metric value: `text-2xl` to `text-3xl`, `font-nunito-extrabold`.
- Micro label: `text-[10px]` to `text-xs`, `font-nunito-bold`, uppercase only for metadata.
- Tab label: `text-[9px]`, `font-nunito-semibold` or `font-nunito-bold`.

Avoid viewport-scaled font sizes. Keep letter spacing at zero unless using a small uppercase metadata label; if tracking is needed, keep it restrained and local.

### Text Color Rules

- Primary readable text uses `text-fg`.
- Secondary text uses `text-fgMuted`.
- Disabled text uses `text-muted` or reduced opacity on the whole control.
- Action text uses the matching semantic family, such as `text-primaryStrong` or `text-successText`.
- White text is acceptable on true filled gradients, card art overlays, and battle overlays. Prefer tokenized foreground colors elsewhere.

### Text Layout

- Use `numberOfLines` for one-line labels inside tight cards, tabs, chips, and list rows.
- Long body copy should use `leading-5` or `leading-6`.
- Numeric counters that compare side by side should use tabular numbers in JS style with `fontVariant: ["tabular-nums"]`.
- Do not place large hero text inside compact controls.

## Layout System

### App Chrome

The main signed-in app uses custom chrome:

- `AppHeader` in `apps/mobile/src/components/app-header.tsx`
- `BottomTabBar` in `apps/mobile/src/components/bottom-tab-bar.tsx`
- `BottomTabBarFrame` in `apps/mobile/src/components/bottom-tab-bar-frame.tsx`
- safe-area constants in `apps/mobile/src/theme/layout.ts`

Standard tab screens should:

- render a root `View`, `ScrollView`, or `FlatList` with `bg-bg`
- add top clearance via `useAppHeaderHeight()`
- add bottom clearance via `useBottomTabBarContentPadding()`
- avoid manually guessing header/tab dimensions
- hide the tab bar when keyboard is visible through the existing `BottomTabBarFrame`

Use:

```tsx
const headerHeight = useAppHeaderHeight();
const bottomTabPadding = useBottomTabBarContentPadding();
```

For `ScrollView`:

```tsx
<ScrollView
  className="flex-1 bg-bg"
  contentContainerStyle={{
    paddingHorizontal: 16,
    paddingBottom: bottomTabPadding,
  }}
>
  <View style={{ paddingTop: headerHeight }} />
</ScrollView>
```

For `FlatList`, place the header clearance in `ListHeaderComponent` or `contentContainerStyle`, and keep `paddingBottom` tied to `bottomTabPadding`.

### Modal Sheets

Standard route-level sheets use `ModalSheetRoute`:

- transparent modal presentation from `apps/mobile/app/_layout.tsx`
- top gap of at least 56
- rounded top corners of 32
- draggable handle
- scrim close
- theme-provided sheet background

Use this for settings, card details, PvP reference/mechanics, and admin editor routes unless the surface specifically needs native bottom-sheet detents.

Admin utility sheets may use `AdminSheet` when they need admin-specific panel chrome and bottom footer support.

Avoid adding new raw `Modal` implementations for app sheets unless there is a concrete platform or interaction reason. Raw modal usage is tracked as an outlier.

### Keyboard-Aware Screens

Use `KeyboardScreenView` and `KEYBOARD_AWARE_SCROLL_PROPS` for:

- auth forms
- settings/profile edit
- admin editors
- collection card detail gift forms
- PvP loadout builder
- search fields inside sheets

Do not hand-roll keyboard dismissal behavior unless the surface is a custom game board that cannot use normal text input handling.

### Spacing

Standard spacing:

- Page horizontal padding: 16 or 20.
- Page vertical section gap: 16 to 24.
- Card internal padding: 16 or 20.
- Compact card padding: 12 or 14.
- Row gaps: 8 to 12.
- Large feature card gaps: 16.
- Bottom sheet content bottom padding: `insets.bottom + 24` or more if there is a fixed footer.

Prefer `gap` over margins where NativeWind or style objects support it. Use margin when working with lists, absolute overlays, or legacy snippets that cannot be simplified safely.

### Shape

Standard radii:

- Pills and avatars: `rounded-full` / radius 999.
- Icon tiles: `rounded-2xl`, 16 to 20.
- Compact cards: `rounded-2xl`, 16 to 20.
- Standard cards/panels: `rounded-3xl` or `rounded-[28px]`.
- Hero panels and large sheets: `rounded-[30px]` to `rounded-[34px]`.
- Bottom sheet top corners: 30 to 32.
- Trading cards and battle cards may use tighter radii for scale.

Cards should not be nested inside other decorative cards unless the inner element is a real repeated item, stat tile, choice row, or tool module.

### Shadows and Elevation

The preferred forward-looking pattern is tokenized `boxShadow` with theme alpha helpers. Current code still uses a mix of `shadowColor`/`shadowOpacity`/`shadowRadius`/`elevation`; this should be normalized over time.

Use shadows sparingly:

- floating tab bar
- app/admin header pills
- major loading/error panels
- modal sheets and admin panels
- game overlays that must separate from art

Avoid shadow on every repeated list item. Use border and tint first.

## Navigation Patterns

### Root Navigation

The root layout in `apps/mobile/app/_layout.tsx`:

- hydrates theme, locale, session, fonts, bootstrap, realtime hooks
- applies `THEME_VARS[themeName]`
- uses hidden native stack headers
- presents key routes as transparent modals

This app intentionally does not use native stack page headers for the main signed-in tabs. Do not add visible native headers to tab screens unless the app architecture changes.

### Tabs

The signed-in tabs are:

- Home
- Packs
- Quests
- PvP
- Gifts
- Collection

The tab bar:

- is floating and absolute
- uses icon plus tiny label
- uses a moving selected background
- uses feature-specific tint keys
- hides on keyboard visibility
- may show a small gifts badge

New tabs must define:

- localized `title`
- `tabBarButtonTestID`
- icon mapping in `BottomTabBar`
- tint mapping in `TAB_CONFIG`

### Admin Navigation

Admin uses `AdminShell` and reuses `BottomTabBarFrame` for admin-specific bottom navigation.

Admin pages should:

- render inside `AdminBackground`
- use `AdminHero` for the top summary
- use `AdminPanel`, `AdminStat`, `AdminSearchInput`, `AdminFilterChip`, `AdminButton`, `AdminModal`, and `AdminSheet`
- use dense lists with `FlatList`
- keep bottom padding at least enough for admin tab chrome

## Page Anatomy

A standard tab page should use:

1. `bg-bg` root.
2. Header/top padding from `useAppHeaderHeight()`.
3. Optional hero panel.
4. Section heading with a title and short supporting text.
5. Repeated cards or rows.
6. Empty/loading/error state from shared components.
7. Bottom padding from `useBottomTabBarContentPadding()`.

### Hero Panels

Hero panels are used on Gifts, PvP lobby, packs storefront, settings profile, and admin pages.

Standard hero panel:

- `rounded-[28px]` to `rounded-[32px]`
- `border border-primaryBorder`
- `bg-surface` or `bg-surfaceMuted`
- optional `LinearGradient` from `surfaceMuted`/`surface` to a semantic tint
- title `text-[28px]` to `text-[30px]`, `font-nunito-extrabold`
- body `text-sm leading-5 text-fgMuted`
- icon tile `size-12` to `size-16`, `rounded-2xl` or `rounded-[24px]`
- one or more summary stat cards if needed

### Sections

Standard section heading:

- title: `font-nunito-bold text-lg text-fg`
- subtitle: `font-nunito text-sm text-fgMuted`
- optional leading icon tile when scanning benefits from it
- optional trailing pill/counter

### Cards and Panels

Standard surface card:

- `rounded-3xl border border-primaryBorder bg-surface p-5`
- for compact rows: `rounded-2xl border bg-surface px-4 py-3`
- use semantic tint backgrounds for status or choice cards
- use `overflow-hidden` when a gradient/art child reaches the card edge

Use status cards:

- success: `border-successBorder bg-successTint text-successText`
- danger: `border-dangerBorder bg-dangerTint text-dangerText`
- info: `border-infoBorder bg-infoTint text-infoText`
- warning/reward: `border-secondaryBorder bg-secondaryTint text-secondaryText`

### Metrics

Metric tiles:

- label small and muted
- value large and extra-bold
- tint by meaning
- use tabular numbers for time/count comparisons
- cap text with `numberOfLines` inside small tiles

Existing examples:

- Home collection stats
- Gifts summary cards
- Settings summary chips and stat tiles
- PvP lobby overview
- Collection detail stats
- Admin stat panels

## Controls

### Buttons

All command buttons must route through the shared button components. Do not create one-off `Pressable`, `TouchableOpacity`, or custom gradient buttons for submit, create, save, edit, delete, add/remove, upload, cancel, or navigation-like command actions.

Use:

- `PrimaryButton`
- `SecondaryButton`
- `GhostButton`
- `ThemedExpoButton` for advanced layout or variant support
- `AdminButton` inside admin surfaces

Use `Pressable` directly only for non-button interaction patterns such as cards/rows, chips, segmented controls, pickers, icon chrome, game-board controls, or modal/backdrop mechanics. If that direct `Pressable` starts to look or behave like a command button, extract it into the shared button layer instead.

Standard button shape:

- pill for global primary/secondary buttons
- `rounded-2xl` or radius 16-20 for card-like command rows
- text `font-nunito-bold`
- primary gradient `[tc.primary, tc.primaryDark]`
- secondary gradient `[tc.secondary, tc.secondaryDark]`
- danger filled with `dangerDark` or danger tint depending severity
- ghost transparent or surface-muted with border

Use icon-only buttons for compact chrome:

- settings button
- close button
- back button in sheets
- battle overlay controls

Every icon-only button needs an accessibility label or test ID when relevant.

If a button needs custom content, use `ThemedExpoButton` with `preferFallback`, `fallbackLayout="stretch"`, and an explicit `fallbackAppearance`.

### Inputs

Use `ThemedExpoTextInput`.

Standard input:

- height 46 to 52
- `borderRadius: 14` to 16
- `borderWidth: 1`
- `borderColor: tc.primaryBorder` or feature-specific semantic border
- `backgroundColor: tc.surface` or `tc.primaryBg`
- `placeholderTextColor: tc.muted`
- text font `Nunito_400Regular` or `Nunito_600SemiBold`, 14 to 16

Search inputs should use `AdminSearchInput` in admin and `ThemedExpoTextInput` elsewhere.

### Toggles

Use `ThemedExpoSwitch` for binary settings.

For whole-row toggles, use a card-like button row with the switch pinned to the right, as in `SettingsToggleRow`.

### Segmented Controls and Choice Cards

Use `ThemedExpoSegmentedControl` when the platform-native segmented affordance is appropriate.

Use choice cards when:

- options need descriptions
- options need icons or previews
- options are stacked vertically
- a selected state needs a strong tint

Choice card selected state:

- background `tc.primaryBg`
- border `tc.primaryBorder`
- selected icon in `tc.primaryText`
- title `text-primaryStrong`

### Chips and Pills

Use pills for:

- status labels
- counts
- rarity/type labels
- filters
- short metadata

Pill shape:

- `rounded-full`
- horizontal padding 10 to 14
- vertical padding 5 to 8
- text `font-nunito-bold text-xs`
- color from semantic family or domain palette

## Feedback States

### Loading

Use:

- `PageLoadingState` for full-page loading.
- `LoadingPanel` for section loading.

Loading panels use:

- surface panel
- theme gradient
- rounded icon tile
- animated three-dot indicator
- optional message

### Error

Use:

- `PageErrorState`
- `SectionErrorState`

Errors distinguish network vs generic errors and support retry/back actions. Prefer these over ad hoc error boxes for page-level failures. Inline form validation can still use compact danger-tint boxes.

### Empty

Empty states should use:

- rounded panel
- icon tile
- title
- short body
- optional primary action

Use the same shape and typography as `GiftEmptyState`, admin empty states, or section-level panels. Avoid bare text unless the empty state is inside an already-labeled compact control.

### Toasts

Use `ToastBanner` for app-level success/error feedback when available.

Toast placement:

- top offset should respect `headerHeight + 16` in tab screens
- success uses `tc.successDark`
- error uses `tc.dangerDark`
- text is white or the tint foreground depending contrast

Admin currently has some local toast patterns; prefer converging them to a reusable admin toast or `ToastBanner`.

## Icons and Imagery

### Icon Sources

Current sources:

- custom SVG icons in `apps/mobile/src/components/icons.tsx`
- Ionicons for admin/settings/loading/error accents
- Expo Image with real card/avatar/pack assets
- React Native SVG for custom card/game decorations

For new standard UI:

- prefer existing custom icons in `icons.tsx` when they match the app domain
- use Ionicons in admin/settings where the pattern already exists
- do not create one-off inline SVGs unless the icon is domain-specific and belongs in `icons.tsx`

### Image Usage

Use `expo-image` for:

- cards
- avatars
- pack art
- battle cards
- admin image assets

Always define stable dimensions or aspect ratios for image containers so loading states do not shift layout.

### Overlays on Art

Art overlays may use hard-coded black alpha gradients for readability. Keep them local to image/card/game components, and avoid using them for regular app cards.

## Motion

Use motion to communicate game feel and state:

- tab selector spring
- modal sheet open/close spring
- loading dots
- card duplicate bounce
- rarity shimmer
- battle floating numbers
- turn banners
- Wordle tile animations
- Speed Calculus keypad press states

Motion rules:

- animations should be purposeful and short
- avoid long decorative loops outside game/pack reveal surfaces
- press feedback should be subtle opacity or scale
- game boards may use custom gesture/touch handling when normal Pressable behavior is insufficient

## Domain-Specific Systems

### Collectible Cards

`CardTile` is its own visual system. It uses:

- type-colored frame
- rarity ring and crest
- card art aspect ratio
- HP/ATK/DEF/SPD display
- rarity shimmer for Epic/Legendary
- quantity badges
- small and large size configs

Do not force `CardTile` into standard app card styling. Instead:

- keep its dimensions stable
- keep text legible at both sizes
- localize card metadata at render time where appropriate
- keep domain colors in `components/theme.ts`
- route generic action buttons below cards through shared button patterns when possible

### Packs

The packs screen combines storefront UI with pack-opening cinematic effects. Standard storefront sections should use the normal design system. Pack-opening sequences may use custom gradients, particles, SVG, glow, and hard-coded pack accent colors because they are closer to gameplay/art direction than app chrome.

Rules:

- Use tokenized surfaces for store cards, pack list rows, cost pills, and error/loading states.
- Keep pack-specific color and glow values isolated to pack-opening components/functions.
- Avoid leaking pack-opening colors into general panels.

### Quests

Quest list cards use:

- status-aware borders and progress bars
- 2px borders for game-card emphasis
- coin reward pills
- action gradients
- info/help modal for descriptions

Quest minigames may use custom boards:

- Wordle: tile grid, keyboard, result modals.
- Daily Numbers: numeric puzzle board and mode tabs.
- Speed Calculus: run summary, keypad, active full-screen panel.

Rules:

- The surrounding route background uses `bg-bg` or a semantic tint.
- Back-to-quests actions should use shared buttons or a standardized game back button.
- Modals should migrate toward `ModalSheetRoute`, `BattleFullScreenSheet`, or a reusable themed modal component.
- Keyboards and boards must define fixed tile/key dimensions and not shift with labels.

### PvP

PvP has three modes:

1. Lobby and invite management: standard surface cards and app buttons.
2. Loadout builder: dense builder UI with card thumbnails and a fixed footer.
3. Live battle: compact game board optimized for quick interactions.

Lobby rules:

- use `bg-bg`
- top padding from `useAppHeaderHeight()`
- cards `rounded-[24px]` to `rounded-[28px]`
- `ThemedExpoButton` for large action cards
- `ThemedExpoTextInput` for search

Loadout builder rules:

- may use a full-screen gradient background, but panels and inputs should remain tokenized
- fixed footer must account for bottom safe area
- card slots need stable aspect ratios
- selected state should be obvious through border, tint, and position badge

Battle board rules:

- battle field colors may be strong and team-coded
- unit cards may use dark overlays for readability
- touch targets must remain stable and testable
- overlay buttons need labels/test IDs
- action and card info sheets should use `BattleFullScreenSheet`
- surrounding sheets should migrate away from hard-coded white/slate where theme readability suffers

### Admin

Admin has a dedicated component layer:

- `AdminBackground`
- `AdminShell`
- `AdminPanel`
- `AdminHero`
- `AdminStat`
- `AdminNotice`
- `AdminFilterChip`
- `AdminSearchInput`
- `AdminButton`
- `AdminModal`
- `AdminSheet`
- `AdminEmptyState`

Admin rules:

- Use `AdminHero` at page top for title, subtitle, and primary actions.
- Use `FlatList` for large datasets.
- Use `AdminPanel` for grouped operational surfaces.
- Use compact stats and filter chips.
- Use `AdminSheet` or editor routes for long forms.
- Keep admin navigation in `AdminShell`; do not add another bottom nav.

## Accessibility and Interaction

Minimum expectations:

- Interactive controls should be at least 44px tall or have hitSlop.
- Icon-only buttons require accessible labels unless they are purely decorative inside a labeled control.
- Important errors should be readable text, not color alone.
- Selection should use both color and structure: border, icon, checkmark, or label.
- Disabled controls should reduce opacity and remain legible.
- Inputs should preserve keyboard behavior through `KeyboardScreenView`.
- Do not hide important actions behind long press only; long press can be a shortcut for details.

Test IDs are part of the mobile E2E contract for high-risk surfaces. Preserve existing test IDs, especially:

- tab buttons
- auth fields and submit
- collection detail sheet
- Wordle keys
- PvP battle board and unit cards
- PvP loadout builder
- settings controls
- admin editor controls

## Localization

UI copy belongs in `apps/mobile/src/i18n/`.

Rules:

- Keep `en` and `fr` structures aligned.
- Do not add UI translation strings to `packages/contracts`.
- Prefer feature scopes: `auth.*`, `packs.*`, `quests.*`, `pvp.*`, `admin.*`, `settings.*`, `gifts.*`.
- Preserve dynamic key families listed in `AGENTS.md`.
- Do not hard-code visible English strings in UI components unless the value is canonical game data and intentionally localized through a display helper later.

## Implementation Checklist

Before adding or changing a mobile UI surface:

1. Use NativeWind semantic classes first.
2. Use `THEME_COLORS` only for JS-only style values.
3. Apply `THEME_VARS` to modal/root surfaces that need local variable scope.
4. Use existing primitives: buttons, inputs, switches, loading/error states, modal sheet route, admin components.
5. Respect app header and tab bar safe-area helpers on tab screens.
6. Keep dimensions stable for cards, boards, tabs, keypads, icon buttons, and image containers.
7. Add or update translations in both `en` and `fr`.
8. Preserve test IDs and add focused IDs for high-risk interactions.
9. Register any intentional deviation in `DESIGN_OUTLIERS.md` if it cannot be resolved immediately.

## Verification Expectations

For design-system-sensitive UI changes:

- Run `npm run typecheck`.
- Run `cd apps/mobile && npx expo-doctor`.
- For interaction or visual behavior, run the narrowest relevant Maestro flow through `scripts/maestro.sh`.
- For screenshot-dependent work, follow the repository screenshot workflow in `AGENTS.md`.
- Inspect screenshots directly before claiming a visual change is complete.
