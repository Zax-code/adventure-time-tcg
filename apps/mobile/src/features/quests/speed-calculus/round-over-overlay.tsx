import { useEffect } from "react";
import { Text, View } from "react-native";
import Timer from "lucide-react-native/icons/timer";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { Button } from "../../../components/ui/button";
import { IconTile } from "../../../components/ui/icon-tile";
import { getBackdropColor, getElevation } from "../../../components/ui/tokens";
import { useTranslation } from "../../../i18n";
import { useThemeStore } from "../../../stores/theme-store";

type RoundOverOverlayProps = {
  showRoundOver: boolean;
  roundOverScore: number;
  sessionLabel: string;
  backLabel: string;
  onDismiss: () => void;
};

export function RoundOverOverlay({
  showRoundOver,
  roundOverScore,
  sessionLabel,
  backLabel,
  onDismiss,
}: RoundOverOverlayProps) {
  const { t } = useTranslation();
  const themeName = useThemeStore((s) => s.themeName);

  // ── Round-over entrance animation ─────────────────────────────────
  const roundOverAnim = useSharedValue(0);
  useEffect(() => {
    if (showRoundOver) {
      roundOverAnim.value = 0;
      roundOverAnim.value = withTiming(1, {
        duration: 220,
        easing: Easing.out(Easing.cubic),
      });
    }
  }, [showRoundOver, roundOverAnim]);

  const roundOverStyle = useAnimatedStyle(() => ({
    opacity: roundOverAnim.value,
    transform: [
      {
        scale: interpolate(roundOverAnim.value, [0, 1], [0.82, 1]),
      },
    ],
  }));

  // Dialog anatomy (board 02) inside the run panel: backdrop, 342-wide
  // surface panel, icon tile, title, score and one full-width Primary.
  return (
    <View
      className="absolute inset-0 items-center justify-center p-ds-6"
      style={{ backgroundColor: getBackdropColor(themeName) }}
    >
      <Animated.View
        className="w-full max-w-[342px] items-center gap-ds-4 rounded-ds-xl bg-surface p-ds-5"
        style={[{ boxShadow: getElevation(themeName, "overlay") }, roundOverStyle]}
      >
        <IconTile icon={Timer} size={48} tone="info" />
        <Text
          accessibilityRole="header"
          className="text-center font-nunito-extrabold text-[20px] leading-[24px] text-fg"
        >
          {t("quests.speedCalculusRoundOver")}
        </Text>
        <View className="items-center">
          <Text className="font-nunito-bold text-ds-overline uppercase tracking-[1px] text-fgMuted">
            {sessionLabel}
          </Text>
          <Text className="font-nunito-extrabold text-ds-display text-primaryText">
            {roundOverScore}
          </Text>
          <Text className="font-nunito text-ds-body text-fgMuted">
            {t("quests.speedCalculusCorrectNow")}
          </Text>
        </View>
        <Button onPress={onDismiss} style={{ alignSelf: "stretch" }}>
          {backLabel}
        </Button>
      </Animated.View>
    </View>
  );
}
