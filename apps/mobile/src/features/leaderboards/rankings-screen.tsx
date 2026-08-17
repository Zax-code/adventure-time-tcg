import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo, useState, type ComponentType } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";

import type {
  LeaderboardBoardKey,
  LeaderboardHistoryResponse,
  LeaderboardResponse,
  LeaderboardRow,
} from "@adventure-time/api-client";

import { PageErrorState } from "../../components/error-state";
import { SecondaryButton } from "../../components/button";
import {
  ClockIcon,
  DailyNumbersQuestIcon,
  HelpCircleIcon,
  SpeedCalculusQuestIcon,
  StepQuestIcon,
  TrophyIcon,
  WordleQuestIcon,
} from "../../components/icons";
import { PageLoadingState } from "../../components/loading-state";
import { useTranslation } from "../../i18n";
import { apiClient } from "../../lib/api";
import { useThemeStore } from "../../stores/theme-store";
import {
  useAppHeaderHeight,
  useBottomTabBarContentPadding,
} from "../../theme/layout";
import { THEME_COLORS } from "../../theme/themes";
import { LeaderboardAvatar } from "./leaderboard-avatar";
import {
  RANKINGS_PREVIEW_DATA,
  RANKINGS_TOP_SEVEN_PREVIEW_DATA,
} from "./rankings-preview-data";

type MainPeriod = "daily" | "weekly" | "history";
type LivePeriod = "today" | "yesterday" | "current_week" | "last_week";
type IconComponent = ComponentType<{ size?: number; color?: string }>;

const BOARD_OPTIONS: Array<{
  key: LeaderboardBoardKey;
  labelKey: string;
  icon: IconComponent;
}> = [
  { key: "steps/default", labelKey: "rankings.boards.steps", icon: StepQuestIcon },
  {
    key: "daily-numbers/family",
    labelKey: "rankings.boards.dailyNumbers",
    icon: DailyNumbersQuestIcon,
  },
  { key: "wordle/family", labelKey: "rankings.boards.wordle", icon: WordleQuestIcon },
  {
    key: "speed-calculus/ranked",
    labelKey: "rankings.boards.speedCalculus",
    icon: SpeedCalculusQuestIcon,
  },
  {
    key: "perfect-timing/official",
    labelKey: "rankings.boards.perfectTiming",
    icon: ClockIcon,
  },
];

