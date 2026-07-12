import type { ComponentProps } from "react";
import { Text as NativeText, View } from "react-native";

import type { THEME_COLORS } from "../../../theme/themes";
import type { DailyNumbersQuestShareCardStrings } from "./quest-share-card";
import type { DailyNumbersShareResult } from "./share-result";
import {
  DailyNumbersTargetPal,
  type DailyNumbersTargetPalMood,
} from "./target-pal";

type ThemeColors = (typeof THEME_COLORS)[keyof typeof THEME_COLORS];

type DailyNumbersGameShareCardProps = {
  result: DailyNumbersShareResult;
  colors: ThemeColors;
  strings: DailyNumbersQuestShareCardStrings & {
    outcomeLabel: string;
    quip: string;
    scoreLabel: string;
  };
};

const CARD_WIDTH = 360;

function Text(props: ComponentProps<typeof NativeText>) {
  return <NativeText maxFontSizeMultiplier={1} {...props} />;
}

function getMascotMood(
  result: DailyNumbersShareResult,
): DailyNumbersTargetPalMood {
  if (result.exact) return "caught";
  if (result.completed) return "nervous";
  return "escaped";
}

export function DailyNumbersGameShareCard({
  result,
  colors,
  strings,
}: DailyNumbersGameShareCardProps) {
  const date = strings.date ?? result.date;
  const context = [
    strings.modeLabel,
    result.archive ? strings.archiveLabel : null,
    date,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" · ");
  const finalValue =
    result.finalValue == null ? "—" : String(result.finalValue);
  const score = result.score == null ? "—" : `${result.score}%`;
  const outcomeColor = result.exact ? colors.successText : colors.primaryText;

  return (
    <View
      style={{
        backgroundColor: colors.bg,
        paddingBottom: 25,
        paddingHorizontal: 24,
        paddingTop: 24,
        width: CARD_WIDTH,
      }}
    >
      <Text
        className="font-nunito-extrabold text-[10px] uppercase"
        style={{ color: colors.primaryText, letterSpacing: 1.5 }}
      >
        {strings.brand}
      </Text>

      <Text
        className="pt-1 font-nunito-extrabold text-[25px] leading-[29px]"
        style={{ color: colors.fg }}
      >
        {result.questTitle}
      </Text>

      <Text
        className="pt-0.5 font-nunito-bold text-[11px] leading-4"
        style={{ color: colors.fgMuted }}
      >
        {context}
      </Text>

      <View className="min-h-[156px] pt-7">
        <View className="max-w-[226px]">
          <Text
            className="font-nunito-extrabold text-[50px] leading-[50px]"
            numberOfLines={2}
            style={{ color: outcomeColor }}
          >
            {strings.outcomeLabel}
          </Text>
        </View>

        <View
          style={{
            position: "absolute",
            right: -18,
            top: 14,
            transform: [{ rotate: "8deg" }],
          }}
        >
          <DailyNumbersTargetPal
            colors={colors}
            mood={getMascotMood(result)}
            value={result.target}
            width={116}
          />
        </View>
      </View>

      <Text
        className="max-w-[292px] font-nunito-extrabold text-[17px] leading-[22px]"
        style={{ color: colors.primaryText }}
      >
        {strings.quip}
      </Text>

      <View className="pt-6">
        <Text
          className="font-nunito-extrabold text-[10px] uppercase"
          style={{ color: colors.fgMuted, letterSpacing: 1.35 }}
        >
          {strings.timeLabel}
        </Text>
        <Text
          className="font-nunito-extrabold text-[32px] leading-[35px]"
          style={{ color: colors.fg, fontVariant: ["tabular-nums"] }}
        >
          {result.elapsedTime}
        </Text>
      </View>

      <Text
        className="pt-5 font-nunito-extrabold text-[15px] leading-5"
        style={{ color: colors.fg }}
      >
        {strings.resultValueLabel} {finalValue} {result.exact ? "=" : "→"}{" "}
        {strings.targetLabel} {result.target}
      </Text>

      <View className="flex-row items-end justify-between gap-4 pt-7">
        <View className="min-w-0 flex-1">
          <Text
            className="font-nunito-extrabold text-[9px] uppercase"
            style={{ color: colors.fgMuted, letterSpacing: 1.3 }}
          >
            {strings.scoreLabel}
          </Text>
          <Text
            className="font-nunito-extrabold text-[15px] leading-5"
            style={{ color: colors.fgMuted, fontVariant: ["tabular-nums"] }}
          >
            {score}
          </Text>
        </View>

        <Text
          className="max-w-[170px] text-right font-nunito-bold text-[9px] uppercase leading-[14px]"
          style={{ color: colors.fgMuted, letterSpacing: 1.15 }}
        >
          {strings.footer}
        </Text>
      </View>
    </View>
  );
}
