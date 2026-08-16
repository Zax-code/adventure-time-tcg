import { THEME_COLORS } from "../../../theme/themes";

export type Translate = (
  key: string,
  params?: Record<string, string | number>,
) => string;

export type ThemeColors =
  (typeof THEME_COLORS)[keyof typeof THEME_COLORS];

export type TrainingPhase = "ready" | "active" | "result";
