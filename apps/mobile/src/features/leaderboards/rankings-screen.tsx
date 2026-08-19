import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
} from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";

import type {
  LeaderboardBoardKey,
  LeaderboardHistoryResponse,
  LeaderboardResponse,
  LeaderboardRow,
} from "@adventure-time/api-client";

import { PageErrorState } from "../../components/error-state";
import { GhostButton, SecondaryButton } from "../../components/button";
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
import { formatLeaderboardRawResult } from "./format-raw-result";
import {
  buildRankingsPresentation,
  type TopRank,
  type TopRankGroup,
} from "./rankings-presentation";
import {
  RANKINGS_PREVIEW_DATA,
  RANKINGS_TIED_PREVIEW_DATA,
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
  {
    key: "overall/all-quests",
    labelKey: "rankings.boards.allQuests",
    icon: TrophyIcon,
  },
  {
    key: "steps/default",
    labelKey: "rankings.boards.steps",
    icon: StepQuestIcon,
  },
  {
    key: "daily-numbers/family",
    labelKey: "rankings.boards.dailyNumbers",
    icon: DailyNumbersQuestIcon,
  },
  {
    key: "wordle/family",
    labelKey: "rankings.boards.wordle",
    icon: WordleQuestIcon,
  },
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
  const isPreview = process.env.EXPO_PUBLIC_E2E_AUTH === "1" && preview === "1";
  const isLoadingPreview = isPreview && previewState === "loading";
  const { t } = useTranslation();
  const themeName = useThemeStore((state) => state.themeName);
  const tc = THEME_COLORS[themeName];
  const headerHeight = useAppHeaderHeight();
  const bottomPadding = useBottomTabBarContentPadding();
  const [mainPeriod, setMainPeriod] = useState<MainPeriod>("weekly");
  const [dailyPeriod, setDailyPeriod] = useState<"today" | "yesterday">(
    "today",
  );
  const [weeklyPeriod, setWeeklyPeriod] = useState<
    "current_week" | "last_week"
  >("current_week");
  const period: LivePeriod | "history" =
    mainPeriod === "daily"
      ? dailyPeriod
      : mainPeriod === "weekly"
        ? weeklyPeriod
        : "history";
  const [boardKey, setBoardKey] = useState<LeaderboardBoardKey>(
    isLoadingPreview ? "steps/default" : "overall/all-quests",
  );

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
    const basePreviewData =
      placement === "ties"
        ? RANKINGS_TIED_PREVIEW_DATA
        : placement === "top7"
          ? RANKINGS_TOP_SEVEN_PREVIEW_DATA
          : RANKINGS_PREVIEW_DATA;
    const isDaily = mainPeriod === "daily";
    const previewData = withPreviewRawResults(
      basePreviewData,
      boardKey,
      !isDaily,
    );
    const competitionDate =
      dailyPeriod === "today" ? "2026-08-17" : "2026-08-16";
    const weekStart =
      weeklyPeriod === "current_week" ? "2026-08-17" : "2026-08-10";
    const weekEnd =
      weeklyPeriod === "current_week" ? "2026-08-23" : "2026-08-16";
    const closesAt = isDaily
      ? `${dailyPeriod === "today" ? "2026-08-18" : "2026-08-17"}T13:00:00.000Z`
      : `${weeklyPeriod === "current_week" ? "2026-08-24" : "2026-08-17"}T13:00:00.000Z`;

    return {
      ...previewData,
      board: { ...previewData.board, key: boardKey },
      period: {
        ...previewData.period,
        type: isDaily ? "day" : "week",
        closesAt,
        serverNow: "2026-08-17T10:00:00.000Z",
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
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={onRefresh}
          tintColor={tc.primaryDark}
        />
      }
    >
      <View className="gap-1 px-1">
        <View className="flex-row items-center gap-2">
          <TrophyIcon size={30} color={tc.primaryDark} />
          <Text
            selectable
            className="font-nunito-extrabold text-[32px] text-fg"
          >
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
          onSelect={(value) =>
            setWeeklyPeriod(value as "current_week" | "last_week")
          }
        />
      ) : null}

      <BoardSelector boardKey={boardKey} onSelect={setBoardKey} />

      {period === "history" ? (
        historyIsLoading && !isPreview ? (
          <PageLoadingState
            title={t("rankings.loadingTitle")}
            message={t("rankings.loadingBody")}
            icon="trophy"
          />
        ) : historyIsError && !isPreview ? (
          <PageErrorState
            error={historyError}
            onRetry={() => void refetchHistory()}
          />
        ) : historyData &&
          (historyData.days.length > 0 || historyData.weeks.length > 0) ? (
          <HistoryContent boardKey={boardKey} history={historyData} />
        ) : (
          <EmptyPanel
            title={t("rankings.historyTitle")}
            body={t("rankings.historyBody")}
          />
        )
      ) : isLoadingPreview || (queryIsLoading && !isPreview) ? (
        <PageLoadingState
          title={t("rankings.loadingTitle")}
          message={t("rankings.loadingBody")}
          icon="trophy"
        />
      ) : queryIsError && !isPreview ? (
        <PageErrorState
          error={queryError}
          onRetry={() => void refetchLeaderboard()}
        />
      ) : data ? (
        <RankingsContent data={data} preview={isPreview} />
      ) : null}
    </ScrollView>
  );
}

