import type { RefObject } from "react";
import { View } from "react-native";

import {
  PerfectTimingQuestShareCard,
  type PerfectTimingQuestShareCardStrings,
} from "./quest-share-card";
import type { PerfectTimingShareResult } from "./share-result";
import type { ThemeColors } from "./types";

export function OffscreenShareCard({
  cardRef,
  colors,
  result,
  strings,
}: {
  cardRef: RefObject<View | null>;
  colors: ThemeColors;
  result: PerfectTimingShareResult;
  strings: PerfectTimingQuestShareCardStrings;
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
        <PerfectTimingQuestShareCard
          colors={colors}
          result={result}
          strings={strings}
        />
      </View>
    </View>
  );
}
