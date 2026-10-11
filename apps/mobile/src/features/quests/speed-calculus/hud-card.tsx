import { useEffect } from "react";
import { Text, View } from "react-native";
import Pause from "lucide-react-native/icons/pause";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import type { SpeedRunState } from "@adventure-time/api-client";

import { Button } from "../../../components/ui/button";
import { useTranslation } from "../../../i18n";
import { useThemeStore } from "../../../stores/theme-store";
import { THEME_COLORS } from "../../../theme/themes";

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

  useEffect(() => {
    cancelAnimation(progressAnim);
    progressAnim.value = activeRunId === null ? 1 : timerProgress;
  }, [activeRunId, maxSeconds, progressAnim]);

  useEffect(() => {
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

  // Game HUD anatomy (board 02): timer left, score right, ghost-sm Pause,
  // then the draining progress track.
  return (
    <View className="mx-ds-4 mt-ds-3 gap-[10px] rounded-ds-lg border border-primaryBorder bg-surface px-ds-4 py-ds-3">
      <View className="flex-row items-center gap-ds-3">
        <View className="flex-1">
          <Text
            className="font-nunito-extrabold text-[24px] leading-[29px]"
            style={{ color: timerColor }}
          >
            {remainingSeconds} s
          </Text>
          <Text className="font-nunito-bold text-ds-caption text-fgMuted">
            {sessionLabel}
          </Text>
        </View>

        <View className="flex-1 items-end">
          <Text className="font-nunito-extrabold text-[24px] leading-[29px] text-fg">
            {displayedCorrectAnswers}
          </Text>
          <Text className="font-nunito-bold text-ds-caption text-fgMuted">
            {t("quests.speedCalculusCorrectNow")}
          </Text>
        </View>

        {activeRun ? (
          <Button
            tone="ghost"
            size="sm"
            icon={Pause}
            disabled={pauseDisabled}
            onPress={onPause}
            accessibilityState={{ selected: isManuallyPaused }}
          >
            {t("quests.speedCalculusPause")}
          </Button>
        ) : null}
      </View>

      <View className="h-ds-2 overflow-hidden rounded-ds-pill bg-primaryTint">
        <Animated.View
          className="h-full rounded-ds-pill"
          style={[{ backgroundColor: timerColor }, progressStyle]}
        />
      </View>
    </View>
  );
}
