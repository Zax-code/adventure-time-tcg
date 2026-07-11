import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type {
  DailyNumbersArchiveModeSummary,
  DailyNumbersArchiveStatus,
} from "@adventure-time/api-client";

import { PageErrorState } from "../../src/components/error-state";
import { PageLoadingState } from "../../src/components/loading-state";
import {
  DAILY_NUMBERS_MODES,
  getModeAccent,
  getModeLabelKey,
} from "../../src/features/quests/daily-numbers/shared";
import {
  navigateBackFromQuest,
  QuestScreenDescription,
  QuestScreenHeader,
} from "../../src/features/quests/quest-screen-header";
import { useTranslation } from "../../src/i18n";
import { apiClient } from "../../src/lib/api";
import { useThemeStore } from "../../src/stores/theme-store";
import { THEME_COLORS } from "../../src/theme/themes";

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

function getStatusLabelKey(status: DailyNumbersArchiveStatus) {
  if (status === "exact") {
    return "quests.dailyNumbers.archiveStatusExact";
  }

  if (status === "solved") {
    return "quests.dailyNumbers.archiveStatusSolved";
  }

  if (status === "tried") {
    return "quests.dailyNumbers.archiveStatusTried";
  }

  return "quests.dailyNumbers.archiveStatusUnplayed";
}

function getStatusTone(
  status: DailyNumbersArchiveStatus,
  tc: (typeof THEME_COLORS)[keyof typeof THEME_COLORS],
) {
  if (status === "exact") {
    return {
      bg: tc.successTint,
      border: tc.successBorder,
      text: tc.successText,
    };
  }

  if (status === "solved") {
    return {
      bg: tc.infoTint,
      border: tc.infoBorder,
      text: tc.infoText,
    };
  }

  if (status === "tried") {
    return {
      bg: tc.dangerTint,
      border: tc.dangerBorder,
      text: tc.dangerText,
    };
  }

  return {
    bg: tc.surface,
    border: tc.primaryBorder,
    text: tc.fgMuted,
  };
}

function ArchiveModeChip({
  date,
  modeSummary,
}: {
  date: string;
  modeSummary: DailyNumbersArchiveModeSummary;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const tc = THEME_COLORS[useThemeStore((state) => state.themeName)];
  const modeAccent = getModeAccent(modeSummary.mode, tc);
  const statusTone = getStatusTone(modeSummary.status, tc);
  const resultCopy =
    modeSummary.distance == null
      ? t("quests.dailyNumbers.archiveNoResult")
      : modeSummary.distance === 0
        ? t("quests.dailyNumbers.archiveExactShort")
        : t("quests.dailyNumbers.archiveDistanceShort", {
            distance: modeSummary.distance,
          });

  return (
    <Pressable
      testID={`daily-numbers-archive-mode-${modeSummary.mode}`}
      onPress={() =>
        router.push(
          `/quests/daily-numbers-play?archiveDate=${date}&mode=${modeSummary.mode}` as never,
        )
      }
      className="flex-1 rounded-2xl border px-3 py-3"
      style={{
        minWidth: 96,
        borderColor: statusTone.border,
        backgroundColor: statusTone.bg,
      }}
      accessibilityRole="button"
      accessibilityLabel={t("quests.dailyNumbers.archiveOpenMode", {
        mode: t(getModeLabelKey(modeSummary.mode)),
        date,
      })}
    >
      <Text
        className="text-center font-nunito-extrabold text-base"
        style={{ color: modeAccent.text }}
      >
        {t(getModeLabelKey(modeSummary.mode))}
      </Text>
      <Text
        className="mt-1 text-center font-nunito-bold text-[11px]"
        style={{ color: statusTone.text }}
      >
        {t(getStatusLabelKey(modeSummary.status))}
      </Text>
      <Text className="mt-1 text-center font-nunito-semibold text-[11px] text-fgMuted">
        {resultCopy}
      </Text>
    </Pressable>
  );
}

export default function DailyNumbersHistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { locale, t } = useTranslation();
  const tc = THEME_COLORS[useThemeStore((state) => state.themeName)];
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
    <View className="flex-1 bg-bg">
      <View
        className="bg-bg pb-2"
        style={{
          paddingTop: insets.top + 12,
          paddingHorizontal: 14,
        }}
      >
        <QuestScreenHeader
          title={t("quests.dailyNumbers.title")}
          backLabel={t("quests.dailyNumbers.backToQuests")}
          backTestID="daily-numbers-history-back"
          fallbackHref="/(tabs)/quests"
        />
      </View>

      <ScrollView className="flex-1 bg-bg">
        <View
          style={{
            paddingTop: 8,
            paddingBottom: insets.bottom + 20,
            paddingHorizontal: 14,
          }}
        >
          <QuestScreenDescription>
            {t("quests.dailyNumbers.archiveListSubtitle")}
          </QuestScreenDescription>

          <View className="gap-3">
            <View
              className="self-center rounded-full border px-4 py-1.5"
              style={{
                backgroundColor: tc.secondaryDark,
                borderColor: tc.secondaryBorder,
              }}
              testID="daily-numbers-archive-pill"
            >
              <Text
                className="text-center font-nunito-extrabold text-xs uppercase tracking-[1px]"
                style={{ color: tc.secondaryText }}
              >
                {t("quests.dailyNumbers.archiveResultLabel")}
              </Text>
            </View>
          </View>

          <View className="mt-5 gap-3">
            {history.days.map((day) => (
              <View
                key={day.date}
                className="rounded-2xl border bg-surface p-4"
                style={{ borderColor: tc.primaryBorder }}
              >
                <Text className="font-nunito-extrabold text-lg text-fg">
                  {formatArchiveDate(day.date, locale)}
                </Text>
                <Text className="mt-1 font-nunito-semibold text-xs text-fgMuted">
                  {t("quests.dailyNumbers.archiveDateMeta", { date: day.date })}
                </Text>
                <View className="mt-3 flex-row flex-wrap gap-2">
                  {DAILY_NUMBERS_MODES.map((mode) => {
                    const modeSummary = day.modes.find(
                      (item) => item.mode === mode,
                    );
                    if (!modeSummary) {
                      return null;
                    }

                    return (
                      <ArchiveModeChip
                        key={mode}
                        date={day.date}
                        modeSummary={modeSummary}
                      />
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
