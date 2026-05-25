import type { ReactNode } from "react";
import { memo } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePathname, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

import { CoinIcon, CardsIcon, HomeIcon } from "../icons";
import { useTranslation } from "../../i18n";
import { useSessionStore } from "../../stores/session-store";
import { useThemeStore } from "../../stores/theme-store";
import { THEME_COLORS } from "../../theme/themes";
import { AdminBackground } from "./admin-ui";

type ThemeColorKey = keyof (typeof THEME_COLORS)["candy"];

const NAV_ITEMS: { path: string; labelKey: string; icon: "albums" | "cube" | "images" | "star" | "flash" | "people"; tintKey: ThemeColorKey }[] = [
  { path: "/admin/cards", labelKey: "admin.shell.nav.cards", icon: "albums", tintKey: "primaryText" },
  { path: "/admin/packs", labelKey: "admin.shell.nav.packs", icon: "cube", tintKey: "secondaryText" },
  { path: "/admin/image-assets", labelKey: "admin.shell.nav.assets", icon: "images", tintKey: "infoText" },
  { path: "/admin/featured", labelKey: "admin.shell.nav.featured", icon: "star", tintKey: "secondaryText" },
  { path: "/admin/abilities", labelKey: "admin.shell.nav.abilities", icon: "flash", tintKey: "accentText" },
  { path: "/admin/users", labelKey: "admin.shell.nav.users", icon: "people", tintKey: "accentStrong" },
];

// Isolated coin display — subscribes to Zustand independently so coin
// updates never re-render the shell or its children.
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
        paddingVertical: 7,
        shadowColor: "rgba(120,53,15,0.25)",
        shadowOpacity: 1,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
        elevation: 4,
      }}
    >
      <CoinIcon size={20} />
      <Text className="font-nunito-extrabold text-sm text-secondaryText">{coins.toLocaleString()}</Text>
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

  return (
    <View className="flex-1">
      <AdminBackground>
        <View
          className="flex-row items-center justify-between px-4 pb-[10]"
          style={{ paddingTop: insets.top + 12 }}
        >
          <CoinPill />

          <Pressable
            onPress={() => router.replace("/(tabs)" as any)}
            className="flex-row items-center gap-2 rounded-full px-[14] py-[10]"
            style={{
              backgroundColor: tc.primaryText,
              shadowColor: tc.primaryStrong,
              shadowOpacity: 0.25,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 3 },
              elevation: 4,
            }}
          >
            <HomeIcon size={18} color="#FFFFFF" />
            <Text className="text-white font-nunito-bold text-[13px]">{t("admin.shell.backToGame")}</Text>
          </Pressable>
        </View>

        <View className="flex-1">{children}</View>

        <View
          className="flex-row border-t border-primaryBorder/22 bg-primaryTint/94 pt-2 px-1"
          style={{ paddingBottom: Math.max(insets.bottom, 10) }}
        >
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.path || (pathname === "/admin" && item.path === "/admin/cards");
            const tint = tc[item.tintKey];
            return (
              <Pressable
                key={item.path}
                onPress={() => router.replace(item.path as any)}
                className="flex-1 items-center justify-center gap-1"
              >
                <View
                  className="w-[34] h-[28] rounded-[10] items-center justify-center"
                  style={active ? { backgroundColor: "rgba(255,255,255,0.46)" } : undefined}
                >
                  {item.path === "/admin/cards" ? (
                    <CardsIcon size={20} color={active ? tint : tc.muted} />
                  ) : (
                    <Ionicons name={item.icon} size={20} color={active ? tint : tc.muted} />
                  )}
                </View>
                <Text
                  className="font-nunito-extrabold text-[10px]"
                  style={{ color: active ? tint : tc.fgMuted }}
                >
                  {t(item.labelKey)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </AdminBackground>
    </View>
  );
}
