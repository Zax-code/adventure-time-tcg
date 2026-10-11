import { Pressable, Text } from "react-native";

import { GAME_CELL_CLASS, type GameCellState } from "./game-state";

export type GameKeyKind = "letter" | "enter" | "delete";

export interface GameKeyProps {
  label: string;
  state?: GameCellState;
  kind?: GameKeyKind;
  onPress?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  testID?: string;
}

const KIND_WIDTH: Record<GameKeyKind, string> = {
  letter: "w-[32px]",
  enter: "w-[56px]",
  delete: "w-[44px]",
};

// 44 high, radius 12, 15/800 label; Enter is a primary key.
export function GameKey({
  label,
  state = "empty",
  kind = "letter",
  onPress,
  disabled,
  accessibilityLabel,
  testID,
}: GameKeyProps) {
  const classes =
    kind === "enter"
      ? { container: "bg-primary border-primary", text: "text-white" }
      : GAME_CELL_CLASS[state];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      testID={testID}
      className={`h-[44px] items-center justify-center rounded-ds-sm border ${KIND_WIDTH[kind]} ${
        classes.container
      } ${disabled ? "opacity-[0.45]" : ""}`}
    >
      <Text
        className={`font-nunito-extrabold ${kind === "enter" ? "text-ds-caption" : "text-ds-body"} ${classes.text}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
