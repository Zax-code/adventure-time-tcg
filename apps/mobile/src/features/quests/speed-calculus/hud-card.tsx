import { Pressable, Text, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import type { SpeedRunState } from "@adventure-time/api-client";

import { useTranslation } from "../../../i18n";
import { useThemeStore } from "../../../stores/theme-store";
import { THEME_COLORS } from "../../../theme/themes";
import { reactEffect } from "../../../lib/react-primitives";

type HudCardProps = {
  activeRun: NonNullable<SpeedRunState["activeRun"]> | null;
  runDurationSeconds: number;
  sessionLabel: string;
  remainingSeconds: number;
  pauseRemainingSeconds: number;
  displayedCorrectAnswers: number;
  isManuallyPaused: boolean;
  onPause: () => void;
  pauseDisabled: boolean;
};

export function HudCard({
  activeRun,
  runDurationSeconds,
  sessionLabel,
  remainingSeconds,
  pauseRemainingSeconds,
  displayedCorrectAnswers,
  isManuallyPaused,
  onPause,
  pauseDisabled }: HudCardProps) {
  const { t } = useTranslation();
  const tc = THEME_COLORS[useThemeStore((s) => s.themeName)];
  const progressAnim = useSharedValue(1);

  // ── Timer urgency ─────────────────────────────────────────────────
  const maxSeconds = runDurationSeconds;
  const timerIsLow = remainingSeconds <= Math.floor(maxSeconds * 0.33);
  const timerIsCritical = remainingSeconds <= 5;
  const timerColor = timerIsCritical ? tc.dangerDark : timerIsLow ? tc.secondaryDark : tc.primaryDark;
  const timerProgress =
    activeRun && maxSeconds > 0
      ? Math.max(0, Math.min(1, remainingSeconds / maxSeconds))
      : 1;
  const activeRunId = activeRun?.runId ?? null;
  const timerRunning =
    activeRunId !== null &&
    pauseRemainingSeconds <= 0 &&
    !isManuallyPaused &&
    remainingSeconds > 0;

  reactEffect(() => {
    cancelAnimation(progressAnim);
    progressAnim.value = activeRunId === null ? 1 : timerProgress;
  }, [activeRunId, maxSeconds, progressAnim]);

  reactEffect(() => {
    if (!timerRunning) {
      cancelAnimation(progressAnim);
      return;
    }

    progressAnim.value = withTiming(0, {
      duration: remainingSeconds * 1000,
      easing: Easing.linear,
    });

    return () => cancelAnimation(progressAnim);
  }, [activeRunId, progressAnim, timerRunning]);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progressAnim.value * 100}%`,
  }));

  return (
    <View
      className="mx-4 mt-3 rounded-2xl px-4 pt-3 pb-2 bg-surface"
      style={{
        boxShadow: `0px 3px 10px ${tc.primaryDark}` }}
    >
      <View className="flex-row items-start justify-between gap-3">
        {/* Timer */}
        <View className="items-start">
          <Text
            className="font-nunito-extrabold text-4xl leading-10"
            style={{ color: timerColor }}
          >
            {remainingSeconds}
            <Text className="text-base" style={{ color: timerColor }}>s</Text>
          </Text>
          <Text className="text-[10px] font-nunito-bold uppercase tracking-[2.5px] text-primaryDark/50 -mt-0.5">
            {sessionLabel}
          </Text>
        </View>

        {/* Score */}
        <View className="items-end">
          <Text className="font-nunito-extrabold text-primaryDark text-4xl leading-10">
            {displayedCorrectAnswers}
          </Text>
          <Text className="text-[10px] font-nunito-bold uppercase tracking-[2.5px] text-primaryDark/50 -mt-0.5">
            {t("quests.speedCalculusCorrectNow")}
          </Text>
        </View>
      </View>

      {activeRun ? (
        <View className="mt-3 flex-row justify-end">
          <Pressable
            accessibilityRole="button"
            disabled={pauseDisabled}
            onPress={onPause}
            className="rounded-full border px-4 py-2"
            style={({ pressed }) => ({
              opacity: pauseDisabled ? 0.45 : pressed ? 0.8 : 1,
              borderColor: tc.primaryBorder,
              backgroundColor: isManuallyPaused ? tc.primaryTint : tc.primaryBg })}
          >
            <Text className="font-nunito-bold text-sm" style={{ color: tc.primaryDark }}>
              {t("quests.speedCalculusPause")}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {/* Timer progress bar — smooth continuous drain */}
      <View className="mt-2.5 mb-0.5 h-[5px] rounded-full overflow-hidden bg-primaryTint">
        <Animated.View
          className="h-full rounded-full"
          style={[
            {
              backgroundColor: timerColor,
            },
            progressStyle,
          ]}
        />
      </View>
    </View>
  );
}
