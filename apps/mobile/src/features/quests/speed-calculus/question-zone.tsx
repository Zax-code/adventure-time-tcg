import { useEffect, useRef } from "react";
import { Animated, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import type { SpeedRunState } from "@adventure-time/shared";

import { useTranslation } from "../../../i18n";
import { useThemeStore } from "../../../stores/theme-store";
import { THEME_COLORS } from "../../../theme/themes";

type Question = NonNullable<SpeedRunState["activeRun"]>["questions"][number];

type QuestionZoneProps = {
  pauseRemainingSeconds: number;
  currentQuestion: Question | null;
  activeRun: NonNullable<SpeedRunState["activeRun"]> | null;
};

const RING_R = 54;
const RING_C = 2 * Math.PI * RING_R;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function QuestionZone({ pauseRemainingSeconds, currentQuestion, activeRun }: QuestionZoneProps) {
  const { t } = useTranslation();
  const tc = THEME_COLORS[useThemeStore((s) => s.themeName)];

  // ── Pause countdown ring ──────────────────────────────────────────
  const initialPauseRef = useRef<number | null>(null);
  const pauseRingAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (pauseRemainingSeconds > 0 && initialPauseRef.current === null) {
      initialPauseRef.current = pauseRemainingSeconds;
      pauseRingAnim.setValue(0);
      Animated.timing(pauseRingAnim, {
        toValue: 1,
        duration: pauseRemainingSeconds * 1000,
        useNativeDriver: false,
      }).start();
    }
    if (pauseRemainingSeconds === 0) {
      initialPauseRef.current = null;
      pauseRingAnim.setValue(0);
    }
  }, [pauseRemainingSeconds, pauseRingAnim]);
  const pauseRingOffset = pauseRingAnim.interpolate({ inputRange: [0, 1], outputRange: [0, RING_C] });

  return (
    <View className="flex-1 items-center justify-center px-6">
      {pauseRemainingSeconds > 0 ? (
        <View className="flex flex-col items-center justify-center">
          <Text className="text-[10px] font-nunito-bold uppercase tracking-[4px] text-primary/50 mb-5">
            {t("quests.speedCalculusResumeCountdownTitle")}
          </Text>
          <View className="relative w-32 h-32 flex items-center justify-center">
            <Svg width="128" height="128" className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <Circle
                cx="64" cy="64" r={RING_R}
                stroke={tc.primaryBorder}
                strokeWidth="4"
                fill={tc.primaryTint}
              />
              <AnimatedCircle
                cx="64" cy="64" r={RING_R}
                stroke={tc.primary}
                strokeWidth="4"
                fill="none"
                strokeDasharray={RING_C}
                strokeDashoffset={pauseRingOffset}
                strokeLinecap="round"
                transform="rotate(-90, 64, 64)"
              />
            </Svg>
            <Text className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center align-middle font-nunito-extrabold text-primaryDark text-[56px]">
                  {pauseRemainingSeconds}
            </Text>
          </View>
          <Text className="text-sm font-nunito mt-5 text-primaryDark/60 text-center max-w-[220px]">
            {t("quests.speedCalculusResumeCountdownBody", { seconds: pauseRemainingSeconds })}
          </Text>
        </View>
      ) : currentQuestion ? (
        <View className="items-center w-full">
          <Text className="text-[10px] font-nunito-bold uppercase tracking-[4px] text-primary/40">
            {t("quests.speedCalculusQuestionNumber", { current: (activeRun?.questionIndex ?? 0) + 1 })}
          </Text>
          <View className="w-12 h-px mt-2 mb-5 bg-primaryBorder" />
          <Text
            className="font-nunito-extrabold text-primaryDark text-center text-[62px] leading-[70px]"
            adjustsFontSizeToFit
            numberOfLines={1}
          >
            {currentQuestion.left} {currentQuestion.operator} {currentQuestion.right}
          </Text>
        </View>
      ) : (
        <Text className="text-sm font-nunito text-primaryDark/30">···</Text>
      )}
    </View>
  );
}
