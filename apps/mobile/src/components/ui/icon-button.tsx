import type { Insets } from "react-native";
import { Pressable } from "react-native";

import {
  type IconSlot,
  renderIcon,
  type Tone,
  TONE_CLASS,
  toneTextColor,
  useThemePalette,
} from "./tokens";

export interface IconButtonProps {
  icon: IconSlot;
  accessibilityLabel: string;
  onPress?: () => void;
  tone?: Tone;
  disabled?: boolean;
  hitSlop?: Insets | number;
  className?: string;
  testID?: string;
}

export function IconButton({
  icon,
  accessibilityLabel,
  onPress,
  tone = "primary",
  disabled,
  hitSlop,
  className,
  testID,
}: IconButtonProps) {
  const tc = useThemePalette();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={hitSlop}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: Boolean(disabled) }}
      testID={testID}
      className={`h-icon-button w-icon-button items-center justify-center rounded-ds-pill border bg-surface ${
        TONE_CLASS[tone].border
      } ${disabled ? "opacity-[0.45]" : ""} ${className ?? ""}`}
    >
      {renderIcon(icon, toneTextColor(tc, tone), 20)}
    </Pressable>
  );
}
