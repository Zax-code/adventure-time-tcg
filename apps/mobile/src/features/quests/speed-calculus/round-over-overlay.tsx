import { useEffect, useRef } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { SpeedRunState } from "@adventure-time/api-client";

import { useTranslation } from "../../../i18n";
import { useThemeStore } from "../../../stores/theme-store";
import { THEME_COLORS } from "../../../theme/themes";

type RoundOverOverlayProps = {
  showRoundOver: boolean;
  roundOverScore: number;
  roundOverRunNumber: number;
  state: SpeedRunState;
  onDismiss: () => void;
};

export function RoundOverOverlay({
  showRoundOver,
  roundOverScore,
  roundOverRunNumber,
  state,
  onDismiss,
}: RoundOverOverlayProps) {
  const { t } = useTranslation();
  const tc = THEME_COLORS[useThemeStore((s) => s.themeName)];

  // ── Round-over entrance animation ─────────────────────────────────
  const roundOverAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (showRoundOver) {
      roundOverAnim.setValue(0);
      Animated.spring(roundOverAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 120,
        friction: 8,
      }).start();
    }
  }, [showRoundOver, roundOverAnim]);

  const roundOverScale = roundOverAnim.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] });

  return (
    <View className="absolute inset-0 items-center justify-center bg-black/[0.78]">
      <Animated.View
        className="overflow-hidden rounded-3xl w-[85%] max-w-[340px]"
        style={{
          transform: [{ scale: roundOverScale }],
          opacity: roundOverAnim,
          shadowColor: tc.primaryStrong,
          shadowOffset: { width: 0, height: 16 },
          shadowOpacity: 0.45,
          shadowRadius: 40,
          elevation: 20,
        }}
      >
        <LinearGradient
          colors={[tc.primary, tc.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ overflow: "hidden" }}
        >
          {/* ── Texture layer ──────────────────────────────────── */}
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, overflow: "hidden" }} pointerEvents="none">
            <View style={{ flexDirection: "row", flexWrap: "wrap", flex: 1 }}>
              {Array.from({ length: 160 }).map((_, i) => (
                <View key={i} style={{ width: 3, height: 3, borderRadius: 2, margin: 5.5, backgroundColor: "rgba(255,255,255,0.07)" }} />
              ))}
            </View>
            <LinearGradient
              colors={["transparent", "rgba(255,255,255,0.06)", "transparent"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ position: "absolute", top: -60, left: -60, right: -60, bottom: -60 }}
            />
            <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, backgroundColor: "rgba(255,255,255,0.28)" }} />
          </View>

          {/* ── Decorative accents ─────────────────────────────── */}
          <View style={{ position: "absolute", top: -18, right: -18, width: 56, height: 56, borderRadius: 6, backgroundColor: tc.secondary, opacity: 0.22, transform: [{ rotate: "45deg" }] }} pointerEvents="none" />
          <View style={{ position: "absolute", bottom: -32, left: -32, width: 100, height: 100, borderRadius: 50, backgroundColor: tc.accent, opacity: 0.14 }} pointerEvents="none" />

          {/* ── Content ────────────────────────────────────────── */}
          <View className="items-center px-6 pt-8 pb-7 gap-5">
            <Text className="font-nunito-bold text-[11px] uppercase tracking-[3px] text-white/50">
              {t("quests.speedCalculusRunLabel", { run: roundOverRunNumber, total: state.maxRuns ?? 3 })}
            </Text>

            <View className="items-center gap-1">
              <Text className="font-nunito-extrabold text-[64px] leading-[68px] text-white">
                {roundOverScore}
              </Text>
              <Text className="font-nunito-semibold text-sm text-white/60">
                {t("quests.speedCalculusCorrectNow")}
              </Text>
            </View>

            <View className="w-16 h-px bg-white/20" />

            <Text className="font-nunito-extrabold text-center text-[28px] text-white leading-[32px] tracking-[-0.5px]">
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
                style={{ paddingVertical: 16, alignItems: "center", borderRadius: 999 }}
              >
                <Text className="font-nunito-extrabold text-center text-[13px] text-primaryTint uppercase tracking-[2.5px]">
                  {t("quests.speedCalculusBackToMain")}
                </Text>
              </LinearGradient>
            </Pressable>
          </View>
        </LinearGradient>
      </Animated.View>
    </View>
  );
}
