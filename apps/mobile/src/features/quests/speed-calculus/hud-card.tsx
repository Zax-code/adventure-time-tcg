import { useEffect, useRef } from "react";
import { Animated, Text, View } from "react-native";
import type { SpeedRunState } from "@adventure-time/shared";

import { useTranslation } from "../../../i18n";
import { useThemeStore } from "../../../stores/theme-store";
import { THEME_COLORS } from "../../../theme/themes";

type HudCardProps = {
  activeRun: NonNullable<SpeedRunState["activeRun"]> | null;
  state: SpeedRunState;
  remainingSeconds: number;
  pauseRemainingSeconds: number;
};

export function HudCard({ activeRun, state, remainingSeconds, pauseRemainingSeconds }: HudCardProps) {
  const { t } = useTranslation();
  const tc = THEME_COLORS[useThemeStore((s) => s.themeName)];

  // ── Smooth timer bar ──────────────────────────────────────────────
  const timerBarAnim = useRef(new Animated.Value(1)).current;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!activeRun || pauseRemainingSeconds > 0 || remainingSeconds <= 0) return;
    const maxSecs = state.runDurationSeconds ?? 30;
    timerBarAnim.setValue(remainingSeconds / maxSecs);
    const anim = Animated.timing(timerBarAnim, {
      toValue: 0,
      duration: remainingSeconds * 1000,
      useNativeDriver: false,
    });
    anim.start();
    return () => anim.stop();
  // Restart only when a new run begins or the pause countdown ends
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRun?.runId, pauseRemainingSeconds === 0]);

  // ── Timer urgency ─────────────────────────────────────────────────
  const maxSeconds = state.runDurationSeconds ?? 30;
  const timerIsLow = remainingSeconds <= Math.floor(maxSeconds * 0.33);
  const timerIsCritical = remainingSeconds <= 5;
  const timerColor = timerIsCritical ? tc.dangerDark : timerIsLow ? tc.secondaryDark : tc.primaryDark;

  return (
    <View
      className="mx-4 mt-3 rounded-2xl px-4 pt-3 pb-2 bg-surface"
      style={{
        shadowColor: tc.primaryDark,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.12,
        shadowRadius: 10,
        elevation: 4,
      }}
    >
      <View className="flex-row items-start justify-between">
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
            {t("quests.speedCalculusRunLabel", { run: activeRun?.runNumber ?? 1, total: state.maxRuns ?? 3 })}
          </Text>
        </View>

        {/* Score */}
        <View className="items-end">
          <Text className="font-nunito-extrabold text-primaryDark text-4xl leading-10">
            {activeRun?.correctAnswers ?? 0}
          </Text>
          <Text className="text-[10px] font-nunito-bold uppercase tracking-[2.5px] text-primaryDark/50 -mt-0.5">
            {t("quests.speedCalculusCorrectNow")}
          </Text>
        </View>
      </View>

      {/* Timer progress bar — smooth continuous drain */}
      <View className="mt-2.5 mb-0.5 h-[5px] rounded-full overflow-hidden bg-primaryTint">
        <Animated.View
          className="h-full rounded-full"
          style={{
            width: timerBarAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
            backgroundColor: timerColor,
          }}
        />
      </View>
    </View>
  );
}
