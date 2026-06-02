import { THEME_COLORS } from "../../../theme/themes";

type ThemeColors = (typeof THEME_COLORS)[keyof typeof THEME_COLORS];

export function withAlpha(color: string, alpha: string) {
  if (color.startsWith("#")) {
    if (color.length === 7) {
      return `${color}${alpha}`;
    }

    if (color.length === 9) {
      return `${color.slice(0, 7)}${alpha}`;
    }
  }

  return color;
}

export function getAnswerBoxPalette(
  tc: ThemeColors,
  feedbackKind: "correct" | "incorrect" | null | undefined,
) {
  if (feedbackKind === "correct") {
    return {
      background: tc.successTint,
      border: tc.successBorder,
      text: tc.successText,
      placeholder: withAlpha(tc.successText, "40"),
    };
  }

  if (feedbackKind === "incorrect") {
    return {
      background: tc.dangerTint,
      border: tc.dangerBorder,
      text: tc.dangerText,
      placeholder: withAlpha(tc.dangerText, "40"),
    };
  }

  return {
    background: tc.surface,
    border: tc.primaryBorder,
    text: tc.primaryDark,
    placeholder: withAlpha(tc.primaryDark, "38"),
  };
}
