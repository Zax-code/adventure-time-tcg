import { Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import type { THEME_COLORS } from "../../../theme/themes";
import type { DailyNumbersShareResult } from "./share-result";
import { asStyle } from "../../../lib/style-object";

type ThemeColors = (typeof THEME_COLORS)[keyof typeof THEME_COLORS];

export type DailyNumbersQuestShareCardStrings = {
  brand: string;
  modeLabel: string;
  resultLine: string;
  targetLabel: string;
  resultValueLabel: string;
  timeLabel: string;
  footer: string;
  archiveLabel: string;
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
  // Only an exact hit earns the celebratory success tone. A close (but not
  // exact) reward-unlocked result uses a distinct "info" tone so it never reads
  // as a perfect solve, and a missed result uses the danger tone.
  const tone = result.exact
    ? {
        pillBg: colors.successTint,
        pillText: colors.successText,
        valueBorder: colors.successBorder,
        valueText: colors.successText,
      }
    : result.completed
      ? {
          pillBg: colors.infoTint,
          pillText: colors.infoText,
          valueBorder: colors.infoBorder,
          valueText: colors.infoText,
        }
      : {
          pillBg: colors.dangerTint,
          pillText: colors.dangerText,
          valueBorder: colors.primaryTint,
          valueText: colors.fg,
        };
  return (
    <View
      style={asStyle({
        width: CARD_WIDTH,
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

      {/* Mode + archive pills */}
      <View
        style={{
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        }}
      >
        {result.archive ? (
          <View
            style={{
              backgroundColor: colors.secondaryDark,
              borderColor: colors.secondaryBorder,
              borderRadius: 999,
              borderWidth: 1,
              paddingHorizontal: 14,
              paddingVertical: 6,
            }}
          >
            <Text
              className="text-[12px] font-nunito-extrabold uppercase text-center"
              style={{ color: colors.secondaryText, letterSpacing: 1 }}
            >
              {strings.archiveLabel}
            </Text>
          </View>
        ) : null}
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
      </View>

      {/* Result line */}
      <View
        style={{
          backgroundColor: tone.pillBg,
          borderRadius: 999,
          paddingHorizontal: 18,
          paddingVertical: 8,
        }}
      >
        <Text
          className="text-[15px] font-nunito-extrabold text-center"
          style={{ color: tone.pillText }}
        >
          {strings.resultLine}
        </Text>
      </View>

      {/* Target + player result */}
      <View style={{ flexDirection: "row", gap: 12, width: "100%" }}>
        <View
          style={asStyle({
            flex: 1,
            backgroundColor: colors.surface,
            borderRadius: 18,
            borderWidth: 2,
            borderColor: colors.primaryTint,
            paddingVertical: 14,
            alignItems: "center",
            gap: 4,
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
            {result.target}
          </Text>
        </View>
        <View
          style={asStyle({
            flex: 1,
            backgroundColor: colors.surface,
            borderRadius: 18,
            borderWidth: 2,
            borderColor: tone.valueBorder,
            paddingVertical: 14,
            alignItems: "center",
            gap: 4,
          })}
        >
          <Text
            className="text-[10px] font-nunito-bold uppercase"
            style={{ color: colors.fgMuted, letterSpacing: 1 }}
          >
            {strings.resultValueLabel}
          </Text>
          <Text
            className="text-[28px] font-nunito-extrabold"
            style={{ color: tone.valueText }}
          >
            {result.finalValue ?? "—"}
          </Text>
        </View>
      </View>

      {/* Solve time */}
      <View
        style={asStyle({
          width: "100%",
          backgroundColor: colors.surface,
          borderRadius: 18,
          borderWidth: 2,
          borderColor: colors.primaryTint,
          paddingVertical: 12,
          alignItems: "center",
          gap: 2,
        })}
      >
        <Text
          className="text-[10px] font-nunito-bold uppercase"
          style={{ color: colors.fgMuted, letterSpacing: 1 }}
        >
          {strings.timeLabel}
        </Text>
        <Text
          className="text-[22px] font-nunito-extrabold"
          style={{ color: colors.fg }}
        >
          {result.elapsedTime}
        </Text>
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
