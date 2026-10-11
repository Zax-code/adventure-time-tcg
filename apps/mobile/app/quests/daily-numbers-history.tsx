import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { FlatList, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Archive from "lucide-react-native/icons/archive";

import type {
  DailyNumbersArchiveHistoryResponse,
  DailyNumbersArchiveModeSummary,
} from "@adventure-time/api-client";

import { PageErrorState } from "../../src/components/error-state";
import { PageLoadingState } from "../../src/components/loading-state";
import { Card } from "../../src/components/ui/card";
import { Notice } from "../../src/components/ui/notice";
import {
  DAILY_NUMBERS_MODES,
  getModeLabelKey,
} from "../../src/features/quests/daily-numbers/shared";
import { navigateBackFromQuest } from "../../src/features/quests/quest-navigation";
import { QuestScreenHeader } from "../../src/features/quests/quest-screen-header";
import { useTranslation } from "../../src/i18n";
import { apiClient } from "../../src/lib/api";

function formatArchiveDate(dateKey: string, locale: string) {
  const [year, month, day] = dateKey.split("-").map((part) => Number(part));
  const date = new Date(year, month - 1, day);

  if (Number.isNaN(date.getTime())) {
    return dateKey;
  }

  return date.toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// One Stat Tile per mode: success tone once the mode has a result, neutral
// while it is unplayed.
function ArchiveModeTile({
  date,
  modeSummary,
}: {
  date: string;
  modeSummary: DailyNumbersArchiveModeSummary;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const played = modeSummary.status !== "unplayed";
  const modeLabel = t(getModeLabelKey(modeSummary.mode));
  const statusLabel = played
    ? t("quests.dailyNumbers.archiveStatusPlayed")
    : t("quests.dailyNumbers.archiveStatusUnplayed");
  const resultCopy =
    modeSummary.finalValue == null
      ? t("quests.dailyNumbers.archiveNoResult")
      : modeSummary.exact || modeSummary.distance === 0
        ? t("quests.dailyNumbers.archiveResultExact", {
            value: modeSummary.finalValue,
          })
        : t("quests.dailyNumbers.archiveResultDistance", {
            value: modeSummary.finalValue,
            distance: modeSummary.distance ?? 0,
          });
  const container = played
    ? "border-successBorder bg-successTint"
    : "border-primaryBorder bg-surface";
  const muted = played ? "text-successText" : "text-fgMuted";
  const strong = played ? "text-successText" : "text-fg";

  return (
    <Pressable
      testID={`daily-numbers-archive-mode-${modeSummary.mode}`}
      onPress={() =>
        router.push(
          `/quests/daily-numbers-play?archiveDate=${date}&mode=${modeSummary.mode}` as never,
        )
      }
      className={`min-w-0 flex-1 gap-ds-1 rounded-ds-md border px-ds-4 py-ds-3 active:opacity-70 ${container}`}
      accessibilityRole="button"
      accessibilityLabel={`${t("quests.dailyNumbers.archiveOpenMode", {
        mode: modeLabel,
        date,
      })}. ${statusLabel}. ${resultCopy}`}
    >
      <Text
        className={`font-nunito-bold text-ds-caption ${muted}`}
        numberOfLines={1}
      >
        {modeLabel}
      </Text>
      <Text
        className={`font-nunito-extrabold text-ds-body ${strong}`}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
      >
        {statusLabel}
      </Text>
      <Text
        className={`font-nunito text-ds-caption ${muted}`}
        numberOfLines={2}
      >
        {resultCopy}
      </Text>
    </Pressable>
  );
}

type ArchiveDay = DailyNumbersArchiveHistoryResponse["days"][number];

function getArchiveDayKey(day: ArchiveDay) {
  return day.date;
}

function ArchiveListHeader() {
  const { t } = useTranslation();

  return (
    <Notice
      tone="info"
      icon={Archive}
      title={t("quests.dailyNumbers.archiveResultLabel")}
      body={t("quests.dailyNumbers.archiveListSubtitle")}
      testID="daily-numbers-archive-pill"
    />
  );
}

function ArchiveDaySeparator() {
  return <View className="h-ds-3" />;
}

function ArchiveDayCard({ day }: { day: ArchiveDay }) {
  const { locale, t } = useTranslation();

  return (
    <Card testID={`daily-numbers-archive-day-${day.date}`}>
      <View>
        <Text
          accessibilityRole="header"
          className="font-nunito-extrabold text-ds-h3 text-fg"
        >
          {formatArchiveDate(day.date, locale)}
        </Text>
        <Text className="font-nunito text-ds-caption text-fgMuted">
          {t("quests.dailyNumbers.archiveDateMeta", { date: day.date })}
        </Text>
      </View>
      <View className="flex-row gap-ds-2">
        {DAILY_NUMBERS_MODES.map((mode) => {
          const modeSummary = day.modes.find((item) => item.mode === mode);
          if (!modeSummary) {
            return null;
          }

          return (
            <ArchiveModeTile
              key={mode}
              date={day.date}
              modeSummary={modeSummary}
            />
          );
        })}
      </View>
    </Card>
  );
}

function renderArchiveDay({ item }: { item: ArchiveDay }) {
  return <ArchiveDayCard day={item} />;
}

export default function DailyNumbersHistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const {
    data: history,
    error,
    isError,
    isLoading,
    isPending,
    refetch,
  } = useQuery({
    queryKey: ["daily-numbers-archive-history"],
    queryFn: () => apiClient.dailyNumbersArchiveHistory(),
  });

  if (isLoading || isPending) {
    return (
      <PageLoadingState
        title={t("quests.dailyNumbers.archiveTitle")}
        message={t("common.loadingStates.pageBody")}
        icon="sparkles"
      />
    );
  }

  if (isError || !history) {
    return (
      <PageErrorState
        error={error}
        title={t("quests.dailyNumbers.archiveLoadError")}
        body={t("common.errorStates.generic.body")}
        detail={t("common.errorStates.generic.detail")}
        onRetry={() => {
          void refetch();
        }}
        onBack={() => navigateBackFromQuest(router, "/(tabs)/quests")}
        backLabel={t("quests.dailyNumbers.backToQuests")}
      />
    );
  }

  return (
    <View className="flex-1 bg-bg" style={{ paddingTop: insets.top }}>
      <QuestScreenHeader
        title={t("quests.dailyNumbers.historyTitle")}
        backLabel={t("quests.dailyNumbers.backToQuests")}
        backTestID="daily-numbers-history-back"
        fallbackHref="/(tabs)/quests"
      />

      <FlatList
        className="flex-1 bg-bg"
        contentContainerClassName="px-ds-4 pt-ds-3"
        contentContainerStyle={{ paddingBottom: 24 }}
        contentInset={{ bottom: insets.bottom }}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        data={history.days}
        keyExtractor={getArchiveDayKey}
        ListHeaderComponentClassName="mb-ds-3"
        ListHeaderComponent={ArchiveListHeader}
        ItemSeparatorComponent={ArchiveDaySeparator}
        renderItem={renderArchiveDay}
      />
    </View>
  );
}