export function RankingsScreen() {
  const { placement, preview, previewState } = useLocalSearchParams<{
    placement?: string;
    preview?: string;
    previewState?: string;
  }>();
  const isPreview =
    process.env.EXPO_PUBLIC_E2E_AUTH === "1" && preview === "1";
  const isLoadingPreview = isPreview && previewState === "loading";
  const { t } = useTranslation();
  const themeName = useThemeStore((state) => state.themeName);
  const tc = THEME_COLORS[themeName];
  const headerHeight = useAppHeaderHeight();
  const bottomPadding = useBottomTabBarContentPadding();
  const [mainPeriod, setMainPeriod] = useState<MainPeriod>("weekly");
  const [dailyPeriod, setDailyPeriod] = useState<"today" | "yesterday">("today");
  const [weeklyPeriod, setWeeklyPeriod] = useState<"current_week" | "last_week">(
    "current_week",
  );
  const period: LivePeriod | "history" =
    mainPeriod === "daily"
      ? dailyPeriod
      : mainPeriod === "weekly"
        ? weeklyPeriod
        : "history";
  const [boardKey, setBoardKey] = useState<LeaderboardBoardKey>(
    isLoadingPreview ? "steps/default" : "perfect-timing/official",
  );
  const modeOptions = useMemo(() => {
    if (boardKey.startsWith("daily-numbers/")) {
      return [
        { key: "daily-numbers/family", label: t("rankings.modes.combined") },
        { key: "daily-numbers/1-5", label: "1–5" },
        { key: "daily-numbers/2-4", label: "2–4" },
        { key: "daily-numbers/3-3", label: "3–3" },
      ] as const;
    }

    if (boardKey.startsWith("wordle/")) {
      return [
        { key: "wordle/family", label: t("rankings.modes.combined") },
        { key: "wordle/fr", label: t("rankings.modes.french") },
        { key: "wordle/en", label: t("rankings.modes.english") },
      ] as const;
    }

    return [];
  }, [boardKey, t]);

  const {
    data: queryData,
    error: queryError,
    isError: queryIsError,
    isFetching: queryIsFetching,
    isLoading: queryIsLoading,
    refetch: refetchLeaderboard,
  } = useQuery({
    queryKey: ["leaderboard", boardKey, period],
    queryFn: () => apiClient.leaderboard(boardKey, period as LivePeriod),
    enabled: !isPreview && period !== "history",
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    retry: 1,
  });

  const {
    data: historyData,
    error: historyError,
    isError: historyIsError,
    isFetching: historyIsFetching,
    isLoading: historyIsLoading,
    refetch: refetchHistory,
  } = useQuery({
    queryKey: ["leaderboard-history", boardKey],
    queryFn: () => apiClient.leaderboardHistory(boardKey),
    enabled: !isPreview && period === "history",
    staleTime: 5 * 60_000,
    retry: 1,
  });

  useFocusEffect(
    useCallback(() => {
      if (!isPreview) {
        if (period === "history") {
          void refetchHistory();
        } else {
          void refetchLeaderboard();
        }
      }
    }, [isPreview, period, refetchHistory, refetchLeaderboard]),
  );

  const data = useMemo<LeaderboardResponse | undefined>(() => {
    if (isLoadingPreview) return undefined;
    if (!isPreview) return queryData;
    const previewData =
      placement === "top7" ? RANKINGS_TOP_SEVEN_PREVIEW_DATA : RANKINGS_PREVIEW_DATA;
    const isDaily = mainPeriod === "daily";
    const competitionDate = dailyPeriod === "today" ? "2026-08-17" : "2026-08-16";
    const weekStart = weeklyPeriod === "current_week" ? "2026-08-17" : "2026-08-10";
    const weekEnd = weeklyPeriod === "current_week" ? "2026-08-23" : "2026-08-16";

    return {
      ...previewData,
      board: { ...previewData.board, key: boardKey },
      period: {
        ...previewData.period,
        type: isDaily ? "day" : "week",
        competitionDate: isDaily ? competitionDate : null,
        weekStart: isDaily ? null : weekStart,
        weekEnd: isDaily ? null : weekEnd,
        standingsThrough: isDaily ? competitionDate : weekEnd,
      },
    };
  }, [
    boardKey,
    dailyPeriod,
    isLoadingPreview,
    isPreview,
    mainPeriod,
    placement,
    queryData,
    weeklyPeriod,
  ]);
  const isRefreshing =
    mainPeriod === "history"
      ? historyIsFetching && Boolean(historyData)
      : queryIsFetching && Boolean(queryData);
  const onRefresh = useCallback(() => {
    if (mainPeriod === "history") {
      void refetchHistory();
    } else {
      void refetchLeaderboard();
    }
  }, [mainPeriod, refetchHistory, refetchLeaderboard]);
  const scrollContentStyle = useMemo(
    () => ({
      paddingTop: headerHeight + 18,
      paddingBottom: bottomPadding,
      paddingHorizontal: 16,
      gap: 18,
    }),
    [bottomPadding, headerHeight],
  );

  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentContainerStyle={scrollContentStyle}
      showsVerticalScrollIndicator={false}
      testID="rankings-screen"
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={tc.primaryDark} />
      }
    >
      <View className="gap-1 px-1">
        <View className="flex-row items-center gap-2">
          <TrophyIcon size={30} color={tc.primaryDark} />
          <Text selectable className="font-nunito-extrabold text-[32px] text-fg">
            {t("rankings.title")}
          </Text>
        </View>
        <Text selectable className="font-nunito text-[15px] text-fgMuted">
          {t("rankings.subtitle")}
        </Text>
        {isPreview ? (
          <Text className="font-nunito-bold text-xs text-primaryText">
            {t("rankings.previewLabel")}
          </Text>
        ) : null}
      </View>

      <View className="flex-row rounded-full border border-primaryBorder bg-surface p-1">
        {(["daily", "weekly", "history"] as MainPeriod[]).map((item) => {
          const selected = mainPeriod === item;
          return (
            <Pressable
              key={item}
              onPress={() => setMainPeriod(item)}
              className="flex-1 items-center justify-center overflow-hidden rounded-full px-2 py-3"
              testID={`rankings-period-${item}`}
            >
              {selected ? (
                <LinearGradient
                  colors={[tc.primaryDark, tc.primary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{ position: "absolute", inset: 0 }}
                />
              ) : null}
              <Text
                className={`font-nunito-bold text-sm ${selected ? "text-white" : "text-primaryText"}`}
              >
                {t(`rankings.periods.${item}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {mainPeriod === "daily" ? (
        <PeriodSelector
          options={["today", "yesterday"]}
          selected={dailyPeriod}
          onSelect={(value) => setDailyPeriod(value as "today" | "yesterday")}
        />
      ) : mainPeriod === "weekly" ? (
        <PeriodSelector
          options={["current_week", "last_week"]}
          selected={weeklyPeriod}
          onSelect={(value) => setWeeklyPeriod(value as "current_week" | "last_week")}
        />
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-3">
        {BOARD_OPTIONS.map((option) => {
          const selected =
            option.key === boardKey ||
            (option.key.startsWith("daily-numbers/") &&
              boardKey.startsWith("daily-numbers/")) ||
            (option.key.startsWith("wordle/") && boardKey.startsWith("wordle/"));
          const Icon = option.icon;
          return (
            <Pressable key={option.key} onPress={() => setBoardKey(option.key)}>
              <View
                className={`h-[92px] w-[106px] items-center justify-center gap-2 rounded-3xl border border-primaryBorder ${
                  selected ? "bg-primaryText" : "bg-surface"
                }`}
              >
                <Icon size={30} color={selected ? tc.surface : tc.primaryText} />
                <Text
                  className={`text-center font-nunito-bold text-xs ${
                    selected ? "text-surface" : "text-primaryText"
                  }`}
                >
                  {t(option.labelKey)}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      {modeOptions.length ? (
        <View className="flex-row flex-wrap gap-2">
          {modeOptions.map((option) => {
            const selected = option.key === boardKey;

            return (
              <Pressable
                key={option.key}
                onPress={() => setBoardKey(option.key)}
                className={`rounded-full border px-4 py-2 ${
                  selected
                    ? "border-primaryBorder bg-primaryTint"
                    : "border-primaryBorder bg-surface"
                }`}
              >
                <Text
                  className={`font-nunito-bold text-sm ${
                    selected ? "text-primaryText" : "text-fgMuted"
                  }`}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {period === "history" ? (
        historyIsLoading && !isPreview ? (
          <PageLoadingState
            title={t("rankings.loadingTitle")}
            message={t("rankings.loadingBody")}
            icon="trophy"
          />
        ) : historyIsError && !isPreview ? (
          <PageErrorState error={historyError} onRetry={() => void refetchHistory()} />
        ) : historyData?.weeks.length ? (
          <HistoryContent boardKey={boardKey} history={historyData} />
        ) : (
          <EmptyPanel title={t("rankings.historyTitle")} body={t("rankings.historyBody")} />
        )
      ) : isLoadingPreview || (queryIsLoading && !isPreview) ? (
        <PageLoadingState
          title={t("rankings.loadingTitle")}
          message={t("rankings.loadingBody")}
          icon="trophy"
        />
      ) : queryIsError && !isPreview ? (
        <PageErrorState error={queryError} onRetry={() => void refetchLeaderboard()} />
      ) : data ? (
        <RankingsContent data={data} preview={isPreview} />
      ) : null}
    </ScrollView>
  );
}

function PeriodSelector({
  options,
  selected,
  onSelect,
}: {
  options: LivePeriod[];
  selected: LivePeriod;
  onSelect: (value: LivePeriod) => void;
}) {
  const { t } = useTranslation();

  return (
    <View className="flex-row rounded-2xl border border-primaryBorder bg-surfaceMuted p-1">
      {options.map((option) => {
        const active = selected === option;

        return (
          <Pressable
            key={option}
            onPress={() => onSelect(option)}
            className={`flex-1 items-center rounded-xl px-3 py-2.5 ${active ? "bg-surface" : ""}`}
            testID={`rankings-period-${option}`}
          >
            <Text
              className={`font-nunito-bold text-sm ${active ? "text-primaryText" : "text-fgMuted"}`}
            >
              {t(`rankings.periods.${option}`)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function RankingsContent({ data, preview }: { data: LeaderboardResponse; preview: boolean }) {
  const { locale, t } = useTranslation();
  const router = useRouter();
  const openProfile = (row: LeaderboardRow) => {
    if (!row.profile.publicProfileId || row.profile.visibility !== "visible") return;
    router.push({
      pathname: "/public-profile",
      params: {
        id: row.profile.publicProfileId,
        ...(preview ? { preview: "1" } : {}),
      },
    } as never);
  };

  return (
    <View className="gap-4">
      <View className="items-center gap-2 rounded-2xl bg-primaryTint px-4 py-3">
        <Text selectable className="text-center font-nunito-extrabold text-base text-fg">
          {formatPeriodDate(data.period, locale)}
        </Text>
        <View className={`rounded-full px-3 py-1 ${data.period.provisional ? "bg-infoTint" : "bg-surface"}`}>
          <Text className="font-nunito-bold text-xs uppercase tracking-[1px] text-primaryText">
            {t(data.period.provisional ? "rankings.liveProvisional" : "rankings.final")}
          </Text>
        </View>
        <Text selectable className="text-center font-nunito text-xs text-fgMuted">
          {t(data.period.provisional ? "rankings.provisionalHint" : "rankings.finalHint")}
        </Text>
      </View>

      <View className="flex-row items-end justify-center gap-1 pt-3">
        {data.podium[1] ? <PodiumCard row={data.podium[1]} place={2} onPress={() => openProfile(data.podium[1])} /> : null}
        {data.podium[0] ? <PodiumCard row={data.podium[0]} place={1} onPress={() => openProfile(data.podium[0])} /> : null}
        {data.podium[2] ? <PodiumCard row={data.podium[2]} place={3} onPress={() => openProfile(data.podium[2])} /> : null}
      </View>

      <View className="overflow-hidden rounded-[28px] border border-primaryBorder bg-surface">
        {data.rows.slice(3).map((row, index) => (
          <RankingRow
            key={row.profile.handle}
            row={row}
            bordered={index > 0}
            current={isCurrentPlayer(row, data.currentPlayer)}
            onPress={() => openProfile(row)}
          />
        ))}
      </View>

      {data.currentPlayer && data.currentPlayer.rank > 7 ? (
        <View className="rounded-[24px] border-2 border-primaryBorder bg-primaryTint">
          <View className="absolute -top-2 left-1/2 size-4 rotate-45 border-l-2 border-t-2 border-primaryBorder bg-primaryTint" />
          <RankingRow row={data.currentPlayer} onPress={() => openProfile(data.currentPlayer!)} />
        </View>
      ) : null}

      <View className="flex-row items-center justify-center gap-2 px-3 py-1">
        <TrophyIcon size={18} color="#DB2777" />
        <Text className="text-center font-nunito-semibold text-xs text-fgMuted">
          {t("rankings.profileTapHint")}
        </Text>
      </View>

      <View className="flex-row items-center justify-center gap-2 py-1">
        <HelpCircleIcon size={20} color="#DB2777" />
        <Text className="font-nunito-bold text-sm text-primaryText">
          {t("rankings.scoringHelp")}
        </Text>
      </View>
    </View>
  );
}

function HistoryContent({
  boardKey,
  history,
}: {
  boardKey: LeaderboardBoardKey;
  history: LeaderboardHistoryResponse;
}) {
  return (
    <View className="gap-6">
      {history.weeks.map((week) => (
        <HistoryWeek boardKey={boardKey} key={week.period.startsAt} week={week} />
      ))}
    </View>
  );
}

function HistoryWeek({
  boardKey,
  week,
}: {
  boardKey: LeaderboardBoardKey;
  week: LeaderboardResponse;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const weekStart = week.period.startsAt.slice(0, 10);
  const days = useQuery({
    queryKey: ["leaderboard-history-days", boardKey, weekStart],
    queryFn: () => apiClient.leaderboardHistoryDays(boardKey, weekStart),
    enabled: expanded,
    staleTime: 10 * 60_000,
  });

  return (
    <View className="gap-3">
      <Text className="px-1 font-nunito-extrabold text-xl text-fg">
        {t("rankings.weekEnding", { date: week.period.standingsThrough ?? "" })}
      </Text>
      <RankingsContent data={week} preview={false} />
      <SecondaryButton
        onPress={() => setExpanded((current) => !current)}
        style={{ width: "100%" }}
      >
        {t(expanded ? "rankings.hideDays" : "rankings.viewDays")}
      </SecondaryButton>
      {expanded && days.isLoading ? (
        <PageLoadingState
          title={t("rankings.loadingTitle")}
          message={t("rankings.loadingBody")}
          icon="trophy"
        />
      ) : expanded && days.isError ? (
        <PageErrorState error={days.error} onRetry={() => void days.refetch()} />
      ) : expanded ? (
        <View className="gap-5 border-l-2 border-primaryBorder pl-3">
          {days.data?.days.map((day) => (
            <View key={day.period.startsAt} className="gap-2">
              <Text className="font-nunito-extrabold text-base text-fg">
                {day.period.standingsThrough}
              </Text>
              <RankingsContent data={day} preview={false} />
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function PodiumCard({ row, place, onPress }: { row: LeaderboardRow; place: 1 | 2 | 3; onPress: () => void }) {
  const heightClass = place === 1 ? "h-[236px]" : place === 2 ? "h-[206px]" : "h-[192px]";
  const colors =
    place === 1
      ? ["#FFFBEA", "#FEF3C7"]
      : place === 2
        ? ["#F8FAFC", "#E2E8F0"]
        : ["#FFF7ED", "#FED7AA"];

  return (
    <Pressable
      onPress={onPress}
      className={`flex-1 overflow-hidden rounded-t-[26px] ${heightClass}`}
      testID={`leaderboard-podium-${place}`}
    >
      <LinearGradient
        colors={colors as [string, string]}
        style={{ position: "absolute", inset: 0 }}
      />
      <View className="h-full items-center justify-end gap-2 px-2 pb-4">
        <View className="absolute inset-x-0 top-3 items-center">
          <View className="size-10 items-center justify-center rounded-full bg-white/80">
            <Text className="font-nunito-extrabold text-xl text-fg">{place}</Text>
          </View>
        </View>
        <LeaderboardAvatar
          avatarKey={row.profile.fallbackAvatarKey}
          avatarUrl={row.profile.avatarUrl}
          size={place === 1 ? 72 : 58}
        />
        <Text numberOfLines={1} className="w-full text-center font-nunito-bold text-xs text-fg">
          {row.profile.displayName}
        </Text>
        <Text className="font-nunito-bold text-sm text-fgMuted">{formatRaw(row)}</Text>
        <View className="rounded-lg bg-white/80 px-3 py-1.5">
          <Text className="font-nunito-extrabold text-base text-primaryText">
            {row.points.toLocaleString()} pts
          </Text>
        </View>
      </View>
      <View
        pointerEvents="none"
        className="absolute inset-0 rounded-t-[26px] border border-primaryBorder"
      />
    </Pressable>
  );
}

function RankingRow({
  row,
  bordered,
  current,
  onPress,
}: {
  row: LeaderboardRow;
  bordered?: boolean;
  current?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center gap-3 px-4 py-3 ${bordered ? "border-t border-primaryBorder" : ""} ${current ? "bg-primaryTint" : ""}`}
      testID={`leaderboard-row-${row.rank}`}
    >
      <Text className="w-7 text-center font-nunito-extrabold text-sm text-primaryText">
        {row.rank}
      </Text>
      <LeaderboardAvatar
        avatarKey={row.profile.fallbackAvatarKey}
        avatarUrl={row.profile.avatarUrl}
        size={42}
      />
      <Text numberOfLines={1} className="flex-1 font-nunito-bold text-sm text-fg">
        {row.profile.displayName}
      </Text>
      <Text className="font-nunito-semibold text-sm text-fgMuted">{formatRaw(row)}</Text>
      <Text className="min-w-20 text-right font-nunito-extrabold text-sm text-primaryText">
        {row.points.toLocaleString()} pts
      </Text>
    </Pressable>
  );
}

function isCurrentPlayer(row: LeaderboardRow, currentPlayer: LeaderboardRow | null) {
  if (!currentPlayer) return false;
  if (row.profile.publicProfileId && currentPlayer.profile.publicProfileId) {
    return row.profile.publicProfileId === currentPlayer.profile.publicProfileId;
  }
  return row.profile.handle === currentPlayer.profile.handle;
}

function formatRaw(row: LeaderboardRow) {
  return formatRawResult(row.rawResult);
}

function formatPeriodDate(
  period: LeaderboardResponse["period"],
  locale: "en" | "fr",
) {
  const formatter = new Intl.DateTimeFormat(locale, {
    dateStyle: "long",
    timeZone: "UTC",
  });
  const formatDate = (date: string) =>
    formatter.format(new Date(`${date}T12:00:00.000Z`));

  if (period.type === "day" && period.competitionDate) {
    return formatDate(period.competitionDate);
  }

  if (period.weekStart && period.weekEnd) {
    return `${formatDate(period.weekStart)} – ${formatDate(period.weekEnd)}`;
  }

  return "—";
}

function formatRawResult(raw: LeaderboardRow["rawResult"]) {
  if (raw.kind === "duration_error_ms") return `${raw.absoluteErrorMs} ms`;
  if (raw.kind === "steps") return raw.steps.toLocaleString();
  if (raw.kind === "correct_answers") return String(raw.correctAnswers);
  if (raw.kind === "wordle_outcome") return raw.outcome === "failed" ? "Failed" : `${raw.guesses}/6`;
  if (raw.kind === "exact_completion_time") return raw.exact ? `${(raw.elapsedMs / 1000).toFixed(1)} s` : "Not exact";
  if (raw.kind === "member_breakdown") {
    const values = Object.values(raw.members);
    const total = values.reduce((sum, value) => sum + value, 0);
    return `${Math.round(total / 1000).toLocaleString()} pts`;
  }
  return "—";
}

function EmptyPanel({ title, body }: { title: string; body: string }) {
  return (
    <View className="items-center gap-3 rounded-[28px] border border-primaryBorder bg-surface p-8">
      <TrophyIcon size={44} color="#DB2777" />
      <Text className="text-center font-nunito-extrabold text-xl text-fg">{title}</Text>
      <Text className="text-center font-nunito text-sm text-fgMuted">{body}</Text>
    </View>
  );
}
