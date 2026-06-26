import { Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import type { THEME_COLORS } from "../../../theme/themes";
import type { DailyNumbersShareResult } from "./share-result";

type ThemeColors = (typeof THEME_COLORS)[keyof typeof THEME_COLORS];

export type DailyNumbersQuestShareCardStrings = {
  brand: string;
  modeLabel: string;
  resultLine: string;
  targetLabel: string;
  resultValueLabel: string;
  distanceLabel: string;
  scoreLabel: string;
  footer: string;
  date?: string;
};

type DailyNumbersQuestShareCardProps = {
  result: DailyNumbersShareResult;
  colors: ThemeColors;
  strings: DailyNumbersQuestShareCardStrings;
};

const CARD_WIDTH = 360;

export function DailyNumbersQuestShareCard({
  result,
  colors,
  strings,
}: DailyNumbersQuestShareCardProps) {
  const success = result.exact || result.completed;
  const resultPillBg = success ? colors.successTint : colors.dangerTint;
  const resultPillText = success ? colors.successText : colors.dangerText;

  return (
    <View
      style={{
        width: CARD_WIDTH,
        backgroundColor: colors.bg,
        borderRadius: 28,
        borderWidth: 2,
        borderColor: colors.primaryTint,
        paddingHorizontal: 24,
        paddingVertical: 28,
        alignItems: "center",
        gap: 18,
      }}
    >
      {/* Brand badge */}
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

      {/* Title + date */}
      <View style={{ alignItems: "center", gap: 4 }}>
        <Text
          className="text-[24px] font-nunito-extrabold text-center"
          style={{ color: colors.primaryStrong }}
        >
          {result.questTitle}
        </Text>
        {strings.date ? (
          <Text
            className="text-[13px] font-nunito-bold text-center"
            style={{ color: colors.fgMuted }}
          >
            {strings.date}
          </Text>
        ) : null}
      </View>

      {/* Mode pill */}
      <View
        style={{
          backgroundColor: colors.primaryTint,
          borderRadius: 999,
          paddingHorizontal: 14,
          paddingVertical: 6,
        }}
      >
        <Text
          className="text-[12px] font-nunito-extrabold uppercase text-center"
          style={{ color: colors.primaryStrong, letterSpacing: 1 }}
        >
          {strings.modeLabel}
        </Text>
      </View>

      {/* Result line */}
      <View
        style={{
          backgroundColor: resultPillBg,
          borderRadius: 999,
          paddingHorizontal: 18,
          paddingVertical: 8,
        }}
      >
        <Text
          className="text-[15px] font-nunito-extrabold text-center"
          style={{ color: resultPillText }}
        >
          {strings.resultLine}
        </Text>
      </View>

      {/* Target + player result */}
      <View style={{ flexDirection: "row", gap: 12, width: "100%" }}>
        <View
          style={{
            flex: 1,
            backgroundColor: colors.surface,
            borderRadius: 18,
            borderWidth: 2,
            borderColor: colors.primaryTint,
            paddingVertical: 14,
            alignItems: "center",
            gap: 4,
          }}
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
            {result.target}
          </Text>
        </View>
        <View
          style={{
            flex: 1,
            backgroundColor: colors.surface,
            borderRadius: 18,
            borderWidth: 2,
            borderColor: success ? colors.successBorder : colors.primaryTint,
            paddingVertical: 14,
            alignItems: "center",
            gap: 4,
          }}
        >
          <Text
            className="text-[10px] font-nunito-bold uppercase"
            style={{ color: colors.fgMuted, letterSpacing: 1 }}
          >
            {strings.resultValueLabel}
          </Text>
          <Text
            className="text-[28px] font-nunito-extrabold"
            style={{ color: success ? colors.successText : colors.fg }}
          >
            {result.finalValue ?? "—"}
          </Text>
        </View>
      </View>

      {/* Distance + score stats */}
      <View style={{ flexDirection: "row", gap: 12, width: "100%" }}>
        <View
          style={{
            flex: 1,
            backgroundColor: colors.surface,
            borderRadius: 18,
            borderWidth: 2,
            borderColor: colors.primaryTint,
            paddingVertical: 12,
            alignItems: "center",
            gap: 2,
          }}
        >
          <Text
            className="text-[10px] font-nunito-bold uppercase"
            style={{ color: colors.fgMuted, letterSpacing: 1 }}
          >
            {strings.distanceLabel}
          </Text>
          <Text
            className="text-[22px] font-nunito-extrabold"
            style={{ color: colors.fg }}
          >
            {result.distance ?? "—"}
          </Text>
        </View>
        <View
          style={{
            flex: 1,
            backgroundColor: colors.surface,
            borderRadius: 18,
            borderWidth: 2,
            borderColor: colors.primaryTint,
            paddingVertical: 12,
            alignItems: "center",
            gap: 2,
          }}
        >
          <Text
            className="text-[10px] font-nunito-bold uppercase"
            style={{ color: colors.fgMuted, letterSpacing: 1 }}
          >
            {strings.scoreLabel}
          </Text>
          <Text
            className="text-[22px] font-nunito-extrabold"
            style={{ color: colors.fg }}
          >
            {result.score != null ? `${result.score}%` : "—"}
          </Text>
        </View>
      </View>

      {/* Footer */}
      <Text
        className="text-[11px] font-nunito-bold uppercase"
        style={{ color: colors.fgMuted, letterSpacing: 1.5 }}
      >
        {strings.footer}
      </Text>
    </View>
  );
}
