import type { ReactNode } from "react";
import { memo } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePathname, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

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

  const currentItem =
    NAV_ITEMS.find((item) => pathname === item.path) ?? NAV_ITEMS[0];

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
                    <HomeIcon size={22} color="#FFFFFF" />
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
                <Text className="font-nunito-semibold text-[13px] leading-[19px] text-fgMuted">
                  {t(currentItem.labelKey)}
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
              className="flex-row rounded-[30] border p-2"
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
              {NAV_ITEMS.map((item) => {
                const active =
                  pathname === item.path ||
                  (pathname === "/admin" && item.path === "/admin/cards");
                const tint = tc[item.tintKey];

                return (
                  <Pressable
                    key={item.path}
                    onPress={() => router.replace(item.path as any)}
                    className="flex-1 items-center justify-center gap-1 rounded-[22] px-0 py-2"
                    style={{
                      backgroundColor: active
                        ? withAlpha(tc.primaryTint, "E8")
                        : "transparent",
                    }}
                  >
                    <View
                      className="h-[34] w-[34] items-center justify-center rounded-[12]"
                      style={{
                        backgroundColor: active ? tc.surface : "transparent",
                      }}
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
                    </View>
                    <Text
                      className="font-nunito-extrabold text-[9px]"
                      numberOfLines={1}
                      style={{ color: active ? tint : tc.fgMuted }}
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
    </AdminBackground>
  );
}
