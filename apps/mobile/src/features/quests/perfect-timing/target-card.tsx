import type { ReactNode } from "react";
import { Text, View } from "react-native";

import { Card } from "../../../components/ui/card";
import type { Locale } from "../../../i18n/types";
import { formatPerfectTimingMilliseconds } from "./model";

// Tinted Card: overline, the big target value, then the panel's stats and
// start action.
export function TargetCard({
  label,
  targetMs,
  locale,
  children,
}: {
  label: string;
  targetMs: number;
  locale: Locale;
  children?: ReactNode;
}) {
  return (
    <Card tone="primary" testID="perfect-timing-target-card">
      <View className="items-center">
        <Text className="font-nunito-bold text-ds-overline uppercase tracking-[1px] text-primaryText">
          {label}
        </Text>
        <Text
          className="font-nunito-extrabold text-[48px] leading-[53px] text-primaryText"
          style={{ fontVariant: ["tabular-nums"] }}
          testID="perfect-timing-target"
        >
          {formatPerfectTimingMilliseconds(targetMs, locale)}
        </Text>
      </View>
      {children}
    </Card>
  );
}
