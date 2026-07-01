import { Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import { LoadingPanel } from "../src/components/loading-state";
import { PageErrorState } from "../src/components/error-state";
import { LoadoutCardDetailsContent } from "../src/components/pvp/loadout-card-details-content";
import { apiClient } from "../src/lib/api";
import { useTranslation } from "../src/i18n";
import { BattleFullScreenSheet } from "../src/features/pvp/battle-full-screen-sheet";

export default function PvpCardDetailsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ cardId?: string }>();

  const { data: collectionQueryData, error: collectionQueryError, isError: collectionQueryIsError, isLoading: collectionQueryIsLoading, refetch: collectionQueryRefetch } = useQuery({
    queryKey: ["collection"],
    queryFn: () => apiClient.collection(),
  });

  const card =
    collectionQueryData?.cards.find((entry) => entry.cardId === params.cardId)
      ?.card ?? null;

  return (
    <BattleFullScreenSheet
      visible
      title={t("pvp.cardDetailsTitle")}
      onClose={() => router.back()}
      scrollable={false}
      testID="pvp-card-details-modal"
    >
      <View className="flex-1 bg-bg">
        {collectionQueryIsLoading ? (
          <View className="flex-1 items-center justify-center px-6">
            <LoadingPanel
              title={t("pvp.cardDetailsTitle")}
              message={t("common.loadingStates.sectionBody")}
              icon="sparkles"
            />
          </View>
        ) : collectionQueryIsError ? (
          <PageErrorState
            error={collectionQueryError}
            title={t("messages.somethingWentWrong")}
            onRetry={() => {
              void collectionQueryRefetch();
            }}
            onBack={() => router.back()}
          />
        ) : !card ? (
          <View className="flex-1 items-center justify-center px-6">
            <Text className="text-center font-nunito text-fgMuted">
              {t("pvp.cardMissingTitle")}
            </Text>
          </View>
        ) : (
          <LoadoutCardDetailsContent
            card={card}
            onClose={() => router.back()}
          />
        )}
      </View>
    </BattleFullScreenSheet>
  );
}
