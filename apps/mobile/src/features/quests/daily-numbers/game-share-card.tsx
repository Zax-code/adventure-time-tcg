import type { ComponentProps } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { Text as NativeText, View } from "react-native";

import type { THEME_COLORS } from "../../../theme/themes";
import { asStyle } from "../../../lib/style-object";
import type { DailyNumbersQuestShareCardStrings } from "./quest-share-card";
import type { DailyNumbersShareResult } from "./share-result";

type ThemeColors = (typeof THEME_COLORS)[keyof typeof THEME_COLORS];

type DailyNumbersGameShareCardProps = {
  result: DailyNumbersShareResult;
  colors: ThemeColors;
  strings: DailyNumbersQuestShareCardStrings & {
    distanceLabel: string;
    scoreLabel: string;
  };
};

type ResultTone = {
  border: string;
  gradient: readonly [string, string];
  metricBackground: string;
  metricText: string;
  symbol: "=" | "≈" | "≠";
};

const CARD_WIDTH = 360;

function Text(props: ComponentProps<typeof NativeText>) {
  return <NativeText maxFontSizeMultiplier={1} {...props} />;
}

function getResultTone(
  result: DailyNumbersShareResult,
  colors: ThemeColors,
): ResultTone {
  if (result.exact) {
    return {
      border: colors.successBorder,
      gradient: [colors.successDark, colors.primaryStrong],
      metricBackground: colors.successTint,
      metricText: colors.successText,
      symbol: "=",
    };
  }

  if (result.completed) {
    return {
      border: colors.infoBorder,
      gradient: [colors.infoDark, colors.primaryStrong],
      metricBackground: colors.infoTint,
      metricText: colors.infoText,
      symbol: "≈",
    };
  }

  return {
    border: colors.dangerBorder,
    gradient: [colors.dangerDark, colors.primaryStrong],
    metricBackground: colors.dangerTint,
    metricText: colors.dangerText,
    symbol: "≠",
  };
}

