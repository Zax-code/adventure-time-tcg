import { useEffect } from "react";
import {
  Host,
  TextInput as ExpoTextInput,
  useNativeState,
  type TextInputProps as ExpoTextInputProps,
  type UniversalStyle,
  type UniversalTextStyle,
} from "@expo/ui";
import type { StyleProp, ViewStyle } from "react-native";

import { useThemeStore } from "../../stores/theme-store";
import {
  getExpoUIColorScheme,
  THEME_COLORS,
  type ThemeName,
} from "../../theme/themes";

type ThemedExpoTextInputProps = Omit<
  ExpoTextInputProps,
  "value" | "style" | "textStyle" | "placeholderTextColor"
> & {
  value: string;
  onChangeText: (value: string) => void;
  hostStyle?: StyleProp<ViewStyle>;
  style?: UniversalStyle;
  textStyle?: UniversalTextStyle;
  placeholderTextColor?: string;
  themeName?: ThemeName;
};

export function ThemedExpoTextInput({
  value,
  onChangeText,
  hostStyle,
  style,
  textStyle,
  placeholderTextColor,
  themeName: explicitThemeName,
  ...props
}: ThemedExpoTextInputProps) {
  const storedThemeName = useThemeStore((state) => state.themeName);
  const themeName = explicitThemeName ?? storedThemeName;
  const tc = THEME_COLORS[themeName];
  const textState = useNativeState(value);

  useEffect(() => {
    if (textState.value !== value) {
      textState.value = value;
    }
  }, [textState, value]);

  return (
    <Host colorScheme={getExpoUIColorScheme(themeName)} style={hostStyle}>
      <ExpoTextInput
        {...props}
        value={textState}
        onChangeText={onChangeText}
        placeholderTextColor={placeholderTextColor ?? tc.muted}
        style={style}
        textStyle={textStyle}
      />
    </Host>
  );
}
