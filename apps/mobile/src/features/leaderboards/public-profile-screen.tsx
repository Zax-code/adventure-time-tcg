import { useQuery } from "@tanstack/react-query";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import type { ComponentType } from "react";
import { ScrollView, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import type {
  LeaderboardBoardKey,
  LeaderboardRow,
  PublicLeaderboardProfile,
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
import { useTranslation } from "../../i18n";
import { apiClient } from "../../lib/api";
import { useThemeStore } from "../../stores/theme-store";
import { THEME_COLORS } from "../../theme/themes";
import { LeaderboardAvatar } from "./leaderboard-avatar";
import { PUBLIC_PROFILE_PREVIEW_DATA } from "./public-profile-preview-data";

type IconComponent = ComponentType<{ size?: number; color?: string }>;

const CROWN_FAMILIES: Array<{
  key: Exclude<keyof PublicLeaderboardProfile["crowns"], "total">;
  labelKey: string;
  icon: IconComponent;
}> = [
  { key: "steps", labelKey: "rankings.boards.steps", icon: StepQuestIcon },
  {
    key: "dailyNumbers",
    labelKey: "rankings.boards.dailyNumbers",
    icon: DailyNumbersQuestIcon,
  },
  { key: "wordle", labelKey: "rankings.boards.wordle", icon: WordleQuestIcon },
  {
    key: "speedCalculus",
    labelKey: "rankings.boards.speedCalculus",
    icon: SpeedCalculusQuestIcon,
  },
  {
    key: "perfectTiming",
    labelKey: "rankings.boards.perfectTiming",
    icon: ClockIcon,
  },
];

const BOARD_LABEL_KEYS: Record<LeaderboardBoardKey, string> = {
  "steps/default": "rankings.boards.steps",
  "daily-numbers/1-5": "rankings.profile.boardLabels.dailyNumbers15",
  "daily-numbers/2-4": "rankings.profile.boardLabels.dailyNumbers24",
  "daily-numbers/3-3": "rankings.profile.boardLabels.dailyNumbers33",
  "daily-numbers/family": "rankings.boards.dailyNumbers",
  "wordle/fr": "rankings.profile.boardLabels.wordleFr",
  "wordle/en": "rankings.profile.boardLabels.wordleEn",
  "wordle/family": "rankings.boards.wordle",
  "speed-calculus/ranked": "rankings.boards.speedCalculus",
  "perfect-timing/official": "rankings.boards.perfectTiming",
};

const MEDALS = [
  { key: "gold", color: "#F4C542", tint: "#FFF8D6" },
  { key: "silver", color: "#94A3B8", tint: "#F1F5F9" },
  { key: "bronze", color: "#C47A44", tint: "#FFF1E7" },
] as const;

export function PublicProfileScreen() {
  const { id, preview } = useLocalSearchParams<{ id?: string; preview?: string }>();
  const router = useRouter();
  const { locale, t } = useTranslation();
  const tc = THEME_COLORS[useThemeStore((state) => state.themeName)];
  const isPreview = process.env.EXPO_PUBLIC_E2E_AUTH === "1" && preview === "1";

  const {
    data: queryData,
    error: queryError,
    isError: queryIsError,
    isLoading: queryIsLoading,
    refetch: refetchProfile,
  } = useQuery({
    queryKey: ["public-leaderboard-profile", id],
    queryFn: () => apiClient.publicLeaderboardProfile(id ?? ""),
    enabled: !isPreview && Boolean(id),
    staleTime: 60_000,
    retry: 1,
  });

  const profile = isPreview ? PUBLIC_PROFILE_PREVIEW_DATA : queryData;

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: t("rankings.profile.title"),
          headerBackButtonDisplayMode: "minimal",
          headerShadowVisible: false,
          headerStyle: { backgroundColor: tc.bg },
          headerTintColor: tc.primaryText,
          headerTitleStyle: {
            color: tc.fg,
            fontFamily: "Nunito_800ExtraBold",
          },
        }}
      />
      {queryIsLoading && !isPreview ? (
        <PageLoadingState
          title={t("rankings.profile.loadingTitle")}
          message={t("rankings.profile.loadingBody")}
          icon="trophy"
        />
      ) : queryIsError && !isPreview ? (
        <PageErrorState
          error={queryError}
          onRetry={() => void refetchProfile()}
          onBack={() => router.back()}
        />
      ) : profile ? (
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          className="flex-1 bg-bg"
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: 40,
            gap: 18,
          }}
          showsVerticalScrollIndicator={false}
          testID="public-profile-screen"
        >
          <ProfileHero profile={profile} />

          <SectionHeading
            title={t("rankings.profile.crownsTitle")}
            subtitle={t("rankings.profile.crownsSubtitle")}
          />
          <View
            style={{
              overflow: "hidden",
              borderRadius: 28,
              borderWidth: 1,
              borderColor: tc.secondaryDark,
              backgroundColor: tc.surface,
              padding: 20,
            }}
          >
            <View className="flex-row items-center gap-4">
              <LeaderboardCrownIcon size={52} color={tc.secondaryText} />
              <View className="flex-1">
                <Text selectable className="font-nunito text-sm text-fgMuted">
                  {t("rankings.profile.totalCrowns")}
                </Text>
                <Text
                  selectable
                  className="font-nunito-extrabold text-[34px] text-secondaryText"
                  style={{ fontVariant: ["tabular-nums"] }}
                >
                  {profile.crowns.total}
                </Text>
              </View>
              <View className="rounded-full bg-secondary px-3 py-1.5">
                <Text className="font-nunito-extrabold text-xs text-secondaryText">
                  {t("rankings.profile.nonTradable")}
                </Text>
              </View>
            </View>
          </View>

          <View className="flex-row flex-wrap justify-between gap-y-3">
            {CROWN_FAMILIES.map(({ key, labelKey, icon: Icon }) => (
              <View
                key={key}
                className="w-[48.5%] flex-row items-center gap-3 rounded-[22px] border border-primaryBorder bg-surface px-3 py-4"
              >
                <View className="size-11 items-center justify-center rounded-2xl bg-primaryTint">
                  <Icon size={25} color={tc.primaryText} />
                </View>
                <View className="min-w-0 flex-1">
                  <Text numberOfLines={1} className="font-nunito-bold text-xs text-fgMuted">
                    {t(labelKey)}
                  </Text>
                  <View className="flex-row items-center gap-1">
                    <LeaderboardCrownIcon size={18} color={tc.secondaryText} />
                    <Text
                      selectable
                      className="font-nunito-extrabold text-xl text-fg"
                      style={{ fontVariant: ["tabular-nums"] }}
                    >
                      {profile.crowns[key]}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>

          <SectionHeading
            title={t("rankings.profile.achievementsTitle")}
            subtitle={t("rankings.profile.achievementsSubtitle")}
          />
          <View className="flex-row gap-3">
            {MEDALS.map(({ key, color, tint }) => (
              <View
                key={key}
                className="flex-1 items-center gap-2 rounded-[24px] border px-2 py-4"
                style={{ borderColor: color + "66", backgroundColor: tint }}
              >
                <MedalIcon size={40} color={color} />
                <Text
                  selectable
                  className="font-nunito-extrabold text-[26px] text-fg"
                  style={{ fontVariant: ["tabular-nums"] }}
                >
                  {profile.medals[key]}
                </Text>
                <Text className="font-nunito-bold text-xs text-fgMuted">
                  {t(`rankings.profile.medals.${key}`)}
                </Text>
              </View>
            ))}
          </View>

          <SectionHeading title={t("rankings.profile.recentPlacements")} />
          <View className="overflow-hidden rounded-[26px] border border-primaryBorder bg-surface">
            {profile.recentPlacements.length > 0 ? (
              profile.recentPlacements.map((placement, index) => (
                <View
                  key={`${placement.boardKey}-${placement.weekStart}`}
                  className={`flex-row items-center gap-3 px-4 py-3.5 ${index > 0 ? "border-t border-primaryBorder" : ""}`}
                >
                  <PlacementBadge rank={placement.rank} medal={placement.medal} />
                  <View className="min-w-0 flex-1">
                    <Text numberOfLines={1} className="font-nunito-bold text-sm text-fg">
                      {t(BOARD_LABEL_KEYS[placement.boardKey])}
                    </Text>
                    <Text className="font-nunito text-xs text-fgMuted">
                      {formatWeek(placement.weekStart, locale)}
                    </Text>
                  </View>
                  <Text
                    selectable
                    className="font-nunito-extrabold text-sm text-primaryText"
                    style={{ fontVariant: ["tabular-nums"] }}
                  >
                    {placement.points} pts
                  </Text>
                </View>
              ))
            ) : (
              <EmptyCopy text={t("rankings.profile.noPlacements")} />
            )}
          </View>

          <SectionHeading title={t("rankings.profile.personalBests")} />
          <View className="overflow-hidden rounded-[26px] border border-primaryBorder bg-surface">
            {profile.personalBests.length > 0 ? (
              profile.personalBests.map((best, index) => (
                <View
                  key={best.boardKey}
                  className={`flex-row items-center gap-3 px-4 py-3.5 ${index > 0 ? "border-t border-primaryBorder" : ""}`}
                >
                  <TrophyIcon size={25} color={tc.primaryText} />
                  <View className="min-w-0 flex-1">
                    <Text numberOfLines={1} className="font-nunito-bold text-sm text-fg">
                      {t(BOARD_LABEL_KEYS[best.boardKey])}
                    </Text>
                    <Text className="font-nunito-semibold text-xs text-fgMuted">
                      {formatRawResult(best.rawResult)}
                    </Text>
                  </View>
                  <Text
                    selectable
                    className="font-nunito-extrabold text-sm text-primaryText"
                    style={{ fontVariant: ["tabular-nums"] }}
                  >
                    {best.points} pts
                  </Text>
                </View>
              ))
            ) : (
              <EmptyCopy text={t("rankings.profile.noPersonalBests")} />
            )}
          </View>
        </ScrollView>
      ) : null}
    </>
  );
}

