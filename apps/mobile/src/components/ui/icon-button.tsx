import type { Insets } from "react-native";
import { Pressable } from "react-native";

import {
  type IconSlot,
  SlotIcon,
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
  // Fill with the tone tint instead of surface (the admin header action).
  tinted?: boolean;
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
  tinted,
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
      className={`h-icon-button w-icon-button items-center justify-center rounded-ds-pill border ${
        tinted ? TONE_CLASS[tone].tint : "bg-surface"
      } ${TONE_CLASS[tone].border} ${disabled ? "opacity-[0.45]" : ""} ${className ?? ""}`}
    >
      <SlotIcon icon={icon} color={toneTextColor(tc, tone)} size={20} />
    </Pressable>
  );
}
