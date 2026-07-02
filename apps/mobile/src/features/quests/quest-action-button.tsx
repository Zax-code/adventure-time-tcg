import { useMemo, type ComponentType, type ReactNode } from "react";
import { ActivityIndicator, type ViewStyle } from "react-native";

import { ThemedExpoButton } from "../../components/expo-ui/themed-button";

type QuestActionButtonLoadingMode = "replace" | "inline";

export function QuestActionButton({
  label,
  onPress,
  backgroundColor,
  foregroundColor = "#FFFFFF",
  borderColor,
  disabled = false,
  loading = false,
  loadingMode = "replace",
  leadingAccessory,
  leadingIcon: LeadingIcon,
  leadingIconSize = 18,
  minHeight = 44,
  textClassName = "font-nunito-bold text-sm",
  accessibilityLabel,
  testID,
  style,
}: {
  label: string;
  onPress: () => void;
  backgroundColor: string;
  foregroundColor?: string;
  borderColor?: string;
  disabled?: boolean;
  loading?: boolean;
  loadingMode?: QuestActionButtonLoadingMode;
  leadingAccessory?: ReactNode;
  leadingIcon?: ComponentType<{ size?: number; color?: string }>;
  leadingIconSize?: number;
  minHeight?: number;
  textClassName?: string;
  accessibilityLabel?: string;
  testID?: string;
  style?: ViewStyle;
}) {
  const showInlineLoading = loading && loadingMode === "inline";
  const showReplaceLoading = loading && loadingMode === "replace";
  const resolvedLeadingAccessory = useMemo(
    () =>
      showInlineLoading ? (
        <ActivityIndicator color={foregroundColor} size="small" />
      ) : LeadingIcon ? (
        <LeadingIcon size={leadingIconSize} color={foregroundColor} />
      ) : (
        leadingAccessory
      ),
    [
      foregroundColor,
      LeadingIcon,
      leadingAccessory,
      leadingIconSize,
      showInlineLoading,
    ],
  );
  const fontFamily = textClassName.includes("semibold")
    ? "Nunito_600SemiBold"
    : "Nunito_700Bold";
  const fontSize = textClassName.includes("text-xs")
    ? 12
    : textClassName.includes("text-base")
      ? 16
      : 14;
  const fallbackAppearance = useMemo(
    () => ({
      backgroundColor,
      borderColor,
      borderRadius: 12,
      borderWidth: borderColor ? 1 : 0,
      foregroundColor,
      gradientColors: null,
      paddingHorizontal: 14,
      paddingVertical: 0,
      textStyle: {
        fontFamily,
        fontSize,
        lineHeight: minHeight < 42 ? 18 : 20,
      },
    }),
    [backgroundColor, borderColor, fontFamily, fontSize, foregroundColor, minHeight],
  );
  const buttonStyle = useMemo(
    () => ({
      ...style,
      minHeight,
    }),
    [minHeight, style],
  );

  return (
    <ThemedExpoButton
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityLabel={accessibilityLabel ?? label}
      testID={testID}
      loading={showReplaceLoading}
      label={label}
      leadingAccessory={resolvedLeadingAccessory}
      fallbackAppearance={fallbackAppearance}
      preferFallback
      style={buttonStyle}
      variant="primary"
    />
  );
}
