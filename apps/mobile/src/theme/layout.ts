import { useSafeAreaInsets } from "react-native-safe-area-context";

export const APP_HEADER_CHROME_HEIGHT = 56;
export const BOTTOM_TAB_BAR_OVERLAY_HEIGHT = 68;
export const BOTTOM_TAB_BAR_CONTENT_GAP = 18;

export function useAppHeaderHeight() {
  const { top } = useSafeAreaInsets();

  return top + APP_HEADER_CHROME_HEIGHT;
}

export function useBottomTabBarContentPadding() {
  const { bottom } = useSafeAreaInsets();

  return bottom + BOTTOM_TAB_BAR_OVERLAY_HEIGHT + BOTTOM_TAB_BAR_CONTENT_GAP;
}
