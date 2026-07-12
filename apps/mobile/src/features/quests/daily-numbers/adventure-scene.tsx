import type { ReactNode } from "react";
import { Text, View } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";

import { ClockIcon, TrophyIcon } from "../../../components/icons";
import type { THEME_COLORS } from "../../../theme/themes";
import {
  DailyNumbersTargetPal,
  type DailyNumbersTargetPalMood,
} from "./target-pal";

type ThemeColors = (typeof THEME_COLORS)[keyof typeof THEME_COLORS];

type DailyNumbersAdventureSceneProps = {
  archiveLabel: string;
  archiveMode: boolean;
  awayLabel: string;
  bestLabel: string;
  colors: ThemeColors;
  compact: boolean;
  currentBestValue: number | null;
  distance: number;
  elapsedTime: string;
  guideTitle: string;
  mood: DailyNumbersTargetPalMood;
  quip: string;
  target: number;
  targetLabel: string;
  timeLabel: string;
};

function OooLandscape({ colors }: { colors: ThemeColors }) {
  return (
    <View
      className="absolute inset-0"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
    >
      <Svg width="100%" height="100%" viewBox="0 0 360 230">
        <Rect width={360} height={230} fill={colors.primaryTint} />
        <Circle cx={54} cy={47} r={24} fill={colors.secondary} opacity={0.72} />
        <Circle cx={53} cy={47} r={14} fill={colors.secondaryTint} />
        <Path
          d="M0 108 C48 67 92 78 131 115 C169 72 230 72 269 112 C301 83 332 87 360 106 L360 230 L0 230 Z"
          fill={colors.accentTint}
          opacity={0.9}
        />
        <Path
          d="M0 150 C58 109 105 125 157 159 C210 113 279 119 360 157 L360 230 L0 230 Z"
          fill={colors.successTint}
        />
        <Path
          d="M0 190 C80 153 143 171 207 196 C263 166 312 168 360 190 L360 230 L0 230 Z"
          fill={colors.success}
          opacity={0.28}
        />
        <Path
          d="M298 115 L306 79 L314 115 Z M320 112 L329 67 L338 112 Z M341 123 L348 91 L355 123 Z"
          fill={colors.secondaryDark}
          opacity={0.8}
        />
        <Rect
          x={300}
          y={108}
          width={16}
          height={52}
          rx={6}
          fill={colors.surface}
          opacity={0.76}
        />
        <Rect
          x={320}
          y={103}
          width={20}
          height={60}
          rx={7}
          fill={colors.surface}
          opacity={0.82}
        />
        <Rect
          x={343}
          y={117}
          width={12}
          height={44}
          rx={5}
          fill={colors.surface}
          opacity={0.74}
        />
        <Circle cx={308} cy={128} r={3} fill={colors.primary} opacity={0.8} />
        <Circle cx={330} cy={126} r={4} fill={colors.primary} opacity={0.8} />
        <Path
          d="M14 188 C40 171 60 171 88 189 M250 191 C273 172 294 172 318 191"
          fill="none"
          stroke={colors.successText}
          strokeLinecap="round"
          strokeWidth={3}
          opacity={0.22}
        />
      </Svg>
    </View>
  );
}

function SceneMetric({
  bordered,
  icon,
  label,
  value,
}: {
  bordered?: boolean;
  icon: ReactNode;
  label: string;
  value: number | string;
}) {
  return (
    <View
      className={`min-w-0 flex-1 flex-row items-center justify-center gap-2 px-1.5 ${bordered ? "border-x border-primaryBorder" : ""}`}
    >
      {icon}
      <View className="min-w-0">
        <Text
          className="font-nunito-extrabold text-[9px] uppercase tracking-[0.8px] text-fgMuted"
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
        >
          {label}
        </Text>
        <Text
          className="font-nunito-extrabold text-[17px] leading-5 text-fg"
          style={{ fontVariant: ["tabular-nums"] }}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.65}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

export function DailyNumbersAdventureScene({
  archiveLabel,
  archiveMode,
  awayLabel,
  bestLabel,
  colors,
  compact,
  currentBestValue,
  distance,
  elapsedTime,
  guideTitle,
  mood,
  quip,
  target,
  targetLabel,
  timeLabel,
}: DailyNumbersAdventureSceneProps) {
  return (
    <View className="overflow-hidden rounded-[28px] border-2 border-primaryBorder bg-primaryTint">
      <OooLandscape colors={colors} />

      <View className={`${compact ? "px-3 pb-3 pt-3" : "px-4 pb-4 pt-3.5"}`}>
        <View className="flex-row items-center justify-between gap-2">
          <Text
            className="min-w-0 flex-1 font-nunito-extrabold text-[11px] uppercase tracking-[1.35px] text-primaryText"
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.72}
          >
            {guideTitle}
          </Text>
          {archiveMode ? (
            <View className="rounded-full border border-primaryBorder bg-surface px-2.5 py-1">
              <Text className="font-nunito-extrabold text-[9px] uppercase tracking-[0.8px] text-primaryText">
                {archiveLabel}
              </Text>
            </View>
          ) : null}
        </View>

        <View className="mt-1 flex-row items-center gap-3">
          <View
            className="items-center justify-end"
            testID="daily-numbers-target-pal"
          >
            <DailyNumbersTargetPal
              colors={colors}
              mood={mood}
              width={compact ? 94 : 106}
            />
          </View>

          <View className="min-w-0 flex-1 items-stretch">
            <View
              accessible
              accessibilityLabel={`${targetLabel} ${target}`}
              accessibilityRole="text"
              className="rotate-[1.25deg] items-center rounded-[22px] border-2 border-secondaryBorder bg-secondaryTint px-3 py-2"
            >
              <View
                className="absolute -left-1.5 top-5 h-3 w-3 rotate-45 border-b-2 border-l-2 border-secondaryBorder bg-secondaryTint"
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              />
              <Text className="font-nunito-extrabold text-[9px] uppercase tracking-[1.25px] text-secondaryText">
                {targetLabel}
              </Text>
              <Text
                className={`${compact ? "text-[36px] leading-[40px]" : "text-[42px] leading-[46px]"} font-nunito-extrabold text-secondaryText`}
                style={{ fontVariant: ["tabular-nums"] }}
                maxFontSizeMultiplier={1.08}
                numberOfLines={1}
              >
                {target}
              </Text>
            </View>

            <View className="mt-2 self-end rounded-[16px] border border-primaryBorder bg-surface px-3 py-1.5">
              <Text className="font-nunito-extrabold text-[10px] leading-3.5 text-primaryText">
                {quip}
              </Text>
            </View>
          </View>
        </View>

        <View className="mt-2 flex-row rounded-[18px] border border-primaryBorder bg-surface px-1 py-2">
          <SceneMetric
            icon={<TrophyIcon size={17} color={colors.primaryText} />}
            label={bestLabel}
            value={currentBestValue ?? "—"}
          />
          <SceneMetric
            bordered
            icon={
              <View className="h-4 w-4 items-center justify-center rounded-full border-2 border-primaryBorder">
                <View className="h-1.5 w-1.5 rounded-full bg-primaryStrong" />
              </View>
            }
            label={awayLabel}
            value={distance}
          />
          <SceneMetric
            icon={<ClockIcon size={17} color={colors.primaryText} />}
            label={timeLabel}
            value={elapsedTime}
          />
        </View>
      </View>
    </View>
  );
}
