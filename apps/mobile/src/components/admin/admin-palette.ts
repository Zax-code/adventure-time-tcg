import { THEME_COLORS } from "../../theme/themes";

export type ThemeColors = (typeof THEME_COLORS)[keyof typeof THEME_COLORS];

type Rgb = { r: number; g: number; b: number };

function parseHex(color: string): Rgb | null {
  const normalized = color.replace("#", "");

  if (normalized.length !== 6 && normalized.length !== 8) {
    return null;
  }

  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function parseRgb(color: string): Rgb | null {
  const match = color.match(/^rgba?\(([^)]+)\)$/);
  if (!match) {
    return null;
  }

  const [r, g, b] = match[1]
    .split(",")
    .slice(0, 3)
    .map((part) => Number.parseFloat(part.trim()));

  if ([r, g, b].some((channel) => Number.isNaN(channel))) {
    return null;
  }

  return { r, g, b };
}

function toRgb(color: string): Rgb | null {
  if (color.startsWith("#")) {
    return parseHex(color);
  }

  return parseRgb(color);
}

function luminance({ r, g, b }: Rgb) {
  const channels = [r, g, b].map((value) => {
    const normalized = value / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(a: string, b: string) {
  const rgbA = toRgb(a);
  const rgbB = toRgb(b);

  if (!rgbA || !rgbB) {
    return 1;
  }

  const light = Math.max(luminance(rgbA), luminance(rgbB));
  const dark = Math.min(luminance(rgbA), luminance(rgbB));

  return (light + 0.05) / (dark + 0.05);
}

export function withAlpha(color: string, alpha: string) {
  const opacity = Number.parseInt(alpha, 16) / 255;

  if (color.startsWith("#")) {
    if (color.length === 7) {
      return `${color}${alpha}`;
    }

    if (color.length === 9) {
      return `${color.slice(0, 7)}${alpha}`;
    }
  }

  const rgb = toRgb(color);
  if (!rgb) {
    return color;
  }

  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
}

export function pickReadableTextColor(
  background: string,
  darkText: string,
  lightText: string,
) {
  return contrastRatio(background, darkText) >=
    contrastRatio(background, lightText)
    ? darkText
    : lightText;
}

export function getAbilityTypePalette(
  tc: ThemeColors,
  type: "PASSIVE" | "SKILL" | "ULTIMATE",
) {
  if (type === "PASSIVE") {
    return {
      bg: tc.successTint,
      text: tc.successText,
      border: tc.successBorder,
    };
  }

  if (type === "SKILL") {
    return {
      bg: tc.infoTint,
      text: tc.infoText,
      border: tc.infoBorder,
    };
  }

  return {
    bg: tc.secondaryTint,
    text: tc.secondaryText,
    border: tc.secondaryBorder,
  };
}
