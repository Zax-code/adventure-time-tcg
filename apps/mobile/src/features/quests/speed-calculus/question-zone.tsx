import { type ReactNode, useEffect, useRef } from "react";
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

type Question = NonNullable<SpeedRunState["activeRun"]>["questions"][number];

type QuestionZoneProps = {
  pauseRemainingSeconds: number;
  currentQuestion: Question | null;
  activeRun: NonNullable<SpeedRunState["activeRun"]> | null;
  // Floats over the card bottom (the answer feedback pill).
  overlay?: ReactNode;
};

const RING_SIZE = 112;
const RING_R = 52;
const RING_C = 2 * Math.PI * RING_R;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function QuestionZone({
  pauseRemainingSeconds,
  currentQuestion,
  activeRun,
  overlay,
}: QuestionZoneProps) {
  const { t } = useTranslation();
  const tc = THEME_COLORS[useThemeStore((s) => s.themeName)];

  // ── Pause countdown ring ──────────────────────────────────────────
  const initialPauseRef = useRef<number | null>(null);
  const pauseRingProgress = useSharedValue(0);
  useEffect(() => {
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

  // Board 04 question Card: "QUESTION N" overline over the 48/800
  // expression. It takes the free height above the answer field, and the
  // feedback pill floats at its bottom so the keypad never moves.
  return (
    <View className="min-h-[102px] flex-1 items-center justify-center overflow-hidden rounded-ds-lg border border-primaryBorder bg-surface p-ds-4">
      {pauseRemainingSeconds > 0 ? (
        <View
          accessibilityLabel="speed-calculus-pause-countdown"
          className="items-center justify-center gap-ds-2"
          testID="speed-calculus-pause-countdown"
        >
          <Text className="font-nunito-bold text-ds-overline uppercase tracking-[1px] text-fgMuted">
            {t("quests.speedCalculusResumeCountdownTitle")}
          </Text>
          <View className="h-[112px] w-[112px] items-center justify-center">
            <Svg width={RING_SIZE} height={RING_SIZE} style={{ position: "absolute" }}>
              <Circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_R}
                stroke={tc.primaryBorder}
                strokeWidth="4"
                fill={tc.primaryTint}
              />
              <AnimatedCircle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_R}
                stroke={tc.primary}
                strokeWidth="4"
                fill="none"
                strokeDasharray={RING_C}
                animatedProps={pauseRingProps}
                strokeLinecap="round"
                transform={`rotate(-90, ${RING_SIZE / 2}, ${RING_SIZE / 2})`}
              />
            </Svg>
            <Text className="text-center font-nunito-extrabold text-[48px] leading-[58px] text-primaryText">
              {pauseRemainingSeconds}
            </Text>
          </View>
        </View>
      ) : currentQuestion ? (
        <View
          accessibilityLabel="speed-calculus-question-active"
          className="w-full items-center gap-[2px]"
          testID="speed-calculus-question-active"
        >
          <Text
            accessibilityLabel={`speed-calculus-question-label-${(activeRun?.questionIndex ?? 0) + 1}`}
            className="font-nunito-bold text-ds-overline uppercase tracking-[1px] text-fgMuted"
            testID={`speed-calculus-question-label-${(activeRun?.questionIndex ?? 0) + 1}`}
          >
            {t("quests.speedCalculusQuestionNumber", {
              current: (activeRun?.questionIndex ?? 0) + 1,
            })}
          </Text>
          <Text
            className="text-center font-nunito-extrabold text-[48px] leading-[58px] text-primaryText"
            adjustsFontSizeToFit
            numberOfLines={1}
          >
            {currentQuestion.left} {formatOperator(currentQuestion.operator)}{" "}
            {currentQuestion.right}
          </Text>
        </View>
      ) : (
        <Text className="font-nunito text-ds-sm text-fgMuted">···</Text>
      )}
      {overlay}
    </View>
  );
}

// The design sets subtraction with a true minus sign.
function formatOperator(operator: string) {
  return operator === "-" ? "\u2212" : operator;
}
