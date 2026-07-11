import { Children, type ReactNode } from "react";
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
  const childCount = Children.count(children);

  return (
    <View
      style={{
        width: childCount <= 1 ? 396 : 772,
        backgroundColor: colors.primaryBg,
        padding: 18,
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "center",
        alignItems: "flex-start",
        gap: 16,
      }}
    >
      {children}
    </View>
  );
}
