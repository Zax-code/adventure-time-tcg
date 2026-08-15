import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path } from "react-native-svg";

import { apiClient } from "../lib/api";
import { useSessionStore } from "../stores/session-store";
import { useThemeStore } from "../stores/theme-store";
import { THEME_COLORS } from "../theme/themes";
import { CoinIcon, GiftHeartIcon, SettingsIcon } from "./icons";

const HEADER_ACTION_SURFACE_STYLE = {
  width: 40,
  height: 40,
  borderRadius: 999,
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.1)",
} as const;

function HeaderShieldUserIcon({ size = 24, color = "#FFFFFF" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2L4 5V11C4 16.5 7.5 20.5 12 22C16.5 20.5 20 16.5 20 11V5L12 2Z"
        fill={color}
        fillOpacity={0.2}
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={9} r={2.5} fill={color} />
      <Path d="M8 16C8 14 9.5 13 12 13C14.5 13 16 14 16 16" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export function AppHeader() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const user = useSessionStore((state) => state.user);
  const coins = useSessionStore((state) => state.user?.coins ?? 0);
  const tc = THEME_COLORS[useThemeStore((s) => s.themeName)];
  const { data: giftsQueryData } = useQuery({
    queryKey: ["gifts"],
    queryFn: () => apiClient.gifts(),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
  const pendingGifts = giftsQueryData?.pendingCount ?? 0;

  return (
    <View style={{ paddingTop: insets.top, backgroundColor: 'transparent' }}>
      <View className="flex-row items-center justify-between px-4 py-2">
        <LinearGradient
          colors={[tc.secondary, tc.secondaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            borderRadius: 9999,
            paddingHorizontal: 16,
            paddingVertical: 6,
            boxShadow: "0px 2px 6px rgba(0, 0, 0, 0.15)",
          }}
        >
          <CoinIcon size={20} />
          <Text style={{ fontFamily: "Nunito_700Bold", fontSize: 14, color: tc.secondaryText }}>{coins}</Text>
        </LinearGradient>
        <View className="flex-row items-center" style={{ columnGap: 16 }}>
          <Pressable
            onPress={() => router.push("/(tabs)/gifts" as never)}
            hitSlop={8}
            testID="app-header-gifts-button"
          >
            <View
              style={{
                ...HEADER_ACTION_SURFACE_STYLE,
                backgroundColor: tc.surfaceMuted,
              }}
            >
              <GiftHeartIcon size={23} color={tc.successText} />
              {pendingGifts > 0 ? (
                <View className="absolute -right-1 -top-1 min-w-4 items-center rounded-full bg-dangerDark px-1 py-0.5">
                  <Text className="font-nunito-bold text-[9px] text-white">
                    {pendingGifts > 9 ? "9+" : pendingGifts}
                  </Text>
                </View>
              ) : null}
            </View>
          </Pressable>

          {user?.isAdmin ? (
            <Pressable onPress={() => router.push("/admin/cards" as never)} hitSlop={8}>
              <LinearGradient
                colors={[tc.accent, tc.accentDark, tc.accentText]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 999,
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0px 3px 8px rgba(0, 0, 0, 0.15)",
                }}
              >
                <HeaderShieldUserIcon size={24} color="#FFFFFF" />
              </LinearGradient>
            </Pressable>
          ) : null}

          <Pressable
            onPress={() => router.push("/settings")}
            hitSlop={8}
            testID="app-header-settings-button"
          >
            <View
              style={{
                ...HEADER_ACTION_SURFACE_STYLE,
                backgroundColor: tc.surfaceMuted,
              }}
            >
              <SettingsIcon size={24} color={tc.primaryDark} />
            </View>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
