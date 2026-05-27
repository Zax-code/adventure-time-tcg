import { Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LoadingPanel } from "../src/components/loading-state";
import { LoadoutCardDetailsContent } from "../src/components/pvp/loadout-card-details-content";
import { apiClient } from "../src/lib/api";
import { useTranslation } from "../src/i18n";

export default function PvpCardDetailsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ cardId?: string }>();

  const collectionQuery = useQuery({
    queryKey: ["collection"],
    queryFn: () => apiClient.collection(),
  });

  const card = collectionQuery.data?.cards.find((entry) => entry.cardId === params.cardId)?.card ?? null;

  return (
    <View className="flex-1 bg-bg">
      <View className="h-1 w-9 self-center rounded-full bg-muted" style={{ marginTop: 8, marginBottom: 4 }} />

      <View className="items-center border-b border-primaryTint px-6 py-4">
        <Text className="font-nunito-extrabold text-2xl text-fg">
          {t("pvp.cardDetailsTitle")}
        </Text>
      </View>

      {collectionQuery.isLoading ? (
        <View className="flex-1 items-center justify-center px-6">
          <LoadingPanel
            title={t("pvp.cardDetailsTitle")}
            message={t("common.loadingStates.sectionBody")}
            icon="sparkles"
          />
        </View>
      ) : collectionQuery.isError ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center font-nunito text-danger">
            {collectionQuery.error instanceof Error
              ? collectionQuery.error.message
              : t("messages.somethingWentWrong")}
          </Text>
        </View>
      ) : !card ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center font-nunito text-fgMuted">
            {t("pvp.cardMissingTitle")}
          </Text>
        </View>
      ) : (
        <LoadoutCardDetailsContent card={card} onClose={() => router.back()} />
      )}

      <View style={{ height: insets.bottom }} />
    </View>
  );
}
