import type { ReactNode } from "react";
import { View } from "react-native";

import type { THEME_COLORS } from "../../theme/themes";

type ThemeColors = (typeof THEME_COLORS)[keyof typeof THEME_COLORS];

type GroupedQuestShareImageProps = {
  children: ReactNode;
  colors: ThemeColors;
};

export function GroupedQuestShareImage({
  children,
  colors,
}: GroupedQuestShareImageProps) {
  return (
    <View
      style={{
        backgroundColor: colors.primaryBg,
        padding: 18,
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 16,
      }}
    >
      {children}
    </View>
  );
}
