export {
  getThemeColorScheme,
  getThemeCssVariables,
  isThemeName,
  normalizeThemeName,
  THEME_COLORS,
  THEME_CSS_VARIABLE_NAMES,
  THEME_CSS_VARIABLES,
  THEME_NAMES,
  type ThemeColorName,
  type ThemeColors,
  type ThemeCssVariableName,
  type ThemeCssVariables,
  type ThemeName,
} from "@adventure-time/theme";

export {
  ThemeProvider,
  ThemeSwitcher,
  useOptionalTheme,
  useTheme,
  type ThemeContextValue,
} from "./theme-provider";
export {
  applyThemeToElement,
  getBrowserThemeStorage,
  persistThemeName,
  readStoredThemeName,
  WEB_THEME_STORAGE_KEY,
} from "./theme";
