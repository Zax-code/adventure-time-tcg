import { LinearGradient } from "expo-linear-gradient";
import { Text, View } from "react-native";

import type { THEME_COLORS } from "../../../theme/themes";
import type { PerfectTimingShareResult } from "./share-result";
import { asStyle } from "../../../lib/style-object";

type ThemeColors = (typeof THEME_COLORS)[keyof typeof THEME_COLORS];

export type PerfectTimingQuestShareCardStrings = {
  brand: string;
  date?: string;
  targetLabel: string;
  targetValue: string;
  attemptLabels: [string, string, string];
  attemptValues: [string, string, string];
  finalTierLabel: string;
  finalTier: string;
  finalized: string;
  unused: string;
  footer: string;
};

export function PerfectTimingQuestShareCard({
  colors,
  result,
  strings,
}: {
  colors: ThemeColors;
  result: PerfectTimingShareResult;
  strings: PerfectTimingQuestShareCardStrings;
}) {
  const successful = result.finalTier !== "miss";
  const resultTone = successful
    ? {
        background: colors.successTint,
        border: colors.successBorder,
        text: colors.successText,
      }
    : {
        background: colors.dangerTint,
        border: colors.dangerBorder,
        text: colors.dangerText,
      };

  return (
    <View
      style={asStyle({
        width: 360,
        backgroundColor: colors.bg,
        borderRadius: 28,
        borderWidth: 2,
        borderColor: colors.primaryTint,
        paddingHorizontal: 24,
        paddingVertical: 28,
        alignItems: "center",
        gap: 18,
      })}
    >
      <LinearGradient
        colors={[colors.primary, colors.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{
          paddingHorizontal: 16,
          paddingVertical: 7,
          borderRadius: 999,
        }}
      >
        <Text
          className="text-[11px] font-nunito-extrabold uppercase"
          style={{ color: "#ffffff", letterSpacing: 1.5 }}
        >
          {strings.brand}
        </Text>
      </LinearGradient>

      <View style={{ alignItems: "center", gap: 4 }}>
        <Text
          className="text-center text-[24px] font-nunito-extrabold"
          style={{ color: colors.primaryStrong }}
        >
          {result.questTitle}
        </Text>
        {strings.date ? (
          <Text
            className="text-center text-[13px] font-nunito-bold"
            style={{ color: colors.fgMuted }}
          >
            {strings.date}
          </Text>
        ) : null}
      </View>

      <View
        style={asStyle({
          width: "100%",
          alignItems: "center",
          gap: 3,
          borderRadius: 18,
          borderWidth: 2,
          borderColor: colors.primaryTint,
          backgroundColor: colors.surface,
          paddingVertical: 12,
        })}
      >
        <Text
          className="text-[10px] font-nunito-bold uppercase"
          style={{ color: colors.fgMuted, letterSpacing: 1 }}
        >
          {strings.targetLabel}
        </Text>
        <Text
          className="text-[28px] font-nunito-extrabold"
          style={{ color: colors.fg }}
        >
          {strings.targetValue}
        </Text>
      </View>

      <View style={{ width: "100%", gap: 8 }}>
        {result.attempts.map((attempt, index) => {
          const isFinalized = attempt.finalized;
          return (
            <View
              key={attempt.attemptNumber}
              style={asStyle({
                minHeight: 48,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                borderRadius: 14,
                borderWidth: isFinalized ? 2 : 1,
                borderColor: isFinalized ? resultTone.border : colors.primaryTint,
                backgroundColor: isFinalized
                  ? resultTone.background
                  : colors.surface,
                paddingHorizontal: 14,
              })}
            >
              <Text
                className="text-[13px] font-nunito-bold"
                style={{ color: isFinalized ? resultTone.text : colors.fgMuted }}
              >
                {strings.attemptLabels[index]}
                {isFinalized ? ` · ${strings.finalized}` : ""}
              </Text>
              <Text
                className="text-[15px] font-nunito-extrabold"
                style={{ color: isFinalized ? resultTone.text : colors.fg }}
              >
                {attempt.unused ? strings.unused : strings.attemptValues[index]}
              </Text>
            </View>
          );
        })}
      </View>

      <View
        style={{
          borderRadius: 999,
          backgroundColor: resultTone.background,
          paddingHorizontal: 18,
          paddingVertical: 8,
        }}
      >
        <Text
          className="text-center text-[15px] font-nunito-extrabold"
          style={{ color: resultTone.text }}
        >
          {strings.finalTierLabel}: {strings.finalTier}
        </Text>
      </View>

      <Text
        className="text-[11px] font-nunito-bold uppercase"
        style={{ color: colors.fgMuted, letterSpacing: 1.5 }}
      >
        {strings.footer}
      </Text>
    </View>
  );
}
