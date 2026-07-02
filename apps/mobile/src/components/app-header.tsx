import { View, Text, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Svg, { Circle, Path } from "react-native-svg";

import { CoinIcon, SettingsIcon } from "./icons";
import { useSessionStore } from "../stores/session-store";
import { useThemeStore } from "../stores/theme-store";
import { THEME_COLORS } from "../theme/themes";

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
                width: 40,
                height: 40,
                borderRadius: 999,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: tc.surfaceMuted,
                boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.1)",
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