export function DailyNumbersGameShareCard({
  result,
  colors,
  strings,
}: DailyNumbersGameShareCardProps) {
  const tone = getResultTone(result, colors);
  const score = result.score == null ? "—" : String(result.score);
  const finalValue =
    result.finalValue == null ? "—" : String(result.finalValue);
  const distance = result.distance == null ? "—" : String(result.distance);
  const date = strings.date ?? result.date;

  return (
    <View
      className="overflow-hidden"
      style={asStyle({
        width: CARD_WIDTH,
        backgroundColor: colors.bg,
        borderColor: colors.primaryBorder,
        borderCurve: "continuous",
        borderRadius: 34,
        borderWidth: 2,
      })}
    >
      <LinearGradient
        colors={[colors.primaryTint, colors.bg, colors.accentTint]}
        locations={[0, 0.52, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={asStyle({
          paddingHorizontal: 20,
          paddingTop: 20,
          paddingBottom: 24,
        })}
      >
        <View className="flex-row items-center justify-between gap-3">
          <LinearGradient
            colors={[colors.primaryStrong, colors.accentStrong]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={asStyle({
              borderCurve: "continuous",
              borderRadius: 999,
              flexShrink: 1,
              paddingHorizontal: 13,
              paddingVertical: 7,
            })}
          >
            <Text
              className="text-[10px] font-nunito-extrabold uppercase"
              style={{ color: "#ffffff", letterSpacing: 1.4 }}
            >
              {strings.brand}
            </Text>
          </LinearGradient>

          <View
            className="flex-row items-center gap-1.5 rounded-full border px-2.5 py-2"
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.primaryBorder,
            }}
          >
            {[colors.primary, colors.secondary, tone.metricText].map(
              (backgroundColor, index) => (
                <View
                  key={`${backgroundColor}-${index}`}
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor }}
                />
              ),
            )}
          </View>
        </View>

        <View className="pt-5">
          <Text
            className="font-nunito-extrabold text-[30px] leading-[34px]"
            style={{ color: colors.fg }}
          >
            {result.questTitle}
          </Text>

          <View className="flex-row flex-wrap items-center gap-2 pt-3">
            <View
              className="rounded-full border px-3 py-1.5"
              style={{
                backgroundColor: colors.surface,
                borderColor: colors.primaryBorder,
              }}
            >
              <Text
                className="font-nunito-extrabold text-[11px] uppercase"
                style={{ color: colors.primaryStrong, letterSpacing: 1 }}
              >
                {strings.modeLabel}
              </Text>
            </View>

            {result.archive ? (
              <View
                className="rounded-full border px-3 py-1.5"
                style={{
                  backgroundColor: colors.secondaryTint,
                  borderColor: colors.secondaryBorder,
                }}
              >
                <Text
                  className="font-nunito-extrabold text-[11px] uppercase"
                  style={{ color: colors.secondaryText, letterSpacing: 1 }}
                >
                  {strings.archiveLabel}
                </Text>
              </View>
            ) : null}

            {date ? (
              <Text
                className="font-nunito-bold text-[12px]"
                style={{ color: colors.fgMuted }}
              >
                {date}
              </Text>
            ) : null}
          </View>
        </View>

        <View
          className="mt-5 rounded-[29px] pb-1"
          style={{ backgroundColor: tone.border }}
        >
          <LinearGradient
            colors={[...tone.gradient]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={asStyle({
              borderCurve: "continuous",
              borderRadius: 28,
              minHeight: 196,
              overflow: "hidden",
              paddingHorizontal: 22,
              paddingVertical: 20,
            })}
          >
            <View
              className="absolute inset-0"
              style={{ backgroundColor: "rgba(0,0,0,0.32)" }}
            />
            <View
              className="absolute -right-7 -top-9 h-36 w-36 rounded-full border-[18px]"
              style={{ borderColor: "rgba(255,255,255,0.08)" }}
            />
            <View
              className="absolute -bottom-12 -left-10 h-32 w-32 rounded-full border-[14px]"
              style={{ borderColor: "rgba(255,255,255,0.07)" }}
            />

            <View className="max-w-full self-start rounded-full border border-white/25 bg-black/10 px-3.5 py-1.5">
              <Text
                className="font-nunito-extrabold text-[12px]"
                style={{ color: "#ffffff" }}
              >
                {strings.resultLine}
              </Text>
            </View>

            <View className="flex-1 flex-row items-end justify-between pt-2">
              <View>
                <Text
                  className="font-nunito-extrabold text-[10px] uppercase"
                  style={{
                    color: "rgba(255,255,255,0.72)",
                    letterSpacing: 1.5,
                  }}
                >
                  {strings.scoreLabel}
                </Text>
                <View className="flex-row items-end">
                  <Text
                    className="font-nunito-extrabold text-[76px] leading-[82px]"
                    style={{ color: "#ffffff", fontVariant: ["tabular-nums"] }}
                  >
                    {score}
                  </Text>
                  {result.score != null ? (
                    <Text
                      className="pb-2.5 font-nunito-extrabold text-[28px]"
                      style={{ color: "rgba(255,255,255,0.78)" }}
                    >
                      %
                    </Text>
                  ) : null}
                </View>
              </View>

              <View className="items-end pb-3">
                <View className="flex-row gap-1.5">
                  {["+", "×", "−"].map((operator) => (
                    <View
                      key={operator}
                      className="h-7 w-7 items-center justify-center rounded-lg border border-white/20 bg-black/10"
                    >
                      <Text
                        className="font-nunito-extrabold text-[14px]"
                        style={{ color: "rgba(255,255,255,0.82)" }}
                      >
                        {operator}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          </LinearGradient>
        </View>

        <View
          className="mt-4 rounded-[26px] border p-3"
          style={asStyle({
            backgroundColor: colors.surface,
            borderColor: colors.primaryBorder,
            borderCurve: "continuous",
          })}
        >
          <View className="flex-row items-stretch">
            <ResultValue
              label={strings.targetLabel}
              value={String(result.target)}
              colors={colors}
            />

            <View className="w-12 items-center justify-center">
              <View
                className="h-10 w-10 items-center justify-center rounded-full border"
                style={{
                  backgroundColor: tone.metricBackground,
                  borderColor: tone.border,
                }}
              >
                <Text
                  className="font-nunito-extrabold text-[20px]"
                  style={{ color: tone.metricText }}
                >
                  {tone.symbol}
                </Text>
              </View>
            </View>

            <ResultValue
              label={strings.resultValueLabel}
              value={finalValue}
              colors={colors}
              valueColor={tone.metricText}
            />
          </View>
        </View>

        <View className="mt-3 flex-row gap-3">
          <View
            className="flex-1 rounded-[22px] border px-4 py-3.5"
            style={asStyle({
              backgroundColor: tone.metricBackground,
              borderColor: tone.border,
              borderCurve: "continuous",
            })}
          >
            <Text
              className="font-nunito-extrabold text-[10px] uppercase"
              style={{ color: tone.metricText, letterSpacing: 1.5 }}
            >
              {strings.distanceLabel}
            </Text>
            <Text
              className="pt-0.5 font-nunito-extrabold text-[28px] leading-[32px]"
              style={{ color: tone.metricText, fontVariant: ["tabular-nums"] }}
            >
              {distance}
            </Text>
          </View>

          <View
            className="flex-1 rounded-[22px] border px-4 py-3.5"
            style={asStyle({
              backgroundColor: colors.surface,
              borderColor: colors.primaryBorder,
              borderCurve: "continuous",
            })}
          >
            <Text
              className="font-nunito-extrabold text-[10px] uppercase"
              style={{ color: colors.fgMuted, letterSpacing: 1.5 }}
            >
              {strings.timeLabel}
            </Text>
            <Text
              className="pt-0.5 font-nunito-extrabold text-[28px] leading-[32px]"
              style={{ color: colors.fg, fontVariant: ["tabular-nums"] }}
            >
              {result.elapsedTime}
            </Text>
          </View>
        </View>

        <View className="flex-row items-center gap-3 pt-5">
          <View
            className="h-px flex-1"
            style={{ backgroundColor: colors.primaryBorder }}
          />
          <Text
            className="font-nunito-extrabold text-[10px] uppercase"
            style={{ color: colors.fgMuted, letterSpacing: 1.6 }}
          >
            {strings.footer}
          </Text>
          <View
            className="h-px flex-1"
            style={{ backgroundColor: colors.primaryBorder }}
          />
        </View>
      </LinearGradient>
    </View>
  );
}

type ResultValueProps = {
  label: string;
  value: string;
  colors: ThemeColors;
  valueColor?: string;
};

function ResultValue({
  label,
  value,
  colors,
  valueColor = colors.fg,
}: ResultValueProps) {
  return (
    <View className="min-w-0 flex-1 items-center justify-center px-1 py-2">
      <Text
        className="text-center font-nunito-extrabold text-[10px] uppercase"
        style={{ color: colors.fgMuted, letterSpacing: 1.25 }}
      >
        {label}
      </Text>
      <Text
        className="pt-1 text-center font-nunito-extrabold text-[36px] leading-[40px]"
        style={{ color: valueColor, fontVariant: ["tabular-nums"] }}
      >
        {value}
      </Text>
    </View>
  );
}
