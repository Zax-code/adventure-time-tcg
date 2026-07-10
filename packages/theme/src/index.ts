export const THEME_NAMES = ["candy", "ice", "nightosphere"] as const;

export type ThemeName = (typeof THEME_NAMES)[number];

export interface ThemeColors {
  bg: string;
  fg: string;
  surface: string;
  surfaceMuted: string;
  fgMuted: string;
  muted: string;
  primary: string;
  primaryDark: string;
  primaryText: string;
  primaryStrong: string;
  primaryBorder: string;
  primaryBg: string;
  primaryTint: string;
  secondary: string;
  secondaryDark: string;
  secondaryText: string;
  secondaryTint: string;
  secondaryBorder: string;
  accent: string;
  accentDark: string;
  accentText: string;
  accentStrong: string;
  accentTint: string;
  accentBorder: string;
  success: string;
  successDark: string;
  successText: string;
  successTint: string;
  successBorder: string;
  danger: string;
  dangerDark: string;
  dangerText: string;
  dangerTint: string;
  dangerBorder: string;
  info: string;
  infoDark: string;
  infoText: string;
  infoTint: string;
  infoBorder: string;
}

export type ThemeColorName = keyof ThemeColors;
export type ThemeColorScheme = "light" | "dark";

export const THEME_COLORS = {
  candy: {
    bg: "#fff0f5",
    fg: "#4a3728",
    surface: "rgba(255,255,255,0.96)",
    surfaceMuted: "rgba(255,255,255,0.9)",
    fgMuted: "#6b7280",
    muted: "#9CA3AF",
    primary: "#F472B6",
    primaryDark: "#EC4899",
    primaryText: "#DB2777",
    primaryStrong: "#BE185D",
    primaryBorder: "#F9A8D4",
    primaryBg: "#FDF2F8",
    primaryTint: "#FCE7F3",
    secondary: "#FDE047",
    secondaryDark: "#FACC15",
    secondaryText: "#894B00",
    secondaryTint: "#FEF9C3",
    secondaryBorder: "#FEF08A",
    accent: "#C084FC",
    accentDark: "#A855F7",
    accentText: "#9333EA",
    accentStrong: "#7C3AED",
    accentTint: "#F3E8FF",
    accentBorder: "#E9D5FF",
    success: "#2DD4BF",
    successDark: "#14B8A6",
    successText: "#005F5A",
    successTint: "#CCFBF1",
    successBorder: "#96F7E4",
    danger: "#FB7185",
    dangerDark: "#F43F5E",
    dangerText: "#A50036",
    dangerTint: "#FFE4E6",
    dangerBorder: "#FECDD3",
    info: "#818CF8",
    infoDark: "#6366F1",
    infoText: "#4F46E5",
    infoTint: "#E0E7FF",
    infoBorder: "#C7D2FE",
  },
  ice: {
    bg: "#F0F7FF",
    fg: "#1F2937",
    surface: "rgba(255,255,255,0.98)",
    surfaceMuted: "rgba(240,247,255,0.95)",
    fgMuted: "#6B7280",
    muted: "#94A3B8",
    primary: "#60A5FA",
    primaryDark: "#3B82F6",
    primaryText: "#1D4ED8",
    primaryStrong: "#1E40AF",
    primaryBorder: "#BFDBFE",
    primaryBg: "#EFF6FF",
    primaryTint: "#DBEAFE",
    secondary: "#67E8F9",
    secondaryDark: "#22D3EE",
    secondaryText: "#0E7490",
    secondaryTint: "#CFFAFE",
    secondaryBorder: "#A5F3FC",
    accent: "#818CF8",
    accentDark: "#6366F1",
    accentText: "#4338CA",
    accentStrong: "#3730A3",
    accentTint: "#E0E7FF",
    accentBorder: "#C7D2FE",
    success: "#34D399",
    successDark: "#10B981",
    successText: "#065F46",
    successTint: "#D1FAE5",
    successBorder: "#6EE7B7",
    danger: "#F87171",
    dangerDark: "#EF4444",
    dangerText: "#B91C1C",
    dangerTint: "#FEE2E2",
    dangerBorder: "#FECACA",
    info: "#60A5FA",
    infoDark: "#3B82F6",
    infoText: "#1D4ED8",
    infoTint: "#DBEAFE",
    infoBorder: "#BFDBFE",
  },
  nightosphere: {
    bg: "#0D0010",
    fg: "#F0C0C0",
    surface: "#1a0b15",
    surfaceMuted: "#120813",
    fgMuted: "#9CA3AF",
    muted: "#4B5563",
    primary: "#EF4444",
    primaryDark: "#DC2626",
    primaryText: "#FCA5A5",
    primaryStrong: "#B91C1C",
    primaryBorder: "#7F1D1D",
    primaryBg: "#1c0a0a",
    primaryTint: "#2d0f0f",
    secondary: "#F97316",
    secondaryDark: "#EA580C",
    secondaryText: "#FDBA74",
    secondaryTint: "#1c0d05",
    secondaryBorder: "#7c2d12",
    accent: "#C084FC",
    accentDark: "#A855F7",
    accentText: "#E9D5FF",
    accentStrong: "#7C3AED",
    accentTint: "#1e0a2e",
    accentBorder: "#4c1d95",
    success: "#34D399",
    successDark: "#10B981",
    successText: "#6EE7B7",
    successTint: "#022c22",
    successBorder: "#064e3b",
    danger: "#F87171",
    dangerDark: "#EF4444",
    dangerText: "#FECACA",
    dangerTint: "#1c0505",
    dangerBorder: "#7f1d1d",
    info: "#818CF8",
    infoDark: "#6366F1",
    infoText: "#C7D2FE",
    infoTint: "#0f0f2e",
    infoBorder: "#1e1b4b",
  },
} as const satisfies Record<ThemeName, ThemeColors>;

