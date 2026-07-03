import { useRef } from "react";
import { Text, View } from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";
import type { SpeedRunState } from "@adventure-time/api-client";

import { useTranslation } from "../../../i18n";
import { useThemeStore } from "../../../stores/theme-store";
import { THEME_COLORS } from "../../../theme/themes";
import { reactEffect } from "../../../lib/react-primitives";

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
  const pauseRingProgress = useSharedValue(0);
  reactEffect(() => {
    if (pauseRemainingSeconds > 0 && initialPauseRef.current === null) {
      initialPauseRef.current = pauseRemainingSeconds;
      pauseRingProgress.value = 0;
      pauseRingProgress.value = withTiming(1, {
        duration: pauseRemainingSeconds * 1000,
      });
    }
    if (pauseRemainingSeconds === 0) {
      initialPauseRef.current = null;
      cancelAnimation(pauseRingProgress);
      pauseRingProgress.value = 0;
    }
  }, [pauseRemainingSeconds, pauseRingProgress]);
  const pauseRingProps = useAnimatedProps(() => ({
    strokeDashoffset: pauseRingProgress.value * RING_C,
  }));

  return (
    <View className="flex-1 items-center justify-center px-6">
      {pauseRemainingSeconds > 0 ? (
        <View
          accessibilityLabel="speed-calculus-pause-countdown"
          className="flex flex-col items-center justify-center"
          testID="speed-calculus-pause-countdown"
          style={{ transform: [{ translateY: -20 }] }}
        >
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
                animatedProps={pauseRingProps}
                strokeLinecap="round"
                transform="rotate(-90, 64, 64)"
              />
            </Svg>
            <Text
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center align-middle font-nunito-extrabold text-primaryDark text-[56px]"
            >
                  {pauseRemainingSeconds}
            </Text>
          </View>
          <Text className="text-sm font-nunito mt-5 text-primaryDark/60 text-center max-w-[220px]">
            {t("quests.speedCalculusResumeCountdownBody", { seconds: pauseRemainingSeconds })}
          </Text>
        </View>
      ) : currentQuestion ? (
        <View
          accessibilityLabel="speed-calculus-question-active"
          className="items-center w-full"
          testID="speed-calculus-question-active"
          style={{ transform: [{ translateY: -20 }] }}
        >
          <Text
            accessibilityLabel={`speed-calculus-question-label-${(activeRun?.questionIndex ?? 0) + 1}`}
            className="text-[10px] font-nunito-bold uppercase tracking-[4px] text-primary/40"
            testID={`speed-calculus-question-label-${(activeRun?.questionIndex ?? 0) + 1}`}
          >
            {t("quests.speedCalculusQuestionNumber", { current: (activeRun?.questionIndex ?? 0) + 1 })}
          </Text>
          <View className="w-12 h-px mt-2 mb-5 bg-primaryBorder" />
          <Text
            className="font-nunito-extrabold text-primaryDark text-center text-[62px] leading-[70px]"
            adjustsFontSizeToFit
            numberOfLines={1}
            style={{ transform: [{ translateY: -3 }] }}
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
