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
  correctLabel: string;
  errorsLabel: string;
  summary: (
    correctAnswers: number,
    totalAnswers: number,
    accuracyPercentage: number,
  ) => string;
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

      <View style={{ width: "100%", gap: 18 }}>
        {result.runs.map((run, index) => (
          <View key={run.runNumber} style={{ gap: 9 }}>
            <View style={{ gap: 9 }}>
              <Text
                className="text-[14px] font-nunito-extrabold"
                style={{ color: colors.primaryStrong }}
              >
                {strings.runLabel(run.runNumber)}
              </Text>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <ResultMetric
                  label={strings.correctLabel}
                  value={String(run.correctAnswers)}
                  backgroundColor={colors.successTint}
                  borderColor={colors.successBorder}
                  textColor={colors.successText}
                />
                <ResultMetric
                  label={strings.errorsLabel}
                  value={String(run.errorAnswers)}
                  backgroundColor={colors.dangerTint}
                  borderColor={colors.dangerBorder}
                  textColor={colors.dangerText}
                />
              </View>
              <View
                style={asStyle({
                  borderRadius: 999,
                  backgroundColor: colors.primaryTint,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                })}
              >
                <Text
                  className="text-center text-[15px] font-nunito-extrabold"
                  style={{ color: colors.primaryStrong }}
                >
                  {strings.summary(
                    run.correctAnswers,
                    run.totalAnswers,
                    run.accuracyPercentage,
                  )}
                </Text>
              </View>
            </View>
            {index < result.runs.length - 1 ? (
              <View
                style={{ height: 2, backgroundColor: colors.primaryTint }}
              />
            ) : null}
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
  backgroundColor,
  borderColor,
  label,
  textColor,
  value,
}: {
  backgroundColor: string;
  borderColor: string;
  label: string;
  textColor: string;
  value: string;
}) {
  return (
    <View
      style={asStyle({
        minWidth: 0,
        flex: 1,
        alignItems: "center",
        borderRadius: 18,
        borderWidth: 2,
        borderColor,
        backgroundColor,
        paddingHorizontal: 8,
        paddingVertical: 13,
        gap: 4,
      })}
    >
      <Text
        className="text-center text-[9px] font-nunito-bold uppercase"
        style={{ color: textColor, letterSpacing: 0.7 }}
      >
        {label}
      </Text>
      <Text
        className="text-center text-[27px] font-nunito-extrabold"
        style={{ color: textColor }}
      >
        {value}
      </Text>
    </View>
  );
}
