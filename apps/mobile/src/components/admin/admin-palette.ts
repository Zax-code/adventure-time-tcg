import { THEME_COLORS } from "../../theme/themes";
import { pickReadableTextColor, withAlpha } from "../theme";

export type ThemeColors = (typeof THEME_COLORS)[keyof typeof THEME_COLORS];

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
