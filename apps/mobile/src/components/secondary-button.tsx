import { ThemedExpoButton } from "./expo-ui/themed-button";
import type { ButtonProps } from "./button-types";

export function SecondaryButton({
  onPress,
  disabled,
  loading,
  children,
  fallbackAppearance,
  leadingAccessory,
  style,
  testID,
}: ButtonProps) {
  return (
    <ThemedExpoButton
      onPress={onPress}
      disabled={disabled}
      loading={loading}
      fallbackAppearance={fallbackAppearance}
      leadingAccessory={leadingAccessory}
      preferFallback
      style={style}
      testID={testID}
      variant="secondary"
    >
      {children}
    </ThemedExpoButton>
  );
}
