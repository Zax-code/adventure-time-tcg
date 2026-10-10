import type { ReactNode, Ref } from "react";
import {
  ActivityIndicator,
  type AccessibilityState,
  type Insets,
  Pressable,
  StyleSheet,
  type StyleProp,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { CONTROL, ON_PRIMARY, RADIUS } from "@adventure-time/theme";

import {
  getElevation,
  type IconSlot,
  SlotIcon,
  type ThemePalette,
  useThemeName,
  useThemePalette,
} from "./tokens";

export type ButtonTone = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "lg" | "md" | "sm";

export interface ButtonProps {
  children?: ReactNode;
  tone?: ButtonTone;
  size?: ButtonSize;
  icon?: IconSlot;
  onPress?: () => void;
  onLongPress?: () => void;
  delayLongPress?: number;
  disabled?: boolean;
  loading?: boolean;
  hitSlop?: Insets | number;
  accessibilityLabel?: string;
  accessibilityState?: AccessibilityState;
  buttonRef?: Ref<View>;
  className?: string;
  // Layout only (flex, width, margins); the look comes from tone and size.
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const HEIGHT: Record<ButtonSize, number> = {
  lg: CONTROL.lg,
  md: CONTROL.md,
  sm: CONTROL.sm,
};

function getToneStyle(tc: ThemePalette, tone: ButtonTone) {
  switch (tone) {
    case "secondary":
      return {
        gradient: [tc.secondary, tc.secondaryDark] as const,
        foreground: tc.secondaryText,
      };
    case "danger":
      return {
        gradient: [tc.danger, tc.dangerDark] as const,
        foreground: ON_PRIMARY,
      };
    case "ghost":
      return { gradient: null, foreground: tc.primaryText };
    default:
      return {
        gradient: [tc.primary, tc.primaryDark] as const,
        foreground: ON_PRIMARY,
      };
  }
}

function getLabel(children: ReactNode) {
  return typeof children === "string" || typeof children === "number"
    ? String(children)
    : null;
}

export function Button({
  children,
  tone = "primary",
  size = "md",
  icon,
  onPress,
  onLongPress,
  delayLongPress,
  disabled,
  loading,
  hitSlop,
  accessibilityLabel,
  accessibilityState,
  buttonRef,
  className,
  style,
  testID,
}: ButtonProps) {
  const themeName = useThemeName();
  const tc = useThemePalette();
  const { gradient, foreground } = getToneStyle(tc, tone);
  const label = getLabel(children);
  const inactive = disabled || loading;
  const paddingClass =
    size === "sm" ? "px-ds-4" : tone === "ghost" ? "px-ds-5" : "px-ds-6";

  const content = loading ? (
    <ActivityIndicator color={foreground} />
  ) : (
    <View className="flex-row items-center justify-center gap-ds-2">
      <SlotIcon icon={icon} color={foreground} size={18} />
      {label != null ? (
        <Text
          className={`shrink text-center font-nunito-bold ${
            size === "sm" ? "text-ds-sm" : "text-ds-body"
          }`}
          style={{ color: foreground }}
          numberOfLines={2}
        >
          {label}
        </Text>
      ) : (
        children
      )}
    </View>
  );

  return (
    <Pressable
      ref={buttonRef}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={delayLongPress}
      hitSlop={hitSlop}
      accessible
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label ?? undefined}
      accessibilityState={{ disabled: Boolean(inactive), ...accessibilityState }}
      nativeID={testID}
      testID={testID}
      disabled={inactive}
      className={`items-center justify-center rounded-ds-pill ${paddingClass} ${
        gradient ? "" : "border border-primaryBorder bg-surface"
      } ${inactive ? "opacity-[0.45]" : ""} ${className ?? ""}`}
      style={[
        {
          minHeight: HEIGHT[size],
          boxShadow:
            tone === "primary" && !inactive
              ? getElevation(themeName, "float")
              : undefined,
        },
        style,
      ]}
    >
      {gradient ? (
        <LinearGradient
          pointerEvents="none"
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[StyleSheet.absoluteFill, { borderRadius: RADIUS.pill }]}
        />
      ) : null}
      {content}
    </Pressable>
  );
}
