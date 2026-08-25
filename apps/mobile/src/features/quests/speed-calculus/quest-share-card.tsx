import { LinearGradient } from "expo-linear-gradient";
import { Text, View } from "react-native";

import type { THEME_COLORS } from "../../../theme/themes";
import { asStyle } from "../../../lib/style-object";
import type { SpeedCalculusShareResult } from "./share-result";

type ThemeColors = (typeof THEME_COLORS)[keyof typeof THEME_COLORS];

export type SpeedCalculusQuestShareCardStrings = {
  brand: string;
  date?: string;
  runLabel: (runNumber: number) => string;
  correctTotalLabel: string;
  accuracyLabel: string;
  scoreLabel: string;
  footer: string;
};

export function SpeedCalculusQuestShareCard({
  colors,
  result,
  strings,
}: {
  colors: ThemeColors;
  result: SpeedCalculusShareResult;
  strings: SpeedCalculusQuestShareCardStrings;
}) {
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

      <View style={{ width: "100%", gap: 10 }}>
        {result.runs.map((run) => (
          <View
            key={run.runNumber}
            style={asStyle({
              borderRadius: 18,
              borderWidth: 2,
              borderColor: colors.primaryTint,
              backgroundColor: colors.surface,
              paddingHorizontal: 14,
              paddingVertical: 13,
              gap: 10,
            })}
          >
            <Text
              className="text-[14px] font-nunito-extrabold"
              style={{ color: colors.primaryStrong }}
            >
              {strings.runLabel(run.runNumber)}
            </Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <ResultMetric
                label={strings.correctTotalLabel}
                value={`${run.correctAnswers} / ${run.totalAnswers}`}
                colors={colors}
              />
              <ResultMetric
                label={strings.accuracyLabel}
                value={`${run.accuracyPercentage}%`}
                colors={colors}
              />
              <ResultMetric
                label={strings.scoreLabel}
                value={String(run.score)}
                colors={colors}
              />
            </View>
          </View>
        ))}
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

function ResultMetric({
  colors,
  label,
  value,
}: {
  colors: ThemeColors;
  label: string;
  value: string;
}) {
  return (
    <View
      style={asStyle({
        minWidth: 0,
        flex: 1,
        alignItems: "center",
        borderRadius: 12,
        backgroundColor: colors.primaryTint,
        paddingHorizontal: 4,
        paddingVertical: 8,
        gap: 2,
      })}
    >
      <Text
        className="text-center text-[9px] font-nunito-bold uppercase"
        style={{ color: colors.fgMuted, letterSpacing: 0.4 }}
      >
        {label}
      </Text>
      <Text
        className="text-center text-[17px] font-nunito-extrabold"
        style={{ color: colors.fg }}
      >
        {value}
      </Text>
    </View>
  );
}
