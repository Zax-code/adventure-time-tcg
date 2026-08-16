import { Text, View } from "react-native";

import type { Locale } from "../../../i18n/types";
import { formatPerfectTimingMilliseconds } from "./model";

export function TargetCard({
  label,
  targetMs,
  locale,
}: {
  label: string;
  targetMs: number;
  locale: Locale;
}) {
  return (
    <View
      className="items-center gap-2 rounded-3xl border-2 border-primaryBorder bg-primaryTint px-5 py-6"
      testID="perfect-timing-target-card"
    >
      <Text className="font-nunito-bold text-xs uppercase tracking-widest text-primaryText">
        {label}
      </Text>
      <Text
        className="font-nunito-extrabold text-[40px] leading-[48px] text-primaryStrong"
        style={{ fontVariant: ["tabular-nums"] }}
        testID="perfect-timing-target"
      >
        {formatPerfectTimingMilliseconds(targetMs, locale)}
      </Text>
    </View>
  );
}
