import type { ComponentType, ReactNode, Ref } from "react";
import {
  ActivityIndicator,
  type AccessibilityState,
  type StyleProp,
  type View,
  type ViewStyle,
} from "react-native";

import {
  Button,
  type ButtonSize,
  type ButtonTone,
} from "../../components/ui/button";
import type { IconSlot } from "../../components/ui/tokens";

type QuestActionButtonLoadingMode = "replace" | "inline";

// Quest screens' command button: a Button with an inline-loading mode for
// actions that keep their label while working (share, claim).
export function QuestActionButton({
  buttonRef,
  label,
  onPress,
  tone = "primary",
  size = "md",
  disabled = false,
  loading = false,
  loadingMode = "replace",
  leadingAccessory,
  leadingIcon: LeadingIcon,
  leadingIconSize = 18,
  accessibilityLabel,
  accessibilityState,
  testID,
  style,
}: {
  buttonRef?: Ref<View>;
  label: string;
  onPress: () => void;
  tone?: ButtonTone;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  loadingMode?: QuestActionButtonLoadingMode;
  leadingAccessory?: ReactNode;
  leadingIcon?: ComponentType<{ size?: number; color?: string }>;
  leadingIconSize?: number;
  accessibilityLabel?: string;
  accessibilityState?: AccessibilityState;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const showInlineLoading = loading && loadingMode === "inline";
  const icon: IconSlot | undefined = showInlineLoading
    ? ({ color }) => <ActivityIndicator color={color} size="small" />
    : LeadingIcon
      ? ({ color }) => <LeadingIcon size={leadingIconSize} color={color} />
      : leadingAccessory
        ? () => leadingAccessory
        : undefined;

  return (
    <Button
      buttonRef={buttonRef}
      tone={tone}
      size={size}
      icon={icon}
      onPress={onPress}
      disabled={disabled || showInlineLoading}
      loading={loading && loadingMode === "replace"}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={accessibilityState}
      testID={testID}
      style={style}
    >
      {label}
    </Button>
  );
}