function ProfileHero({ profile }: { profile: PublicLeaderboardProfile }) {
  const { t } = useTranslation();

  return (
    <View className="items-center gap-2 rounded-[30px] border border-primaryBorder bg-surface px-5 py-6">
      <LeaderboardAvatar
        avatarKey={profile.profile.fallbackAvatarKey}
        avatarUrl={profile.profile.avatarUrl}
        size={96}
      />
      <Text selectable className="text-center font-nunito-extrabold text-2xl text-fg">
        {profile.profile.displayName ?? t("rankings.profile.adventurer")}
      </Text>
      <Text selectable className="font-nunito-bold text-sm text-primaryText">
        {profile.profile.handle}
      </Text>
      <View className="rounded-full bg-primaryTint px-3 py-1">
        <Text className="font-nunito-bold text-xs text-primaryText">
          {t("rankings.profile.publicGameProfile")}
        </Text>
      </View>
    </View>
  );
}

function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View className="gap-1 px-1">
      <Text selectable className="font-nunito-extrabold text-xl text-fg">
        {title}
      </Text>
      {subtitle ? (
        <Text selectable className="font-nunito text-sm text-fgMuted">
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

function PlacementBadge({ rank, medal }: { rank: number; medal: "gold" | "silver" | "bronze" | null }) {
  const color =
    medal === "gold" ? "#F4C542" : medal === "silver" ? "#94A3B8" : medal === "bronze" ? "#C47A44" : "#DB2777";

  return (
    <View className="size-11 items-center justify-center rounded-full" style={{ backgroundColor: color + "22" }}>
      <Text
        selectable
        className="font-nunito-extrabold text-base"
        style={{ color, fontVariant: ["tabular-nums"] }}
      >
        #{rank}
      </Text>
    </View>
  );
}

function EmptyCopy({ text }: { text: string }) {
  return (
    <Text selectable className="px-5 py-6 text-center font-nunito text-sm text-fgMuted">
      {text}
    </Text>
  );
}

function LeaderboardCrownIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 8L8.5 12L12 5L15.5 12L20 8L18.3 18H5.7L4 8Z"
        fill={color}
        fillOpacity={0.25}
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <Path d="M6 21H18" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Circle cx={4} cy={7} r={1.5} fill={color} />
      <Circle cx={12} cy={4} r={1.5} fill={color} />
      <Circle cx={20} cy={7} r={1.5} fill={color} />
    </Svg>
  );
}

function MedalIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <Path d="M11 3H18L21 17H14L11 3Z" fill={color} fillOpacity={0.55} />
      <Path d="M29 3H22L19 17H26L29 3Z" fill={color} fillOpacity={0.8} />
      <Circle cx={20} cy={24} r={11} fill={color} />
      <Circle cx={20} cy={24} r={7} fill="#FFFFFF" fillOpacity={0.32} />
      <Path d="M20 18.5L21.7 22L25.5 22.5L22.7 25.2L23.4 29L20 27.2L16.6 29L17.3 25.2L14.5 22.5L18.3 22L20 18.5Z" fill="#FFFFFF" />
    </Svg>
  );
}

function formatWeek(weekStart: string, locale: "en" | "fr") {
  return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${weekStart}T12:00:00Z`));
}

function formatRawResult(raw: LeaderboardRow["rawResult"]) {
  if (raw.kind === "duration_error_ms") return `${raw.absoluteErrorMs} ms`;
  if (raw.kind === "steps") return raw.steps.toLocaleString();
  if (raw.kind === "correct_answers") return String(raw.correctAnswers);
  if (raw.kind === "wordle_outcome") return raw.outcome === "failed" ? "Failed" : `${raw.guesses}/6`;
  if (raw.kind === "exact_completion_time") return raw.exact ? `${(raw.elapsedMs / 1000).toFixed(1)} s` : "Not exact";
  return "—";
}
