import type { ReactNode } from "react";
import { memo, useEffect } from "react";
import {
  InteractionManager,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePathname, useRouter } from "expo-router";
// oxlint-disable-next-line react-doctor/rn-no-legacy-expo-packages -- False positive: the rule docs only identify expo-av and expo-permissions as legacy packages.
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@react-native-vector-icons/ionicons";

import { BottomTabBarFrame, type ThemeColorKey } from "../bottom-tab-bar-frame";
import { CoinIcon, CardsIcon, HomeIcon, PackIcon, SettingsIcon } from "../icons";
import { useTranslation } from "../../i18n";
import { apiClient } from "../../lib/api";
import { queryClient } from "../../lib/query-client";
import { useSessionStore } from "../../stores/session-store";
import { useThemeStore } from "../../stores/theme-store";
import { THEME_COLORS } from "../../theme/themes";
import { withAlpha } from "./admin-palette";
import { AdminBackground } from "./admin-ui";

const NAV_ITEMS: {
  path: string;
  labelKey: string;
  icon: "albums" | "copy" | "cube" | "images" | "star" | "flash" | "people";
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
    path: "/admin/card-back-visuals",
    labelKey: "admin.shell.nav.cardBacks",
    icon: "copy",
    tintKey: "accentText",
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

const ADMIN_PREFETCH_STALE_TIME = 5 * 60 * 1000;

const CoinPill = memo(function CoinPill() {
  const coins = useSessionStore((state) => state.user?.coins ?? 0);
  const { themeName } = useThemeStore();
  const tc = THEME_COLORS[themeName];

  return (
    <LinearGradient
      colors={[tc.secondary, tc.secondaryDark]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={[
        styles.coinPill,
        { boxShadow: `0px 4px 8px ${withAlpha(tc.fg, "1F")}` },
      ]}
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
  const isSuperAdmin = useSessionStore(
    (state) => state.user?.isSuperAdmin ?? false,
  );
  const { themeName } = useThemeStore();
  const tc = THEME_COLORS[themeName];
  const { t } = useTranslation();
  const activeTabIndex = Math.max(
    NAV_ITEMS.findIndex(
      (item) =>
        pathname === item.path ||
        (pathname === "/admin" && item.path === "/admin/cards"),
    ),
    0,
  );

  useEffect(() => {
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const handle = InteractionManager.runAfterInteractions(() => {
      if (cancelled) {
        return;
      }

      const warmups = [
        () =>
          queryClient.prefetchQuery({
            queryKey: ["admin-cards"],
            queryFn: () => apiClient.adminCards(),
            staleTime: ADMIN_PREFETCH_STALE_TIME,
          }),
        () =>
          queryClient.prefetchQuery({
            queryKey: ["admin-rarities"],
            queryFn: () => apiClient.rarities(),
            staleTime: ADMIN_PREFETCH_STALE_TIME,
          }),
        () =>
          queryClient.prefetchQuery({
            queryKey: ["admin-packs"],
            queryFn: () => apiClient.adminPacks(),
            staleTime: ADMIN_PREFETCH_STALE_TIME,
          }),
        () =>
          queryClient.prefetchQuery({
            queryKey: ["admin-card-back-visuals"],
            queryFn: () => apiClient.adminCardBackVisuals(),
            staleTime: ADMIN_PREFETCH_STALE_TIME,
          }),
        () =>
          queryClient.prefetchQuery({
            queryKey: ["admin-abilities"],
            queryFn: () => apiClient.adminAbilities(),
            staleTime: ADMIN_PREFETCH_STALE_TIME,
          }),
        () =>
          queryClient.prefetchQuery({
            queryKey: ["admin-users"],
            queryFn: () => apiClient.adminUsers(),
            staleTime: ADMIN_PREFETCH_STALE_TIME,
          }),
        () =>
          queryClient.prefetchQuery({
            queryKey: ["admin-image-assets"],
            queryFn: () => apiClient.adminImageAssets(),
            staleTime: ADMIN_PREFETCH_STALE_TIME,
          }),
        ...(isSuperAdmin
          ? [
              () =>
                queryClient.prefetchQuery({
                  queryKey: ["admin-email-requests"],
                  queryFn: () => apiClient.adminEmailRequests(),
                  staleTime: ADMIN_PREFETCH_STALE_TIME,
                }),
            ]
          : []),
      ];

      warmups.forEach((warmup, index) => {
        timers.push(
          setTimeout(() => {
            if (!cancelled) {
              void warmup();
            }
          }, index * 120),
        );
      });
    });

    return () => {
      cancelled = true;
      handle.cancel();
      timers.forEach(clearTimeout);
    };
  }, [isSuperAdmin]);

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
                    style={styles.headerGradientButton}
                  >
                    <View style={{ transform: [{ translateY: -1.5 }] }}>
                      <HomeIcon size={22} color="#FFFFFF" />
                    </View>
                  </LinearGradient>
                </Pressable>
                <Pressable onPress={() => router.push("/settings")} hitSlop={8}>
                  <View
                    style={[
                      styles.headerSurfaceButton,
                      { backgroundColor: tc.surfaceMuted },
                    ]}
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

        <BottomTabBarFrame
          activeIndex={activeTabIndex}
          itemCount={NAV_ITEMS.length}
        >
          <View className="flex-row items-center">
            {NAV_ITEMS.map((item) => {
              const active =
                pathname === item.path ||
                (pathname === "/admin" && item.path === "/admin/cards");
              const tint = tc[item.tintKey];
              const color = active ? tint : tc.fgMuted;

              return (
                <Pressable
                  key={item.path}
                  onPress={() => router.replace(item.path as any)}
                  className="flex-1 items-center justify-center gap-1 rounded-[22px] px-0 py-2"
                  style={{ minWidth: 0 }}
                >
                  {item.path === "/admin/cards" ? (
                    <CardsIcon size={24} color={color} />
                  ) : item.path === "/admin/packs" ? (
                    <PackIcon size={24} color={color} />
                  ) : (
                    <Ionicons name={item.icon} size={24} color={color} />
                  )}
                  <Text
                    className="text-center text-[9px] font-nunito-extrabold"
                    numberOfLines={1}
                    style={{
                      color,
                      flexShrink: 1,
                    }}
                  >
                    {t(item.labelKey)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </BottomTabBarFrame>
      </View>
    </AdminBackground>
  );
}

const styles = StyleSheet.create({
  coinPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  headerGradientButton: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0px 3px 8px rgba(0, 0, 0, 0.15)",
  },
  headerSurfaceButton: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.1)",
  },
});
