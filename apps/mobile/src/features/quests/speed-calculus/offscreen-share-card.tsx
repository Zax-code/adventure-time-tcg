import type { RefObject } from "react";
import { View } from "react-native";

import type { THEME_COLORS } from "../../../theme/themes";
import {
  SpeedCalculusQuestShareCard,
  type SpeedCalculusQuestShareCardStrings,
} from "./quest-share-card";
import type { SpeedCalculusShareResult } from "./share-result";

type ThemeColors = (typeof THEME_COLORS)[keyof typeof THEME_COLORS];

export function SpeedCalculusOffscreenShareCard({
  cardRef,
  colors,
  result,
  strings,
}: {
  cardRef: RefObject<View | null>;
  colors: ThemeColors;
  result: SpeedCalculusShareResult;
  strings: SpeedCalculusQuestShareCardStrings;
}) {
  return (
    <View
      accessibilityElementsHidden
      pointerEvents="none"
      collapsable={false}
      importantForAccessibility="no-hide-descendants"
      style={{ position: "absolute", left: -9999, top: 0 }}
    >
      <View ref={cardRef} collapsable={false}>
        <SpeedCalculusQuestShareCard
          colors={colors}
          result={result}
          strings={strings}
        />
      </View>
    </View>
  );
}
