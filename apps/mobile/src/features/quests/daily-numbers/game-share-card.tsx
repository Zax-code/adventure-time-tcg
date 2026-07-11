import type { ComponentProps } from "react";
import { Text as NativeText, View } from "react-native";

import type { THEME_COLORS } from "../../../theme/themes";
import type { DailyNumbersQuestShareCardStrings } from "./quest-share-card";
import type { DailyNumbersShareResult } from "./share-result";

type ThemeColors = (typeof THEME_COLORS)[keyof typeof THEME_COLORS];

type DailyNumbersGameShareCardProps = {
  result: DailyNumbersShareResult;
  colors: ThemeColors;
  strings: DailyNumbersQuestShareCardStrings & {
    outcomeLabel: string;
    scoreLabel: string;
  };
};

const CARD_WIDTH = 360;

function Text(props: ComponentProps<typeof NativeText>) {
  return <NativeText maxFontSizeMultiplier={1} {...props} />;
}

function Divider({ color }: { color: string }) {
  return (
    <View
      className="h-px w-full"
      style={{ backgroundColor: color, opacity: 0.28 }}
    />
  );
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
  const outcomeColor = result.exact
    ? colors.successText
    : result.completed
      ? colors.fg
      : colors.dangerText;

  return (
    <View
      style={{
        width: CARD_WIDTH,
        backgroundColor: colors.bg,
        paddingHorizontal: 26,
        paddingBottom: 28,
        paddingTop: 26,
      }}
    >
      <Text
        className="font-nunito-extrabold text-[10px] uppercase"
        style={{ color: colors.fg, letterSpacing: 1.5 }}
      >
        {strings.brand}
      </Text>

      <Text
        className="pt-2 font-nunito-extrabold text-[30px] leading-[34px]"
        style={{ color: colors.fg }}
      >
        {result.questTitle}
      </Text>

      <Text
        className="pt-1 font-nunito-bold text-[12px] leading-[18px]"
        style={{ color: colors.fgMuted }}
      >
        {context}
      </Text>

      <View className="py-5">
        <Divider color={colors.fgMuted} />
      </View>

      <View
        className="rounded-[22px] px-5 py-6"
        style={{ backgroundColor: colors.surface }}
      >
        <Text
          className="font-nunito-extrabold text-[42px] leading-[46px]"
          style={{ color: outcomeColor }}
        >
          {strings.outcomeLabel}
        </Text>

        <View className="pt-5">
          <Text
            className="font-nunito-extrabold text-[10px] uppercase"
            style={{ color: colors.fgMuted, letterSpacing: 1.4 }}
          >
            {strings.timeLabel}
          </Text>
          <Text
            className="pt-0.5 font-nunito-extrabold text-[32px] leading-[36px]"
            style={{ color: colors.fg, fontVariant: ["tabular-nums"] }}
          >
            {result.elapsedTime}
          </Text>
        </View>

        <View className="py-5">
          <Divider color={colors.fgMuted} />
        </View>

        <Text
          className="font-nunito-bold text-[14px] leading-5"
          style={{ color: colors.fgMuted }}
        >
          {strings.resultValueLabel}: {finalValue} · {strings.targetLabel}:{" "}
          {result.target}
        </Text>
      </View>

      <View className="flex-row items-end justify-between gap-4 pt-5">
        <View className="min-w-0 flex-1">
          <Text
            className="font-nunito-extrabold text-[10px] uppercase"
            style={{ color: colors.fgMuted, letterSpacing: 1.3 }}
          >
            {strings.scoreLabel}
          </Text>
          <Text
            className="pt-0.5 font-nunito-extrabold text-[18px] leading-6"
            style={{ color: colors.fg, fontVariant: ["tabular-nums"] }}
          >
            {score}
          </Text>
        </View>

        <Text
          className="max-w-[170px] text-right font-nunito-bold text-[10px] uppercase leading-4"
          style={{ color: colors.fgMuted, letterSpacing: 1.2 }}
        >
          {strings.footer}
        </Text>
      </View>
    </View>
  );
}
