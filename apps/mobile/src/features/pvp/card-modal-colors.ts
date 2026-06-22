import {
  CARD_TYPE_COLORS,
  CARD_TYPE_COLORS_ICE,
  CARD_TYPE_COLORS_NIGHTOSPHERE,
} from "../../components/theme";
import type { ThemeName } from "../../theme/themes";
import type { PvpUnitState } from "./types";

type TypeColor = { frame: string; light: string; dark: string };

function getTypePalette(themeName: ThemeName): Record<string, TypeColor> {
  if (themeName === "ice") {
    return CARD_TYPE_COLORS_ICE;
  }

  if (themeName === "nightosphere") {
    return CARD_TYPE_COLORS_NIGHTOSPHERE;
  }

  return CARD_TYPE_COLORS;
}

export function getCardModalTypeColor(
  unit: PvpUnitState,
  themeName: ThemeName,
) {
  const typePalette = getTypePalette(themeName);
  return typePalette[unit.type] ?? typePalette.Hero;
}
