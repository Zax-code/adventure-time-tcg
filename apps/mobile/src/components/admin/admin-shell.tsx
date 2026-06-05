import type { ReactNode } from "react";
import { memo, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePathname, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@react-native-vector-icons/ionicons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { CoinIcon, CardsIcon, HomeIcon, SettingsIcon } from "../icons";
import { useTranslation } from "../../i18n";
import { useSessionStore } from "../../stores/session-store";
import { useThemeStore } from "../../stores/theme-store";
import { THEME_COLORS } from "../../theme/themes";
import { withAlpha } from "./admin-palette";
import { AdminBackground } from "./admin-ui";

type ThemeColorKey = keyof (typeof THEME_COLORS)["candy"];

const NAV_ITEMS: {
  path: string;
  labelKey: string;
  icon: "albums" | "cube" | "images" | "star" | "flash" | "people";
  tintKey: ThemeColorKey;
}[] = [
  {
    path: "/admin/cards",
    labelKey: "admin.shell.nav.cards",
    icon: "albums",
    tintKey: "primaryText",
  },
  {
    path: "/admin/packs",
    labelKey: "admin.shell.nav.packs",
    icon: "cube",
    tintKey: "secondaryText",
  },
  {
    path: "/admin/image-assets",
    labelKey: "admin.shell.nav.assets",
    icon: "images",
    tintKey: "infoText",
  },
  {
    path: "/admin/featured",
    labelKey: "admin.shell.nav.featured",
    icon: "star",
    tintKey: "secondaryText",
  },
  {
    path: "/admin/abilities",
    labelKey: "admin.shell.nav.abilities",
    icon: "flash",
    tintKey: "accentText",
  },
  {
    path: "/admin/users",
    labelKey: "admin.shell.nav.users",
    icon: "people",
    tintKey: "accentStrong",
  },
];

const CoinPill = memo(function CoinPill() {
  const coins = useSessionStore((state) => state.user?.coins ?? 0);
  const { themeName } = useThemeStore();
  const tc = THEME_COLORS[themeName];

  return (
    <LinearGradient
      colors={[tc.secondary, tc.secondaryDark]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        borderRadius: 999,
        paddingHorizontal: 16,
        paddingVertical: 8,
        shadowColor: tc.fg,
        shadowOpacity: 0.12,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 4,
      }}
    >
      <CoinIcon size={20} />
      <Text className="font-nunito-extrabold text-sm text-secondaryText">
        {coins.toLocaleString()}
      </Text>
    </LinearGradient>
  );
});

export function AdminShell({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const { themeName } = useThemeStore();
  const tc = THEME_COLORS[themeName];
  const { t } = useTranslation();
  const [barWidth, setBarWidth] = useState(0);
  const selectorOffset = useSharedValue(0);
  const selectorInset = 6;
  const activeTabIndex = Math.max(
    NAV_ITEMS.findIndex(
      (item) =>
        pathname === item.path ||
        (pathname === "/admin" && item.path === "/admin/cards"),
    ),
    0,
  );
  const selectorWidth =
    barWidth > selectorInset * 2
      ? (barWidth - selectorInset * 2) / NAV_ITEMS.length
      : 0;
  const selectorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: selectorOffset.value }],
  }));

  useEffect(() => {
    if (!selectorWidth) {
      return;
    }

    selectorOffset.value = withSpring(selectorWidth * activeTabIndex, {
      damping: 20,
      mass: 0.9,
      stiffness: 240,
    });
  }, [activeTabIndex, selectorOffset, selectorWidth]);

  return (
    <AdminBackground>
      <View className="flex-1">
        <View className="px-4 pb-3" style={{ paddingTop: insets.top + 10 }}>
          <View className="gap-3">
            <View className="flex-row items-center justify-between">
              <CoinPill />
              <View className="flex-row items-center" style={{ columnGap: 16 }}>
                <Pressable
                  onPress={() => router.replace("/(tabs)" as any)}
                  hitSlop={8}
                >
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
                      shadowColor: "#000",
                      shadowOpacity: 0.15,
                      shadowRadius: 8,
                      shadowOffset: { width: 0, height: 3 },
                      elevation: 3,
                    }}
                  >
                    <View style={{ transform: [{ translateY: -1.5 }] }}>
                      <HomeIcon size={22} color="#FFFFFF" />
                    </View>
                  </LinearGradient>
                </Pressable>
                <Pressable onPress={() => router.push("/settings")} hitSlop={8}>
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 999,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: tc.surfaceMuted,
                      shadowColor: "#000",
                      shadowOpacity: 0.1,
                      shadowRadius: 4,
                      shadowOffset: { width: 0, height: 2 },
                      elevation: 2,
                    }}
                  >
                    <SettingsIcon size={24} color={tc.primaryDark} />
                  </View>
                </Pressable>
              </View>
            </View>
            <View className="flex-row items-start justify-between gap-3">
              <View className="flex-1">
                <Text className="font-nunito-extrabold text-[24px] text-fg">
                  {t("admin.shell.consoleTitle")}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View className="flex-1">{children}</View>

        <View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 40,
          }}
        >
          <View
            className="px-1"
            style={{ paddingBottom: Math.max(insets.bottom, 12) }}
          >
            <View
              className="rounded-[30] border"
              style={{
                backgroundColor: tc.surface,
                borderColor: withAlpha(tc.primaryBorder, "73"),
                shadowColor: tc.fg,
                shadowOpacity: themeName === "nightosphere" ? 0.22 : 0.08,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 6 },
                elevation: 5,
              }}
            >
              <View
                className="relative p-[6px]"
                onLayout={(event) => {
                  setBarWidth(event.nativeEvent.layout.width);
                }}
              >
                {selectorWidth ? (
                  <Animated.View
                    pointerEvents="none"
                    className="absolute rounded-[22px]"
                    style={[
                      {
                        top: selectorInset,
                        bottom: selectorInset,
                        left: selectorInset,
                        width: selectorWidth,
                        backgroundColor: withAlpha(tc.primaryTint, "E8"),
                        borderWidth: 1,
                        borderColor: withAlpha(tc.primaryBorder, "4D"),
                      },
                      selectorStyle,
                    ]}
                  />
                ) : null}
                <View className="flex-row">
                  {NAV_ITEMS.map((item) => {
                    const active =
                      pathname === item.path ||
                      (pathname === "/admin" &&
                        item.path === "/admin/cards");
                    const tint = tc[item.tintKey];

                    return (
                      <Pressable
                        key={item.path}
                        onPress={() => router.replace(item.path as any)}
                        className="flex-1 items-center justify-center gap-1 rounded-[22] px-0 py-2"
                        style={{ minWidth: 0 }}
                      >
                        {item.path === "/admin/cards" ? (
                          <CardsIcon
                            size={20}
                            color={active ? tint : tc.fgMuted}
                          />
                        ) : (
                          <Ionicons
                            name={item.icon}
                            size={20}
                            color={active ? tint : tc.fgMuted}
                          />
                        )}
                        <Text
                          className="font-nunito-extrabold text-[9px]"
                          numberOfLines={1}
                          style={{
                            color: active ? tint : tc.fgMuted,
                            flexShrink: 1,
                          }}
                        >
                          {t(item.labelKey)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>
          </View>
        </View>
      </View>
    </AdminBackground>
  );
}
