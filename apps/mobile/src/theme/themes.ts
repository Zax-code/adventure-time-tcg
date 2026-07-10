import { vars } from "nativewind";

import {
  getThemeColorScheme,
  THEME_COLORS,
  THEME_CSS_VARIABLES,
  THEME_NAMES,
  type ThemeName,
} from "@adventure-time/theme";

export { THEME_COLORS, type ThemeName } from "@adventure-time/theme";

export function getExpoUIColorScheme(themeName: ThemeName): "light" | "dark" {
  return getThemeColorScheme(themeName);
}

export const THEME_VARS: Record<
  ThemeName,
  ReturnType<typeof vars>
> = Object.fromEntries(
  THEME_NAMES.map((themeName) => [
    themeName,
    vars(THEME_CSS_VARIABLES[themeName]),
  ]),
) as Record<ThemeName, ReturnType<typeof vars>>;
