import type { ReactNode } from "react";
import { Pressable, Text } from "react-native";

import { KEYPAD_KEY_CLASS, type KeypadKeyVariant } from "./game-state";

export interface KeypadKeyProps {
  label?: string;
  children?: ReactNode;
  variant?: KeypadKeyVariant;
  onPress?: () => void;
  disabled?: boolean;
  className?: string;
  accessibilityLabel?: string;
  testID?: string;
}

// 56 high, radius 16, 24/800: Daily Numbers numbers and operators and the
// Speed Calculus pad.
export function KeypadKey({
  label,
  children,
  variant = "default",
  onPress,
  disabled,
  className,
  accessibilityLabel,
  testID,
}: KeypadKeyProps) {
  const classes = KEYPAD_KEY_CLASS[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: Boolean(disabled), selected: variant === "selected" }}
      testID={testID}
      className={`h-[56px] items-center justify-center rounded-ds-md border ${classes.container} ${className ?? ""}`}
    >
      {label != null ? (
        <Text
          className={`font-nunito-extrabold ${
            variant === "action" ? "text-ds-h3" : "text-[24px] leading-[29px]"
          } ${classes.text}`}
        >
          {label}
        </Text>
      ) : (
        children
      )}
    </Pressable>
  );
}
