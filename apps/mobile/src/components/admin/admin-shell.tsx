import type { ReactNode } from "react";
import { useEffect } from "react";
import { InteractionManager, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePathname, useRouter } from "expo-router";
import Copy from "lucide-react-native/icons/copy";
import House from "lucide-react-native/icons/house";
import Images from "lucide-react-native/icons/images";
import Layers from "lucide-react-native/icons/layers";
import Package from "lucide-react-native/icons/package";
import Star from "lucide-react-native/icons/star";
import Settings from "lucide-react-native/icons/settings";
import Users from "lucide-react-native/icons/users";
import Zap from "lucide-react-native/icons/zap";
import type { LucideIcon } from "lucide-react-native";

import { BottomTabBarFrame, TabBarItem } from "../bottom-tab-bar-frame";
import { CoinChip } from "../app-header";
import { IconButton } from "../ui/icon-button";
import { PageTitle } from "../ui/page-title";
import { useTranslation } from "../../i18n";
import { apiClient } from "../../lib/api";
import { queryClient } from "../../lib/query-client";
import { useSessionStore } from "../../stores/session-store";
import { AdminBackground } from "./admin-ui";

const NAV_ITEMS: { path: string; labelKey: string; icon: LucideIcon }[] = [
  { path: "/admin/cards", labelKey: "admin.shell.nav.cards", icon: Layers },
  { path: "/admin/packs", labelKey: "admin.shell.nav.packs", icon: Package },
  {
    path: "/admin/card-back-visuals",
    labelKey: "admin.shell.nav.cardBacks",
    icon: Copy,
  },
  {
    path: "/admin/image-assets",
    labelKey: "admin.shell.nav.assets",
    icon: Images,
  },
  { path: "/admin/featured", labelKey: "admin.shell.nav.featured", icon: Star },
  { path: "/admin/abilities", labelKey: "admin.shell.nav.abilities", icon: Zap },
  { path: "/admin/users", labelKey: "admin.shell.nav.users", icon: Users },
];

const ADMIN_PREFETCH_STALE_TIME = 5 * 60 * 1000;

export function AdminShell({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const isSuperAdmin = useSessionStore(
    (state) => state.user?.isSuperAdmin ?? false,
  );
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
        <View style={{ paddingTop: insets.top }}>
          <View className="h-header flex-row items-center justify-between px-ds-4 py-ds-2">
            <CoinChip />
            <View className="flex-row items-center gap-ds-2">
              <IconButton
                icon={House}
                tone="accent"
                tinted
                accessibilityLabel={t("nav.home")}
                onPress={() => router.replace("/(tabs)" as never)}
                hitSlop={4}
                testID="admin-header-home-button"
              />
              <IconButton
                icon={Settings}
                accessibilityLabel={t("settings.title")}
                onPress={() => router.push("/settings")}
                hitSlop={4}
                testID="admin-header-settings-button"
              />
            </View>
          </View>
          <PageTitle title={t("admin.shell.consoleTitle")} className="px-ds-4 pb-ds-3" />
        </View>

        <View className="flex-1">{children}</View>

        <BottomTabBarFrame
          activeIndex={activeTabIndex}
          itemCount={NAV_ITEMS.length}
        >
          <View className="flex-1 flex-row items-stretch">
            {NAV_ITEMS.map((item) => (
              <TabBarItem
                key={item.path}
                icon={item.icon}
                label={t(item.labelKey)}
                focused={
                  pathname === item.path ||
                  (pathname === "/admin" && item.path === "/admin/cards")
                }
                onPress={() => router.replace(item.path as never)}
              />
            ))}
          </View>
        </BottomTabBarFrame>
      </View>
    </AdminBackground>
  );
}