export const THEME_CSS_VARIABLE_NAMES = {
  bg: "--color-bg",
  fg: "--color-fg",
  surface: "--color-surface",
  surfaceMuted: "--color-surface-muted",
  fgMuted: "--color-fg-muted",
  muted: "--color-muted",
  primary: "--color-primary",
  primaryDark: "--color-primary-dark",
  primaryText: "--color-primary-text",
  primaryStrong: "--color-primary-strong",
  primaryBorder: "--color-primary-border",
  primaryBg: "--color-primary-bg",
  primaryTint: "--color-primary-tint",
  secondary: "--color-secondary",
  secondaryDark: "--color-secondary-dark",
  secondaryText: "--color-secondary-text",
  secondaryTint: "--color-secondary-tint",
  secondaryBorder: "--color-secondary-border",
  accent: "--color-accent",
  accentDark: "--color-accent-dark",
  accentText: "--color-accent-text",
  accentStrong: "--color-accent-strong",
  accentTint: "--color-accent-tint",
  accentBorder: "--color-accent-border",
  success: "--color-success",
  successDark: "--color-success-dark",
  successText: "--color-success-text",
  successTint: "--color-success-tint",
  successBorder: "--color-success-border",
  danger: "--color-danger",
  dangerDark: "--color-danger-dark",
  dangerText: "--color-danger-text",
  dangerTint: "--color-danger-tint",
  dangerBorder: "--color-danger-border",
  info: "--color-info",
  infoDark: "--color-info-dark",
  infoText: "--color-info-text",
  infoTint: "--color-info-tint",
  infoBorder: "--color-info-border",
} as const satisfies Record<ThemeColorName, `--${string}`>;

export type ThemeCssVariableName =
  (typeof THEME_CSS_VARIABLE_NAMES)[ThemeColorName];
export type ThemeCssVariables = Record<ThemeCssVariableName, string>;

export function isThemeName(value: unknown): value is ThemeName {
  return typeof value === "string" && THEME_NAMES.includes(value as ThemeName);
}

export function normalizeThemeName(value: unknown): ThemeName {
  return isThemeName(value) ? value : "candy";
}

export function getThemeColorScheme(themeName: ThemeName): ThemeColorScheme {
  return themeName === "nightosphere" ? "dark" : "light";
}

export function getThemeCssVariables(themeName: ThemeName): ThemeCssVariables {
  const colors = THEME_COLORS[themeName];

  return Object.fromEntries(
    (Object.keys(THEME_CSS_VARIABLE_NAMES) as ThemeColorName[]).map(
      (colorName) => [THEME_CSS_VARIABLE_NAMES[colorName], colors[colorName]],
    ),
  ) as ThemeCssVariables;
}

export const THEME_CSS_VARIABLES: Record<ThemeName, ThemeCssVariables> = {
  candy: getThemeCssVariables("candy"),
  ice: getThemeCssVariables("ice"),
  nightosphere: getThemeCssVariables("nightosphere"),
};
