import type { ComponentProps, ReactNode } from "react";
import type { ViewStyle } from "react-native";

import { ThemedExpoButton } from "./expo-ui/themed-button";

type ThemedExpoButtonProps = ComponentProps<typeof ThemedExpoButton>;

export interface ButtonProps {
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  children: ReactNode;
  fallbackAppearance?: ThemedExpoButtonProps["fallbackAppearance"];
  leadingAccessory?: ReactNode;
  style?: ViewStyle;
  testID?: string;
}
