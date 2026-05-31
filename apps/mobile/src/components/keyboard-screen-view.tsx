import { useEffect, useState, type PropsWithChildren } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  type KeyboardAvoidingViewProps,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";

const KEYBOARD_AVOIDING_BEHAVIOR = Platform.select<
  KeyboardAvoidingViewProps["behavior"]
>({
  ios: "padding",
  android: "height",
  default: undefined,
});

export const KEYBOARD_AWARE_SCROLL_PROPS: Pick<
  ScrollViewProps,
  | "automaticallyAdjustKeyboardInsets"
  | "keyboardDismissMode"
  | "keyboardShouldPersistTaps"
> = {
  automaticallyAdjustKeyboardInsets: Platform.OS === "ios",
  keyboardDismissMode: Platform.OS === "ios" ? "interactive" : "on-drag",
  keyboardShouldPersistTaps: "handled",
};

export function KeyboardScreenView({
  children,
  keyboardVerticalOffset = 0,
  style,
}: PropsWithChildren<{
  keyboardVerticalOffset?: number;
  style?: StyleProp<ViewStyle>;
}>) {
  return (
    <KeyboardAvoidingView
      behavior={KEYBOARD_AVOIDING_BEHAVIOR}
      keyboardVerticalOffset={keyboardVerticalOffset}
      style={[{ flex: 1 }, style]}
    >
      {children}
    </KeyboardAvoidingView>
  );
}

export function useKeyboardVisibility() {
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSubscription = Keyboard.addListener(showEvent, () => {
      setKeyboardVisible(true);
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  return keyboardVisible;
}
