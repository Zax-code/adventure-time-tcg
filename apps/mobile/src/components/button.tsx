import type { ViewStyle } from "react-native";

import { ThemedExpoButton } from "./expo-ui/themed-button";

interface ButtonProps {
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  children: React.ReactNode;
  style?: ViewStyle;
}

export function PrimaryButton({ onPress, disabled, loading, children, style }: ButtonProps) {
  return (
    <ThemedExpoButton
      onPress={onPress}
      disabled={disabled}
      loading={loading}
      style={style}
      variant="primary"
    >
      {children}
    </ThemedExpoButton>
  );
}

export function SecondaryButton({ onPress, disabled, loading, children, style }: ButtonProps) {
  return (
    <ThemedExpoButton
      onPress={onPress}
      disabled={disabled}
      loading={loading}
      style={style}
      variant="secondary"
    >
      {children}
    </ThemedExpoButton>
  );
}

export function GhostButton({ onPress, disabled, loading, children, style }: ButtonProps) {
  return (
    <ThemedExpoButton
      onPress={onPress}
      disabled={disabled}
      loading={loading}
      style={style}
      variant="ghost"
    >
      {children}
    </ThemedExpoButton>
  );
}
