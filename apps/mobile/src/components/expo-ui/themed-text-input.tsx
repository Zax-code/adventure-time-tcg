import { useEffect, type RefObject } from "react";
import {
  Host,
  TextInput as ExpoTextInput,
  useNativeState,
  type TextInputProps as ExpoTextInputProps,
  type UniversalStyle,
  type UniversalTextStyle,
} from "@expo/ui";
import {
  StyleSheet,
  TextInput as ReactNativeTextInput,
  View,
  type StyleProp,
  type TextInputProps as ReactNativeTextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { useThemeStore } from "../../stores/theme-store";
import {
  getExpoUIColorScheme,
  THEME_COLORS,
  type ThemeName,
} from "../../theme/themes";

type ThemedExpoTextInputProps = Omit<
  ExpoTextInputProps,
  "ref" | "value" | "style" | "textStyle" | "placeholderTextColor"
> & {
  value: string;
  onChangeText: (value: string) => void;
  inputRef?: RefObject<ReactNativeTextInput | null>;
  hostStyle?: StyleProp<ViewStyle>;
  style?: UniversalStyle;
  textStyle?: UniversalTextStyle;
  placeholderTextColor?: string;
  themeName?: ThemeName;
};

export function ThemedExpoTextInput({
  value,
  onChangeText,
  inputRef,
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
  // Decorated inputs currently render more reliably through React Native than
  // Expo UI when we need bordered, padded, full-width fields across screens.
  const hasStyledContainer =
    style != null &&
    (style.backgroundColor != null ||
      style.borderColor != null ||
      style.borderRadius != null ||
      style.borderWidth != null ||
      style.padding != null ||
      style.paddingHorizontal != null ||
      style.paddingVertical != null ||
      style.paddingTop != null ||
      style.paddingBottom != null ||
      style.paddingLeft != null ||
      style.paddingRight != null ||
      typeof style.width === "string" ||
      typeof style.height === "string");
  const shouldUseFallback =
    hasStyledContainer ||
    (typeof props.testID === "string" && props.testID.length > 0);

  useEffect(() => {
    if (textState.value !== value) {
      textState.value = value;
    }
  }, [textState, value]);

  if (shouldUseFallback) {
    const fallbackProps: ReactNativeTextInputProps = {
      autoCapitalize: props.autoCapitalize,
      autoComplete: props.autoComplete,
      autoCorrect: props.autoCorrect,
      autoFocus: props.autoFocus,
      editable: props.editable,
      keyboardType: props.keyboardType,
      maxLength: props.maxLength,
      multiline: props.multiline,
      numberOfLines: props.numberOfLines,
      onBlur: props.onBlur
        ? (event) => {
            void event;
            props.onBlur?.();
          }
        : undefined,
      onFocus: props.onFocus
        ? (event) => {
            void event;
            props.onFocus?.();
          }
        : undefined,
      onSubmitEditing: props.onSubmitEditing
        ? (event) => {
            const submitHandler = props.onSubmitEditing as
              | ((value: unknown) => void)
              | undefined;
            submitHandler?.(event);
          }
        : undefined,
      placeholder: props.placeholder,
      returnKeyType: props.returnKeyType,
      secureTextEntry: props.secureTextEntry,
      selectTextOnFocus: props.selectTextOnFocus,
      testID: props.testID,
    };
    const fallbackInputStyle = StyleSheet.flatten([
      style as TextStyle | undefined,
      textStyle as TextStyle | undefined,
    ]);

    return (
      <View style={hostStyle}>
        <ReactNativeTextInput
          {...fallbackProps}
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          placeholderTextColor={placeholderTextColor ?? tc.muted}
          style={fallbackInputStyle}
        />
      </View>
    );
  }

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
