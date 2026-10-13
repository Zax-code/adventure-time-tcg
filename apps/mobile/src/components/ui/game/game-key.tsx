import {
  type Insets,
  Pressable,
  type StyleProp,
  Text,
  type ViewStyle,
} from "react-native";

import { ON_PRIMARY } from "@adventure-time/theme";

import { type IconSlot, SlotIcon, useThemePalette } from "../tokens";
import { GAME_CELL_CLASS, type GameCellState, glyphCenterStyle } from "./game-state";

export type GameKeyKind = "letter" | "enter" | "clear" | "delete";

export interface GameKeyProps {
  label: string;
  state?: GameCellState;
  kind?: GameKeyKind;
  // Rendered instead of the label (the Delete backspace glyph); the label
  // stays the accessibility label.
  icon?: IconSlot;
  onPress?: () => void;
  onPressIn?: () => void;
  onPressOut?: () => void;
  disabled?: boolean;
  hitSlop?: Insets | number;
  // Layout only (measured width, height, press feedback transform).
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
}

const KIND_WIDTH: Record<GameKeyKind, string> = {
  letter: "w-[32px]",
  enter: "flex-1",
  clear: "flex-1",
  delete: "w-[44px]",
};

// 44 high, radius 12. Letter keys use an 18/800 label; Clear and Enter are
// the 15/800 command keys that share the row under the keyboard, with Enter
// as the primary "Submit".
export function GameKey({
  label,
  state = "empty",
  kind = "letter",
  icon,
  onPress,
  onPressIn,
  onPressOut,
  disabled,
  hitSlop,
  style,
  accessibilityLabel,
  testID,
}: GameKeyProps) {
  const tc = useThemePalette();
  const isCommand = kind === "enter" || kind === "clear";
  const classes =
    kind === "enter"
      ? { container: "bg-primary border-primary", text: "text-white" }
      : GAME_CELL_CLASS[state];

  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={disabled}
      hitSlop={hitSlop}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      testID={testID}
      style={style}
      className={`h-[44px] items-center justify-center rounded-ds-sm border ${KIND_WIDTH[kind]} ${
        classes.container
      } ${disabled ? "opacity-[0.45]" : ""}`}
    >
      {icon ? (
        <SlotIcon icon={icon} color={kind === "enter" ? ON_PRIMARY : tc.fg} size={18} />
      ) : (
        <Text
          className={`font-nunito-extrabold ${
            isCommand ? "text-ds-body" : "text-[18px] leading-[22px]"
          } ${classes.text}`}
          style={isCommand ? undefined : glyphCenterStyle(18)}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}
