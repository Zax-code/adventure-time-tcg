import { Platform, type ScrollViewProps } from "react-native";

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
