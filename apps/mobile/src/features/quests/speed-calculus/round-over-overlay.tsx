import { useRef } from "react";
import { Pressable, Text, View } from "react-native";
import { Animated } from "../../../lib/native-animated";
import { LinearGradient } from "expo-linear-gradient";

import { useTranslation } from "../../../i18n";
import { useThemeStore } from "../../../stores/theme-store";
import { THEME_COLORS } from "../../../theme/themes";
import { withAlpha } from "./palette";
import { useAnimatedValue } from "../../../hooks/use-animated-value";
import { asStyle } from "../../../lib/style-object";
import { reactEffect } from "../../../lib/react-primitives";

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
  onDismiss }: RoundOverOverlayProps) {
  const { t } = useTranslation();
  const tc = THEME_COLORS[useThemeStore((s) => s.themeName)];

  // ── Round-over entrance animation ─────────────────────────────────
  const roundOverAnim = useAnimatedValue(0);
  reactEffect(() => {
    if (showRoundOver) {
      roundOverAnim.setValue(0);
      Animated.spring(roundOverAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 120,
        friction: 8 }).start();
    }
  }, [showRoundOver, roundOverAnim]);

  const roundOverScale = roundOverAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.72, 1] });

  return (
    <View
      className="absolute inset-0 items-center justify-center"
      style={{ backgroundColor: withAlpha(tc.primaryStrong, "CC") }}
    >
      <Animated.View
        className="overflow-hidden rounded-3xl w-[85%] max-w-[340px]"
        style={{
          transform: [{ scale: roundOverScale }],
          opacity: roundOverAnim,
          boxShadow: `0px 16px 40px ${tc.primaryStrong}` }}
      >
        <LinearGradient
          colors={[tc.primary, tc.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ overflow: "hidden" }}
        >
          {/* ── Texture layer ──────────────────────────────────── */}
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              overflow: "hidden" }}
            pointerEvents="none"
          >
            <View style={{ flexDirection: "row", flexWrap: "wrap", flex: 1 }}>
              {Array.from({ length: 160 }).map((_, i) => (
                <View
                  key={i}
                  style={{
                    width: 3,
                    height: 3,
                    borderRadius: 2,
                    margin: 5.5,
                    backgroundColor: withAlpha(tc.primaryBg, "14") }}
                />
              ))}
            </View>
            <LinearGradient
              colors={[
                "transparent",
                withAlpha(tc.primaryBg, "10"),
                "transparent",
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                position: "absolute",
                top: -60,
                left: -60,
                right: -60,
                bottom: -60 }}
            />
            <View
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: 1,
                backgroundColor: withAlpha(tc.primaryBg, "47") }}
            />
          </View>

          {/* ── Decorative accents ─────────────────────────────── */}
          <View
            style={asStyle({
              position: "absolute",
              top: -18,
              right: -18,
              width: 56,
              height: 56,
              borderRadius: 6,
              backgroundColor: tc.secondary,
              opacity: 0.22,
              transform: [{ rotate: "45deg" }] })}
            pointerEvents="none"
          />
          <View
            style={asStyle({
              position: "absolute",
              bottom: -32,
              left: -32,
              width: 100,
              height: 100,
              borderRadius: 50,
              backgroundColor: tc.accent,
              opacity: 0.14 })}
            pointerEvents="none"
          />

          {/* ── Content ────────────────────────────────────────── */}
          <View className="items-center px-6 pt-8 pb-7 gap-5">
            <Text
              className="font-nunito-bold text-[11px] uppercase tracking-[3px]"
              style={{ color: withAlpha(tc.primaryBg, "99") }}
            >
              {sessionLabel}
            </Text>

            <View className="items-center gap-1">
              <Text
                className="font-nunito-extrabold text-[64px] leading-[68px]"
                style={{ color: tc.primaryBg }}
              >
                {roundOverScore}
              </Text>
              <Text
                className="font-nunito-semibold text-sm"
                style={{ color: withAlpha(tc.primaryBg, "B8") }}
              >
                {t("quests.speedCalculusCorrectNow")}
              </Text>
            </View>

            <View
              className="w-16 h-px"
              style={{ backgroundColor: withAlpha(tc.primaryBg, "33") }}
            />

            <Text
              className="font-nunito-extrabold text-center text-[28px] leading-[32px] tracking-[-0.5px]"
              style={{ color: tc.primaryBg }}
            >
              {t("quests.speedCalculusRoundOver")}
            </Text>

            <Pressable
              onPress={onDismiss}
              className="mt-1 rounded-full overflow-hidden w-full"
              style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
            >
              <LinearGradient
                colors={[tc.primaryDark, tc.primaryStrong]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  paddingVertical: 16,
                  alignItems: "center",
                  borderRadius: 999 }}
              >
                <Text
                  className="font-nunito-extrabold text-center text-[13px] uppercase tracking-[2.5px]"
                  style={{ color: tc.primaryBg }}
                >
                  {backLabel}
                </Text>
              </LinearGradient>
            </Pressable>
          </View>
        </LinearGradient>
      </Animated.View>
    </View>
  );
}
