// Shared colors for letter tiles and keys in the quest games (board 02,
// Game Tile and Game Key): correct = success, present = secondary,
// absent = muted.
export type GameCellState = "empty" | "filled" | "correct" | "present" | "absent";

export const GAME_CELL_CLASS: Record<GameCellState, { container: string; text: string }> = {
  empty: { container: "bg-surface border-primaryBorder", text: "text-fg" },
  filled: { container: "bg-surface border-primary", text: "text-fg" },
  correct: { container: "bg-successDark border-successDark", text: "text-white" },
  present: {
    container: "bg-secondaryDark border-secondaryDark",
    text: "text-secondaryText",
  },
  absent: { container: "bg-muted border-muted", text: "text-white" },
};

export type KeypadKeyVariant = "default" | "selected" | "operator" | "used" | "action";

export const KEYPAD_KEY_CLASS: Record<KeypadKeyVariant, { container: string; text: string }> = {
  default: { container: "bg-surface border-primaryBorder", text: "text-fg" },
  selected: { container: "bg-primary border-primary", text: "text-white" },
  operator: { container: "bg-primaryTint border-primaryTint", text: "text-primaryText" },
  used: { container: "bg-surface border-primaryBorder opacity-40", text: "text-fg" },
  action: { container: "bg-accentTint border-accentBorder", text: "text-accentText" },
};
