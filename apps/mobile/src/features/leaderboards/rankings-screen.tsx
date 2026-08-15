import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState, type ComponentType } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import type {
  FallbackAvatarKey,
  LeaderboardBoardKey,
  LeaderboardResponse,
  LeaderboardRow,
} from "@adventure-time/api-client";

import { PageErrorState } from "../../components/error-state";
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
import { LEADERBOARD_AVATAR_SOURCES } from "./avatar-assets";
import { RANKINGS_PREVIEW_DATA } from "./rankings-preview-data";

type Period = "yesterday" | "current_week" | "history";
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
  const { preview } = useLocalSearchParams<{ preview?: string }>();
  const isPreview =
    process.env.EXPO_PUBLIC_E2E_AUTH === "1" && preview === "1";
  const { t } = useTranslation();
  const themeName = useThemeStore((state) => state.themeName);
  const tc = THEME_COLORS[themeName];
  const headerHeight = useAppHeaderHeight();
  const bottomPadding = useBottomTabBarContentPadding();
  const [period, setPeriod] = useState<Period>("current_week");
  const [boardKey, setBoardKey] = useState<LeaderboardBoardKey>(
    "perfect-timing/official",
  );

  const query = useQuery({
    queryKey: ["leaderboard", boardKey, period],
    queryFn: () => apiClient.leaderboard(boardKey, period as "yesterday" | "current_week"),
    enabled: !isPreview && period !== "history",
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    retry: 1,
  });

  useFocusEffect(
    useCallback(() => {
      if (!isPreview && period !== "history") {
        void query.refetch();
      }
    }, [isPreview, period, query.refetch]),
  );

  const data = useMemo<LeaderboardResponse | undefined>(() => {
    if (!isPreview) return query.data;
    return { ...RANKINGS_PREVIEW_DATA, board: { ...RANKINGS_PREVIEW_DATA.board, key: boardKey } };
  }, [boardKey, isPreview, query.data]);

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      className="flex-1 bg-bg"
      contentContainerStyle={{
        paddingTop: headerHeight + 18,
        paddingBottom: bottomPadding,
        paddingHorizontal: 16,
        gap: 18,
      }}
      showsVerticalScrollIndicator={false}
      testID="rankings-screen"
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
        {(["yesterday", "current_week", "history"] as Period[]).map((item) => {
          const selected = period === item;
          return (
            <Pressable
              key={item}
              onPress={() => setPeriod(item)}
              className="flex-1 items-center justify-center overflow-hidden rounded-full px-2 py-3"
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

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-3">
        {BOARD_OPTIONS.map((option) => {
          const selected = option.key === boardKey;
          const Icon = option.icon;
          return (
            <Pressable key={option.key} onPress={() => setBoardKey(option.key)}>
              {selected ? (
                <LinearGradient
                  colors={[tc.primaryStrong, tc.primary]}
                  className="h-[92px] w-[106px] items-center justify-center gap-2 rounded-3xl border border-primaryBorder"
                >
                  <Icon size={30} color="#fff" />
                  <Text className="text-center font-nunito-bold text-xs text-white">
                    {t(option.labelKey)}
                  </Text>
                </LinearGradient>
              ) : (
                <View className="h-[92px] w-[106px] items-center justify-center gap-2 rounded-3xl border border-primaryBorder bg-surface">
                  <Icon size={30} color={tc.primaryText} />
                  <Text className="text-center font-nunito-bold text-xs text-primaryText">
                    {t(option.labelKey)}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      {period === "history" ? (
        <EmptyPanel title={t("rankings.historyTitle")} body={t("rankings.historyBody")} />
      ) : query.isLoading && !isPreview ? (
        <PageLoadingState
          title={t("rankings.loadingTitle")}
          message={t("rankings.loadingBody")}
          icon="trophy"
        />
      ) : query.isError && !isPreview ? (
        <PageErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : data ? (
        <RankingsContent data={data} />
      ) : null}
    </ScrollView>
  );
}

function RankingsContent({ data }: { data: LeaderboardResponse }) {
  const { t } = useTranslation();

  return (
    <View className="gap-4">
      <View className="rounded-2xl bg-primaryTint px-4 py-3">
        <Text selectable className="text-center font-nunito-bold text-sm text-primaryText">
          {data.period.standingsThrough
            ? t("rankings.standingsThrough", { date: data.period.standingsThrough })
            : t("rankings.provisional")}
        </Text>
      </View>

      <View className="flex-row items-end justify-center gap-1 pt-3">
        {data.podium[1] ? <PodiumCard row={data.podium[1]} place={2} /> : null}
        {data.podium[0] ? <PodiumCard row={data.podium[0]} place={1} /> : null}
        {data.podium[2] ? <PodiumCard row={data.podium[2]} place={3} /> : null}
      </View>

      <View className="overflow-hidden rounded-[28px] border border-primaryBorder bg-surface px-4">
        {data.rows.slice(3).map((row, index) => (
          <RankingRow key={row.profile.handle} row={row} bordered={index > 0} />
        ))}
      </View>

      {data.currentPlayer ? (
        <View className="rounded-[24px] border-2 border-primaryBorder bg-primaryTint px-4">
          <View className="absolute -top-2 left-1/2 size-4 rotate-45 border-l-2 border-t-2 border-primaryBorder bg-primaryTint" />
          <RankingRow row={data.currentPlayer} label={t("rankings.you")} />
        </View>
      ) : null}

      <View className="flex-row items-center justify-center gap-2 py-1">
        <HelpCircleIcon size={20} color="#DB2777" />
        <Text className="font-nunito-bold text-sm text-primaryText">
          {t("rankings.scoringHelp")}
        </Text>
      </View>
    </View>
  );
}

function PodiumCard({ row, place }: { row: LeaderboardRow; place: 1 | 2 | 3 }) {
  const heightClass = place === 1 ? "h-[236px]" : place === 2 ? "h-[206px]" : "h-[192px]";
  const colors =
    place === 1
      ? ["#FFFBEA", "#FEF3C7"]
      : place === 2
        ? ["#F8FAFC", "#E2E8F0"]
        : ["#FFF7ED", "#FED7AA"];

  return (
    <View
      className={`flex-1 overflow-hidden rounded-t-[26px] border border-primaryBorder ${heightClass}`}
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
        <Avatar avatarKey={row.profile.fallbackAvatarKey} size={place === 1 ? 72 : 58} />
        <Text numberOfLines={1} className="w-full text-center font-nunito-bold text-xs text-fg">
          {row.profile.displayName}
        </Text>
        <Text className="font-nunito-bold text-sm text-fgMuted">{formatRaw(row)}</Text>
        <View className="rounded-lg bg-white/80 px-3 py-1.5">
          <Text className="font-nunito-extrabold text-base text-primaryText">{row.points} pts</Text>
        </View>
      </View>
    </View>
  );
}

function RankingRow({ row, bordered, label }: { row: LeaderboardRow; bordered?: boolean; label?: string }) {
  return (
    <View className={`flex-row items-center gap-3 py-3 ${bordered ? "border-t border-primaryBorder/40" : ""}`}>
      <Text className="w-7 text-center font-nunito-extrabold text-sm text-primaryText">
        {label ?? row.rank}
      </Text>
      <Avatar avatarKey={row.profile.fallbackAvatarKey} size={42} />
      <Text numberOfLines={1} className="flex-1 font-nunito-bold text-sm text-fg">
        {row.profile.displayName}
      </Text>
      <Text className="font-nunito-semibold text-sm text-fgMuted">{formatRaw(row)}</Text>
      <Text className="w-16 text-right font-nunito-extrabold text-sm text-primaryText">
        {row.points} pts
      </Text>
    </View>
  );
}

function Avatar({ avatarKey, size }: { avatarKey: FallbackAvatarKey; size: number }) {
  return (
    <Image
      source={LEADERBOARD_AVATAR_SOURCES[avatarKey]}
      style={{ width: size, height: size, borderRadius: size / 2 }}
      contentFit="cover"
      transition={150}
    />
  );
}

function formatRaw(row: LeaderboardRow) {
  const raw = row.rawResult;
  if (raw.kind === "duration_error_ms") return `${raw.absoluteErrorMs} ms`;
  if (raw.kind === "steps") return raw.steps.toLocaleString();
  if (raw.kind === "correct_answers") return String(raw.correctAnswers);
  if (raw.kind === "wordle_outcome") return raw.outcome === "failed" ? "Failed" : `${raw.guesses}/6`;
  if (raw.kind === "exact_completion_time") return raw.exact ? `${(raw.elapsedMs / 1000).toFixed(1)} s` : "Not exact";
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
