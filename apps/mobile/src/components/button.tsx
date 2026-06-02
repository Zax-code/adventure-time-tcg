import type { ViewStyle } from "react-native";

import { ThemedExpoButton } from "./expo-ui/themed-button";

interface ButtonProps {
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  children: React.ReactNode;
  style?: ViewStyle;
  testID?: string;
}

export function PrimaryButton({
  onPress,
  disabled,
  loading,
  children,
  style,
  testID,
}: ButtonProps) {
  return (
    <ThemedExpoButton
      onPress={onPress}
      disabled={disabled}
      loading={loading}
      style={style}
      testID={testID}
      variant="primary"
    >
      {children}
    </ThemedExpoButton>
  );
}

export function SecondaryButton({
  onPress,
  disabled,
  loading,
  children,
  style,
  testID,
}: ButtonProps) {
  return (
    <ThemedExpoButton
      onPress={onPress}
      disabled={disabled}
      loading={loading}
      style={style}
      testID={testID}
      variant="secondary"
    >
      {children}
    </ThemedExpoButton>
  );
}

export function GhostButton({
  onPress,
  disabled,
  loading,
  children,
  style,
  testID,
}: ButtonProps) {
  return (
    <ThemedExpoButton
      onPress={onPress}
      disabled={disabled}
      loading={loading}
      style={style}
      testID={testID}
      variant="ghost"
    >
      {children}
    </ThemedExpoButton>
  );
}
