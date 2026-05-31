import { useEffect } from "react";
import { StatusBar, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import * as ScreenOrientation from "expo-screen-orientation";

import { PageLoadingState } from "../src/components/loading-state";
import { PageErrorState } from "../src/components/error-state";
import { BattleBoard } from "../src/features/pvp/battle-board";
import { buildSpectateMatchView } from "../src/features/pvp/read-only-view";
import { useTranslation } from "../src/i18n";
import { apiClient } from "../src/lib/api";
import { useThemeStore } from "../src/stores/theme-store";
import { THEME_VARS } from "../src/theme/themes";

export default function PvpSpectateMatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const themeName = useThemeStore((state) => state.themeName);
  const { t } = useTranslation();

  const spectateQuery = useQuery({
    queryKey: ["pvp-spectate", id],
    queryFn: () => apiClient.pvpSpectateMatch(id ?? ""),
    enabled: Boolean(id),
    retry: 0,
    refetchInterval: (query) => (query.state.status === "error" ? false : 3000),
  });

  const matchView = buildSpectateMatchView(spectateQuery.data?.battleState);

  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.DEFAULT).catch(() => {});
    };
  }, []);

  if (spectateQuery.isLoading) {
    return (
      <PageLoadingState
        title={t("pvp.loadingBattle")}
        message={t("common.loadingStates.battleBody")}
        icon="flame"
      />
    );
  }

  if (spectateQuery.isError && !matchView) {
    return (
      <PageErrorState
        error={spectateQuery.error}
        title={t("pvp.failedLoadMatch")}
        onRetry={() => {
          void spectateQuery.refetch();
        }}
        onBack={() => router.push("/pvp-spectate" as never)}
      />
    );
  }

  if (!matchView) {
    return (
      <View style={[styles.loading, THEME_VARS[themeName] as never]}>
        <Text style={styles.loadingText}>{t("pvp.matchNotFound")}</Text>
        <Text style={styles.linkText} onPress={() => router.push("/pvp-spectate" as never)}>
          {t("pvp.backToPvp")}
        </Text>
      </View>
    );
  }

  const isCompleted = spectateQuery.data?.match.status === "COMPLETED";

  return (
    <View style={[styles.container, THEME_VARS[themeName] as never]}>
      <StatusBar hidden />

      {isCompleted ? (
        <View className="absolute left-2 right-2 top-2 z-40 rounded-xl bg-secondaryTint px-4 py-3">
          <Text className="text-center font-nunito-semibold text-secondaryText">
            {t("pvp.matchEnded")}
          </Text>
        </View>
      ) : null}

      <BattleBoard
        matchView={matchView}
        newEvents={[]}
        isActing={false}
        pendingSwap={null}
        isSwapMode={false}
        targeting={null}
        onSelectUnit={() => {}}
        onSelectTarget={() => {}}
        onSelectBench={() => {}}
        onUnitLongPress={() => {}}
        onSwapToggle={() => {}}
        onCancelTargeting={() => {}}
        onEndTurn={() => {}}
        onConcede={() => {}}
        onBack={() => router.push("/pvp-spectate" as never)}
        onEnterTargeting={(_mode) => {}}
        submitAction={(_action) => {}}
        submitEndTurn={(_input) => {}}
        readOnly
      />
    </View>
  );
}

const styles = {
  container: {
    flex: 1,
  },
  loading: {
    flex: 1,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    paddingHorizontal: 24,
    gap: 12,
  },
  loadingText: {
    color: "#fff",
    fontSize: 18,
    fontFamily: "Nunito_700Bold",
    textAlign: "center" as const,
  },
  linkText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Nunito_700Bold",
  },
};
