import Check from "lucide-react-native/icons/check";
import Info from "lucide-react-native/icons/info";
import Radio from "lucide-react-native/icons/radio";
import Trophy from "lucide-react-native/icons/trophy";
import { useQuery } from "@tanstack/react-query";
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
import {
  ClockIcon,
  DailyNumbersQuestIcon,
  SpeedCalculusQuestIcon,
  StepQuestIcon,
  TrophyIcon,
  WordleQuestIcon,
} from "../../components/icons";
import { PageLoadingState } from "../../components/loading-state";
import { useFocusedRefetchInterval } from "../../hooks/use-focused-refetch-interval";
import { useTranslation } from "../../i18n";
import { apiClient } from "../../lib/api";
import { useThemeStore } from "../../stores/theme-store";
import {
  useAppHeaderHeight,
  useBottomTabBarContentPadding,
} from "../../theme/layout";
import { THEME_COLORS } from "../../theme/themes";
import { formatLeaderboardRawResult } from "./format-raw-result";
import {
  RANKINGS_PREVIEW_DATA,
  RANKINGS_TIED_PREVIEW_DATA,
  RANKINGS_TOP_SEVEN_PREVIEW_DATA,
} from "./rankings-preview-data";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Chip } from "../../components/ui/chip";
import { PageTitle } from "../../components/ui/page-title";
import { SectionHeader } from "../../components/ui/section-header";
import { SegmentedControl } from "../../components/ui/segmented-control";
import { StatePanel } from "../../components/ui/state-panel";

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

  const leaderboardRefetchInterval = useFocusedRefetchInterval(60_000);
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
    refetchInterval: leaderboardRefetchInterval,
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
      gap: 12,
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
      <View className="gap-1">
        <PageTitle title={t("rankings.title")} subtitle={t("rankings.subtitle")} />
        {isPreview ? (
          <Text className="font-nunito-bold text-xs text-primaryText">
            {t("rankings.previewLabel")}
          </Text>
        ) : null}
      </View>

      <SegmentedControl<MainPeriod>
        options={(["daily", "weekly", "history"] as MainPeriod[]).map((item) => ({
          value: item,
          label: t(`rankings.periods.${item}`),
          testID: `rankings-period-${item}`,
        }))}
        value={mainPeriod}
        onChange={setMainPeriod}
      />

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
        contentContainerClassName="gap-ds-2"
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
            <Chip
              key={option.key}
              tone={selected ? "selected" : "neutral"}
              icon={({ color, size }: { color: string; size: number }) => (
                <Icon size={size} color={color} />
              )}
              label={t(option.labelKey)}
              onPress={() => onSelect(option.key)}
              testID={`rankings-board-${option.key.replace("/", "-")}`}
            />
          );
        })}
      </ScrollView>

      {modeOptions.length ? (
        <View className="flex-row flex-wrap gap-ds-2">
          {modeOptions.map((option) => (
            <Chip
              key={option.key}
              tone={option.key === boardKey ? "primary" : "neutral"}
              label={option.label}
              onPress={() => onSelect(option.key)}
              testID={`rankings-mode-${option.key.replace("/", "-")}`}
            />
          ))}
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
    <SegmentedControl<LivePeriod>
      options={options.map((option) => ({
        value: option,
        label: t(`rankings.periods.${option}`),
        testID: `rankings-period-${option}`,
      }))}
      value={selected}
      onChange={onSelect}
    />
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
  const closeCountdown = useCloseCountdown(data.period);
  const currentPlayerListed = data.currentPlayer
    ? data.rows.some((row) => isCurrentPlayer(row, data.currentPlayer))
    : false;
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
    <View className="gap-ds-3">
      <Card>
        <View className="flex-row items-center justify-between gap-ds-3">
          <Text
            selectable
            className="flex-1 font-nunito-extrabold text-ds-h3 text-fg"
          >
            {formatPeriodDate(data.period, locale)}
          </Text>
          <Chip
            tone={data.period.provisional ? "info" : "neutral"}
            icon={data.period.provisional ? Radio : Check}
            label={t(
              data.period.provisional
                ? "rankings.liveProvisional"
                : "rankings.final",
            )}
          />
        </View>
        <Text selectable className="font-nunito text-ds-sm text-fgMuted">
          {t(
            data.period.provisional
              ? "rankings.provisionalHint"
              : "rankings.finalHint",
          )}
          {closeCountdown ? (
            <Text
              accessibilityLiveRegion="polite"
              testID="rankings-close-countdown"
            >
              {` ${t("rankings.closesIn", closeCountdown)}.`}
            </Text>
          ) : null}
        </Text>
      </Card>

      {data.rows.length > 0 ? (
        <Card flush testID="leaderboard-standings">
          {data.rows.map((row, index) => (
            <RankingRow
              key={row.profile.handle}
              row={row}
              tieIndex={countEarlierTies(data.rows, index)}
              divider={index < data.rows.length - 1}
              current={isCurrentPlayer(row, data.currentPlayer)}
              onPress={() => openProfile(row)}
            />
          ))}
        </Card>
      ) : (
        <StatePanel
          icon={Trophy}
          title={t("rankings.emptyTitle")}
          body={t(
            data.period.type === "day"
              ? "rankings.emptyBodyDay"
              : "rankings.emptyBodyWeek",
          )}
          action={{
            label: t("rankings.emptyAction"),
            onPress: () => router.push("/(tabs)/quests"),
            testID: "rankings-empty-quests-button",
          }}
          testID="rankings-empty-state"
        />
      )}

      {data.currentPlayer && !currentPlayerListed ? (
        <Card flush>
          <RankingRow
            row={data.currentPlayer}
            divider={false}
            current
            onPress={() => openProfile(data.currentPlayer!)}
          />
        </Card>
      ) : null}

      <Button
        tone="ghost"
        icon={Info}
        onPress={() => router.push("/leaderboard-help")}
        testID="rankings-open-help-button"
      >
        {t("rankings.scoringHelp")}
      </Button>
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
    <View className="gap-ds-6">
      {history.days.length > 0 ? (
        <View className="gap-ds-3">
          <SectionHeader title={t("rankings.recentDays")} />
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
    <View className="gap-ds-3">
      <SectionHeader
        title={t("rankings.weekEnding", {
          date: week.period.standingsThrough ?? "",
        })}
      />
      <RankingsContent data={week} preview={false} />
      <Button tone="ghost" onPress={() => setExpanded((current) => !current)}>
        {t(expanded ? "rankings.hideDays" : "rankings.viewDays")}
      </Button>
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
        <View className="gap-ds-5 border-l-2 border-primaryBorder pl-ds-3">
          {days.data?.days.map((day) => (
            <View key={day.period.startsAt} className="gap-2">
              <Text className="font-nunito-extrabold text-ds-h3 text-fg">
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

function RankingRow({
  row,
  tieIndex = 0,
  divider,
  current,
  onPress,
}: {
  row: LeaderboardRow;
  // Tied players share a rank; the second and later ones get a suffixed testID.
  tieIndex?: number;
  divider: boolean;
  current?: boolean;
  onPress?: () => void;
}) {
  const { locale, t } = useTranslation();
  const result = formatLeaderboardRawResult(row.rawResult, locale, t);
  const first = row.rank === 1;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className={`flex-row items-center gap-ds-3 px-ds-4 py-ds-3 ${
        divider ? "border-b border-primaryBorder" : ""
      } ${current ? "bg-primaryTint" : ""}`}
      testID={
        tieIndex > 0
          ? `leaderboard-row-${row.rank}-${tieIndex + 1}`
          : `leaderboard-row-${row.rank}`
      }
    >
      <View
        className={`size-8 items-center justify-center rounded-ds-pill border ${
          first
            ? "border-secondaryBorder bg-secondaryTint"
            : "border-primaryBorder bg-surface"
        }`}
      >
        <Text
          className={`font-nunito-extrabold text-ds-sm tabular-nums ${
            first ? "text-secondaryText" : "text-fg"
          }`}
        >
          {row.rank}
        </Text>
      </View>
      <View className="min-w-0 flex-1 gap-[2px]">
        <Text
          numberOfLines={1}
          className="font-nunito-bold text-ds-body text-fg"
        >
          {row.profile.displayName}
        </Text>
        {result || current ? (
          <Text
            numberOfLines={2}
            className="font-nunito text-ds-sm tabular-nums text-fgMuted"
          >
            {current
              ? result
                ? t("rankings.youWithResult", { result })
                : t("rankings.you")
              : result}
          </Text>
        ) : null}
      </View>
      <Text className="font-nunito-extrabold text-ds-body tabular-nums text-primaryText">
        {t("rankings.points", { points: row.points.toLocaleString(locale === "fr" ? "fr-FR" : "en-US") })}
      </Text>
    </Pressable>
  );
}

function countEarlierTies(rows: LeaderboardRow[], index: number) {
  let count = 0;
  for (let earlier = index - 1; earlier >= 0; earlier -= 1) {
    if (rows[earlier].rank !== rows[index].rank) break;
    count += 1;
  }
  return count;
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

const PERIOD_DATE_FORMATTERS = {
  en: {
    full: new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }),
    start: new Intl.DateTimeFormat("en", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }),
  },
  fr: {
    full: new Intl.DateTimeFormat("fr", { dateStyle: "medium", timeZone: "UTC" }),
    start: new Intl.DateTimeFormat("fr", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }),
  },
} as const;

function formatPeriodDate(
  period: LeaderboardResponse["period"],
  locale: "en" | "fr",
) {
  const formatters = PERIOD_DATE_FORMATTERS[locale];
  const toDate = (date: string) => new Date(`${date}T12:00:00.000Z`);

  if (period.type === "day" && period.competitionDate) {
    return formatters.full.format(toDate(period.competitionDate));
  }

  if (period.weekStart && period.weekEnd) {
    return `${formatters.start.format(toDate(period.weekStart))} – ${formatters.full.format(toDate(period.weekEnd))}`;
  }

  return "—";
}

function EmptyPanel({ title, body }: { title: string; body: string }) {
  return <StatePanel icon={Trophy} title={title} body={body} />;
}
