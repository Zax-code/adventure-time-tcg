import type { ComponentType, ReactNode } from "react";
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  type ViewStyle,
  View,
} from "react-native";

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
  const hasLeadingContent = Boolean(leadingAccessory || LeadingIcon);

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      testID={testID}
      style={[
        {
          borderRadius: 12,
          borderWidth: borderColor ? 1 : 0,
          borderColor,
          opacity: disabled || loading ? 0.6 : 1,
          overflow: "hidden",
        },
        style,
      ]}
    >
      <View
        style={{
          minHeight,
          paddingHorizontal: 14,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: hasLeadingContent || loading ? 8 : 0,
          backgroundColor,
        }}
      >
        {showReplaceLoading ? (
          <ActivityIndicator color={foregroundColor} size="small" />
        ) : (
          <>
            {showInlineLoading ? (
              <ActivityIndicator color={foregroundColor} size="small" />
            ) : LeadingIcon ? (
              <LeadingIcon size={leadingIconSize} color={foregroundColor} />
            ) : (
              leadingAccessory
            )}
            <Text
              className={textClassName}
              style={{
                color: foregroundColor,
                lineHeight: minHeight < 42 ? 18 : 20,
                textAlign: "center",
              }}
            >
              {label}
            </Text>
          </>
        )}
      </View>
    </TouchableOpacity>
  );
}
