import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Coins from "lucide-react-native/icons/coins";
import Gift from "lucide-react-native/icons/gift";
import Settings from "lucide-react-native/icons/settings";
import Shield from "lucide-react-native/icons/shield";

import { useTranslation } from "../i18n";
import { apiClient } from "../lib/api";
import { useSessionStore } from "../stores/session-store";
import { ICON_STROKE_WIDTH, useThemePalette } from "./ui/tokens";
import { IconButton } from "./ui/icon-button";

// The coin balance at the left of the app and admin headers.
export function CoinChip() {
  const tc = useThemePalette();
  const coins = useSessionStore((state) => state.user?.coins ?? 0);

  return (
    <View
      testID="app-header-coins"
      className="h-control-sm flex-row items-center gap-[6px] rounded-ds-pill border border-secondaryBorder bg-secondaryTint px-[14px]"
    >
      <Coins size={16} color={tc.secondaryText} strokeWidth={ICON_STROKE_WIDTH} />
      <Text className="font-nunito-bold text-[14px] text-secondaryText">
        {coins}
      </Text>
    </View>
  );
}

// Tab screens only: coin balance on the left, header actions on the right,
// 56 high on a transparent background. Never renders a title; the screen's
// PageTitle sits right below it.
export function AppHeader() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const isAdmin = useSessionStore((state) => state.user?.isAdmin ?? false);
  const { data: giftsQueryData } = useQuery({
    queryKey: ["gifts"],
    queryFn: () => apiClient.gifts(),
    staleTime: 30_000,
  });
  const pendingGifts = giftsQueryData?.pendingCount ?? 0;

  return (
    <View style={{ paddingTop: insets.top }}>
      <View className="h-header flex-row items-center justify-between px-ds-4 py-ds-2">
        <CoinChip />

        <View className="flex-row items-center gap-ds-2">
          <View>
            <IconButton
              icon={Gift}
              accessibilityLabel={t("nav.gifts")}
              onPress={() => router.push("/(tabs)/gifts" as never)}
              hitSlop={4}
              testID="app-header-gifts-button"
            />
            {pendingGifts > 0 ? (
              <View
                pointerEvents="none"
                className="absolute -right-1 -top-1 min-w-[18px] items-center rounded-ds-pill bg-dangerDark px-1 py-[1px]"
              >
                <Text className="font-nunito-bold text-[11px] text-white">
                  {pendingGifts > 9 ? "9+" : pendingGifts}
                </Text>
              </View>
            ) : null}
          </View>

          {isAdmin ? (
            <IconButton
              icon={Shield}
              tone="accent"
              tinted
              accessibilityLabel={t("admin.shell.consoleTitle")}
              onPress={() => router.push("/admin/cards" as never)}
              hitSlop={4}
              testID="app-header-admin-button"
            />
          ) : null}

          <IconButton
            icon={Settings}
            accessibilityLabel={t("settings.title")}
            onPress={() => router.push("/settings")}
            hitSlop={4}
            testID="app-header-settings-button"
          />
        </View>
      </View>
    </View>
  );
}