function BoardSelector({
  boardKey,
  onSelect,
}: {
  boardKey: LeaderboardBoardKey;
  onSelect: (boardKey: LeaderboardBoardKey) => void;
}) {
  const { t } = useTranslation();
  const themeName = useThemeStore((state) => state.themeName);
  const tc = THEME_COLORS[themeName];
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

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-3"
      >
        {BOARD_OPTIONS.map((option) => {
          const selected =
            option.key === boardKey ||
            (option.key.startsWith("daily-numbers/") &&
              boardKey.startsWith("daily-numbers/")) ||
            (option.key.startsWith("wordle/") &&
              boardKey.startsWith("wordle/"));
          const Icon = option.icon;

          return (
            <Pressable
              key={option.key}
              onPress={() => onSelect(option.key)}
              testID={`rankings-board-${option.key.replace("/", "-")}`}
            >
              <View
                className={`h-[92px] w-[106px] items-center justify-center gap-2 rounded-3xl border border-primaryBorder ${
                  selected ? "bg-primaryText" : "bg-surface"
                }`}
              >
                <Icon
                  size={30}
                  color={selected ? tc.surface : tc.primaryText}
                />
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
                onPress={() => onSelect(option.key)}
                className={`rounded-full border px-4 py-2 ${
                  selected
                    ? "border-primaryBorder bg-primaryTint"
                    : "border-primaryBorder bg-surface"
                }`}
                testID={`rankings-mode-${option.key.replace("/", "-")}`}
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
    </>
  );
}

function withPreviewRawResults(
  data: LeaderboardResponse,
  boardKey: LeaderboardBoardKey,
  weekly: boolean,
): LeaderboardResponse {
  const withRawResult = (row: LeaderboardRow): LeaderboardRow => {
    const sampleOffset = row.rank - 1;
    let rawResult: LeaderboardRow["rawResult"];
    let points = row.points;

    if (weekly) {
      if (boardKey === "steps/default") {
        const steps = 72_418 - sampleOffset * 2_470;
        rawResult = {
          kind: "weekly_steps",
          steps,
          resultCount: 7,
          scoringResultCount: 7,
        };
        points = Math.round(steps / 20);
      } else if (boardKey.startsWith("daily-numbers/")) {
        rawResult = {
          kind: "weekly_exact_completion",
          exactResults: Math.max(1, 6 - sampleOffset),
          resultCount: boardKey === "daily-numbers/family" ? 18 : 7,
          scoringResultCount: Math.max(1, 6 - sampleOffset),
          totalElapsedMs: 134_000 + sampleOffset * 11_000,
        };
        points = 4_820 - sampleOffset * 180;
      } else if (boardKey.startsWith("wordle/")) {
        const combined = boardKey === "wordle/family";
        const solvedResults = Math.max(1, (combined ? 11 : 6) - sampleOffset);
        rawResult = {
          kind: "weekly_wordle",
          solvedResults,
          resultCount: combined ? 13 : 7,
          scoringResultCount: solvedResults,
          totalGuesses: solvedResults * 3 + sampleOffset,
        };
        points = 4_600 - sampleOffset * 200;
      } else if (boardKey === "speed-calculus/ranked") {
        const correctAnswers = 84 - sampleOffset * 4;
        rawResult = {
          kind: "weekly_correct_answers",
          correctAnswers,
          resultCount: 7,
          scoringResultCount: 7,
        };
        points = correctAnswers * 50;
      } else if (boardKey === "perfect-timing/official") {
        const successfulResults = Math.max(1, 6 - sampleOffset);
        rawResult = {
          kind: "weekly_duration_error",
          successfulResults,
          resultCount: 7,
          scoringResultCount: successfulResults,
          totalAbsoluteErrorMs: 184 + sampleOffset * 37,
        };
        points = 5_210 - sampleOffset * 210;
      } else {
        rawResult = {
          kind: "weekly_overall",
          familiesPlayed: 5,
          resultCount: 38,
          scoringResultCount: Math.max(1, 31 - sampleOffset),
        };
        points = 22_480 - sampleOffset * 730;
      }

      return { ...row, rawResult, points, pointsMilli: points * 1_000 };
    }

    if (boardKey === "steps/default") {
      rawResult = { kind: "steps", steps: 20_920 - sampleOffset * 740 };
    } else if (
      boardKey.startsWith("daily-numbers/") &&
      boardKey !== "daily-numbers/family"
    ) {
      rawResult = {
        kind: "exact_completion_time",
        exact: true,
        elapsedMs: 8_420 + sampleOffset * 735,
      };
    } else if (boardKey.startsWith("wordle/") && boardKey !== "wordle/family") {
      rawResult = {
        kind: "wordle_outcome",
        outcome: "solved",
        guesses: Math.min(6, 1 + sampleOffset),
      };
    } else if (boardKey === "speed-calculus/ranked") {
      rawResult = {
        kind: "correct_answers",
        correctAnswers: 24 - sampleOffset,
      };
    } else if (boardKey === "perfect-timing/official") {
      rawResult = {
        kind: "duration_error_ms",
        outcome: "success",
        absoluteErrorMs: 8 + sampleOffset * 9,
        tier: "diamond",
      };
    } else {
      rawResult = row.rawResult;
    }

    return { ...row, rawResult };
  };

  return {
    ...data,
    podium: data.podium.map(withRawResult),
    rows: data.rows.map(withRawResult),
    currentPlayer: data.currentPlayer
      ? withRawResult(data.currentPlayer)
      : null,
  };
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

function RankingsContent({
  data,
  preview,
}: {
  data: LeaderboardResponse;
  preview: boolean;
}) {
  const { locale, t } = useTranslation();
  const router = useRouter();
  const themeName = useThemeStore((state) => state.themeName);
  const tc = THEME_COLORS[themeName];
  const closeCountdown = useCloseCountdown(data.period);
  const { topRankGroups, hasTopRankTie, remainingRows } = useMemo(
    () => buildRankingsPresentation(data.rows),
    [data.rows],
  );
  const firstPlace = topRankGroups.find((group) => group.rank === 1)?.rows[0];
  const secondPlace = topRankGroups.find(
    (group) => group.rank === 2,
  )?.rows[0];
  const thirdPlace = topRankGroups.find((group) => group.rank === 3)?.rows[0];
  const openProfile = (row: LeaderboardRow) => {
    if (!row.profile.publicProfileId || row.profile.visibility !== "visible")
      return;
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
        <Text
          selectable
          className="text-center font-nunito-extrabold text-base text-fg"
        >
          {formatPeriodDate(data.period, locale)}
        </Text>
        <View
          className={`rounded-full px-3 py-1 ${data.period.provisional ? "bg-infoTint" : "bg-surface"}`}
        >
          <Text className="font-nunito-bold text-xs uppercase tracking-[1px] text-primaryText">
            {t(
              data.period.provisional
                ? "rankings.liveProvisional"
                : "rankings.final",
            )}
          </Text>
        </View>
        <Text
          selectable
          className="text-center font-nunito text-xs text-fgMuted"
        >
          {t(
            data.period.provisional
              ? "rankings.provisionalHint"
              : "rankings.finalHint",
          )}
        </Text>
        {closeCountdown ? (
          <View className="flex-row items-center gap-1.5 rounded-full bg-surface px-3 py-1.5">
            <ClockIcon size={14} color={tc.primaryText} />
            <Text
              accessibilityLiveRegion="polite"
              className="font-nunito-extrabold text-xs text-primaryText"
              testID="rankings-close-countdown"
            >
              {t("rankings.closesIn", closeCountdown)}
            </Text>
          </View>
        ) : null}
      </View>

      {hasTopRankTie ? (
        <View className="gap-3" testID="leaderboard-tied-podium">
          {topRankGroups.map((group) => (
            <TiedRankGroup
              currentPlayer={data.currentPlayer}
              group={group}
              key={group.rank}
              onPress={openProfile}
            />
          ))}
        </View>
      ) : (
        <View className="flex-row items-end justify-center gap-1 pt-3">
          {secondPlace ? (
            <PodiumCard
              row={secondPlace}
              place={2}
              onPress={() => openProfile(secondPlace)}
            />
          ) : null}
          {firstPlace ? (
            <PodiumCard
              row={firstPlace}
              place={1}
              onPress={() => openProfile(firstPlace)}
            />
          ) : null}
          {thirdPlace ? (
            <PodiumCard
              row={thirdPlace}
              place={3}
              onPress={() => openProfile(thirdPlace)}
            />
          ) : null}
        </View>
      )}

      {remainingRows.length > 0 ? (
        <View className="overflow-hidden rounded-[28px] border border-primaryBorder bg-surface">
          {remainingRows.map((row, index) => (
            <RankingRow
              key={row.profile.handle}
              row={row}
              bordered={index > 0}
              current={isCurrentPlayer(row, data.currentPlayer)}
              onPress={() => openProfile(row)}
            />
          ))}
        </View>
      ) : null}

      {data.currentPlayer && data.currentPlayer.rank > 7 ? (
        <View className="rounded-[24px] border-2 border-primaryBorder bg-primaryTint">
          <View className="absolute -top-2 left-1/2 size-4 rotate-45 border-l-2 border-t-2 border-primaryBorder bg-primaryTint" />
          <RankingRow
            row={data.currentPlayer}
            onPress={() => openProfile(data.currentPlayer!)}
          />
        </View>
      ) : null}

      <View className="flex-row items-center justify-center gap-2 px-3 py-1">
        <TrophyIcon size={18} color="#DB2777" />
        <Text className="text-center font-nunito-semibold text-xs text-fgMuted">
          {t("rankings.profileTapHint")}
        </Text>
      </View>

      <View className="items-center py-1">
        <GhostButton
          onPress={() => router.push("/leaderboard-help")}
          leadingAccessory={<HelpCircleIcon size={20} color={tc.primaryText} />}
          testID="rankings-open-help-button"
        >
          {t("rankings.scoringHelp")}
        </GhostButton>
      </View>
    </View>
  );
}

function useCloseCountdown(period: LeaderboardResponse["period"]) {
  const clock = useMemo(
    () => ({
      localStartedAt: Date.now(),
      serverStartedAt: Date.parse(period.serverNow),
    }),
    [period.serverNow],
  );
  const [localNow, setLocalNow] = useState(() => Date.now());

  useEffect(() => {
    if (!period.provisional) return;

    const interval = setInterval(() => setLocalNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, [period.closesAt, period.provisional, period.serverNow]);

  if (!period.provisional) return null;

  const authoritativeNow =
    clock.serverStartedAt + (localNow - clock.localStartedAt);
  const remainingMinutes = Math.max(
    0,
    Math.ceil((Date.parse(period.closesAt) - authoritativeNow) / 60_000),
  );
  const days = Math.floor(remainingMinutes / (24 * 60));
  const hours = Math.floor((remainingMinutes % (24 * 60)) / 60);
  const minutes = remainingMinutes % 60;

  return { days, hours, minutes };
}

function HistoryContent({
  boardKey,
  history,
}: {
  boardKey: LeaderboardBoardKey;
  history: LeaderboardHistoryResponse;
}) {
  const { t } = useTranslation();

  return (
    <View className="gap-6">
      {history.days.length > 0 ? (
        <View className="gap-4">
          <Text className="px-1 font-nunito-extrabold text-xl text-fg">
            {t("rankings.recentDays")}
          </Text>
          {history.days.map((day) => (
            <RankingsContent
              data={day}
              key={day.period.startsAt}
              preview={false}
            />
          ))}
        </View>
      ) : null}
      {history.weeks.map((week) => (
        <HistoryWeek
          boardKey={boardKey}
          key={week.period.startsAt}
          week={week}
        />
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
        <PageErrorState
          error={days.error}
          onRetry={() => void days.refetch()}
        />
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

function PodiumCard({
  row,
  place,
  onPress,
}: {
  row: LeaderboardRow;
  place: 1 | 2 | 3;
  onPress: () => void;
}) {
  const { locale, t } = useTranslation();
  const heightClass =
    place === 1 ? "h-[236px]" : place === 2 ? "h-[206px]" : "h-[192px]";
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
            <Text className="font-nunito-extrabold text-xl text-fg">
              {place}
            </Text>
          </View>
        </View>
        <LeaderboardAvatar
          avatarKey={row.profile.fallbackAvatarKey}
          avatarUrl={row.profile.avatarUrl}
          size={place === 1 ? 72 : 58}
        />
        <Text
          numberOfLines={1}
          className="w-full text-center font-nunito-bold text-xs text-fg"
        >
          {row.profile.displayName}
        </Text>
        <Text
          numberOfLines={2}
          className="text-center font-nunito-bold text-xs tabular-nums text-fgMuted"
        >
          {formatLeaderboardRawResult(row.rawResult, locale, t)}
        </Text>
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

const TIED_RANK_COLORS: Record<TopRank, [string, string]> = {
  1: ["#FFFBEA", "#FEF3C7"],
  2: ["#F8FAFC", "#E2E8F0"],
  3: ["#FFF7ED", "#FED7AA"],
};

const PLACEMENT_LABEL_KEYS: Record<TopRank, string> = {
  1: "rankings.placements.first",
  2: "rankings.placements.second",
  3: "rankings.placements.third",
};

function TiedRankGroup({
  group,
  currentPlayer,
  onPress,
}: {
  group: TopRankGroup<LeaderboardRow>;
  currentPlayer: LeaderboardRow | null;
  onPress: (row: LeaderboardRow) => void;
}) {
  const { t } = useTranslation();

  return (
    <View
      className="overflow-hidden rounded-[24px] border border-primaryBorder bg-surface"
      testID={`leaderboard-rank-group-${group.rank}`}
    >
      <View className="overflow-hidden px-4 py-3">
        <LinearGradient
          colors={TIED_RANK_COLORS[group.rank]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ position: "absolute", inset: 0 }}
        />
        <View className="flex-row items-center gap-3">
          <View className="size-10 items-center justify-center rounded-full bg-white/80">
            <Text className="font-nunito-extrabold text-xl text-fg">
              {group.rank}
            </Text>
          </View>
          <Text
            selectable
            className="flex-1 font-nunito-extrabold text-lg text-fg"
          >
            {t(PLACEMENT_LABEL_KEYS[group.rank])}
          </Text>
          {group.rows.length > 1 ? (
            <View className="rounded-full bg-white/80 px-3 py-1.5">
              <Text className="font-nunito-extrabold text-xs text-primaryText">
                {t("rankings.placements.tied", {
                  count: group.rows.length,
                })}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {group.rows.map((row, index) => (
        <Pressable
          key={row.profile.handle}
          onPress={() => onPress(row)}
          className={`flex-row items-center gap-3 px-4 py-3 ${index > 0 ? "border-t border-primaryBorder" : ""} ${isCurrentPlayer(row, currentPlayer) ? "bg-primaryTint" : ""}`}
          testID={`leaderboard-tied-rank-${group.rank}-row-${index + 1}`}
        >
          <LeaderboardAvatar
            avatarKey={row.profile.fallbackAvatarKey}
            avatarUrl={row.profile.avatarUrl}
            size={48}
          />
          <View className="min-w-0 flex-1 gap-0.5">
            <Text
              selectable
              numberOfLines={1}
              className="font-nunito-bold text-sm text-fg"
            >
              {row.profile.displayName}
            </Text>
            <TiedRankResult row={row} />
          </View>
          <View className="rounded-xl bg-primaryTint px-3 py-2">
            <Text
              selectable
              className="font-nunito-extrabold text-sm tabular-nums text-primaryText"
            >
              {row.points.toLocaleString()} pts
            </Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

function TiedRankResult({ row }: { row: LeaderboardRow }) {
  const { locale, t } = useTranslation();

  return (
    <Text
      selectable
      numberOfLines={2}
      className="font-nunito-semibold text-xs leading-4 tabular-nums text-fgMuted"
    >
      {formatLeaderboardRawResult(row.rawResult, locale, t)}
    </Text>
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
  const { locale, t } = useTranslation();

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
      <Text
        numberOfLines={1}
        className="flex-1 font-nunito-bold text-sm text-fg"
      >
        {row.profile.displayName}
      </Text>
      <Text
        numberOfLines={2}
        className="max-w-32 text-right font-nunito-semibold text-xs leading-4 tabular-nums text-fgMuted"
      >
        {formatLeaderboardRawResult(row.rawResult, locale, t)}
      </Text>
      <Text className="min-w-20 text-right font-nunito-extrabold text-sm text-primaryText">
        {row.points.toLocaleString()} pts
      </Text>
    </Pressable>
  );
}

function isCurrentPlayer(
  row: LeaderboardRow,
  currentPlayer: LeaderboardRow | null,
) {
  if (!currentPlayer) return false;
  if (row.profile.publicProfileId && currentPlayer.profile.publicProfileId) {
    return (
      row.profile.publicProfileId === currentPlayer.profile.publicProfileId
    );
  }
  return row.profile.handle === currentPlayer.profile.handle;
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

function EmptyPanel({ title, body }: { title: string; body: string }) {
  return (
    <View className="items-center gap-3 rounded-[28px] border border-primaryBorder bg-surface p-8">
      <TrophyIcon size={44} color="#DB2777" />
      <Text className="text-center font-nunito-extrabold text-xl text-fg">
        {title}
      </Text>
      <Text className="text-center font-nunito text-sm text-fgMuted">
        {body}
      </Text>
    </View>
  );
}
