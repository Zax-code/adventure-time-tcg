import { useQuery } from "@tanstack/react-query";
import { ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiClient } from "../src/lib/api";
import { ThemedExpoButton } from "../src/components/expo-ui/themed-button";
import { SectionErrorState } from "../src/components/error-state";
import { LoadingPanel } from "../src/components/loading-state";
import { useTranslation } from "../src/i18n";
import { useThemeStore } from "../src/stores/theme-store";
import { THEME_COLORS } from "../src/theme/themes";
import { ChevronRightIcon, ClockIcon, SwordsIcon } from "../src/components/icons";

function formatDate(
  dateStr: string,
  t: (key: string, params?: Record<string, string | number>) => string,
) {
  const date = new Date(dateStr);
  const diffMins = Math.floor((Date.now() - date.getTime()) / 60000);

  if (diffMins < 1) return t("time.justNow");
  if (diffMins < 60) return t("time.minutesAgo", { count: diffMins });

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PvpSpectateScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const tc = THEME_COLORS[useThemeStore((state) => state.themeName)];

  const spectateQuery = useQuery({
    queryKey: ["pvp-spectate"],
    queryFn: () => apiClient.pvpSpectate(),
    refetchInterval: 10_000,
  });

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ paddingBottom: 32 }}>
      <View
        className="border-b border-primaryTint bg-white/90 px-4 pb-4"
        style={{ paddingTop: insets.top + 8 }}
      >
        <View className="flex-row items-center gap-3">
          <ThemedExpoButton
            onPress={() => router.push("/(tabs)/pvp")}
            variant="ghost"
            fallbackAppearance={{
              backgroundColor: "transparent",
              borderColor: "transparent",
              borderRadius: 12,
              foregroundColor: tc.fgMuted,
              gradientColors: null,
              minHeight: 36,
              paddingHorizontal: 8,
              paddingVertical: 8,
            }}
            style={{ minHeight: 36, minWidth: 36 }}
          >
            <View style={{ transform: [{ rotate: "180deg" }] }}>
              <ChevronRightIcon size={20} color={tc.fgMuted} />
            </View>
          </ThemedExpoButton>
          <View>
            <Text className="font-nunito-extrabold text-2xl text-infoDark">
              {t("pvp.spectateTitle")}
            </Text>
            <Text className="font-nunito text-sm text-fgMuted">
              {t("pvp.spectateSubtitle")}
            </Text>
          </View>
        </View>
      </View>

      <View className="px-4 pt-5">
        {spectateQuery.isLoading ? (
          <LoadingPanel
            title={t("pvp.spectateTitle")}
            message={t("common.loadingStates.rosterBody")}
            icon="eye"
          />
        ) : spectateQuery.isError ? (
          <SectionErrorState
            error={spectateQuery.error}
            title={t("pvp.failedLoadMatch")}
            onRetry={() => {
              void spectateQuery.refetch();
            }}
          />
        ) : (spectateQuery.data?.matches.length ?? 0) === 0 ? (
          <View className="items-center rounded-2xl border border-primaryTint bg-surface p-8">
            <SwordsIcon size={48} color={tc.primaryBorder} />
            <Text className="mt-4 font-nunito-bold text-lg text-fg">
              {t("pvp.noOngoingMatches")}
            </Text>
          </View>
        ) : (
          <View className="gap-3">
            {spectateQuery.data!.matches.map((match) => (
              <ThemedExpoButton
                key={match.id}
                onPress={() => router.push(`/pvp-spectate-match?id=${match.id}` as never)}
                preferFallback
                variant="secondary"
                fallbackLayout="stretch"
                fallbackAppearance={{
                  backgroundColor: tc.surface,
                  borderColor: tc.infoBorder,
                  borderRadius: 16,
                  foregroundColor: tc.fg,
                  gradientColors: null,
                  minHeight: 0,
                  paddingHorizontal: 16,
                  paddingVertical: 16,
                }}
              >
                <View className="flex-row items-center gap-4">
                  <View className="items-center gap-1.5">
                    <View className="flex-row items-center gap-1 rounded-full bg-infoTint px-2 py-1">
                      <View className="h-1.5 w-1.5 rounded-full bg-info" />
                      <Text className="font-nunito-extrabold text-[10px] uppercase text-infoDark">
                        {t("pvp.live")}
                      </Text>
                    </View>
                    <View className="rounded-md bg-info px-2 py-1">
                      <Text className="font-nunito-bold text-[10px] text-white">
                        T{match.currentTurn}
                      </Text>
                    </View>
                  </View>

                  <View className="flex-1">
                    <Text className="font-nunito-bold text-fg">
                      {(match.inviterName ?? match.inviterId.slice(0, 8))} vs{" "}
                      {(match.inviteeName ?? match.inviteeId.slice(0, 8))}
                    </Text>
                    <View className="mt-1 flex-row items-center gap-2">
                      <ClockIcon size={14} color={tc.fgMuted} />
                      <Text className="font-nunito text-sm text-fgMuted">
                        {formatDate(match.updatedAt ?? match.createdAt, t)}
                      </Text>
                    </View>
                  </View>

                  <Text className="font-nunito-semibold text-infoDark">
                    {t("pvp.spectateNow")}
                  </Text>
                </View>
              </ThemedExpoButton>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
