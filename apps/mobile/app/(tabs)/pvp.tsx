import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Animated, ScrollView, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { ApiClientError } from "@adventure-time/api-client";

import { ThemedExpoButton } from "../../src/components/expo-ui/themed-button";
import { ThemedExpoTextInput } from "../../src/components/expo-ui/themed-text-input";
import { BattleFullScreenSheet } from "../../src/features/pvp/battle-full-screen-sheet";
import { ToastBanner } from "../../src/components/toast-banner";
import { LoadingPanel } from "../../src/components/loading-state";
import {
  CardsIcon,
  ChevronRightIcon,
  CheckIcon,
  ClockIcon,
  EyeIcon,
  SwordsIcon,
  TrophyIcon,
  UserPlusIcon,
  XIcon,
  ZapIcon,
} from "../../src/components/icons";
import { useTranslation } from "../../src/i18n";
import { apiClient } from "../../src/lib/api";
import { getCardImageCacheKey, getCardImageUrl } from "../../src/lib/card-images";
import { useSessionStore } from "../../src/stores/session-store";
import { useThemeStore } from "../../src/stores/theme-store";
import { useBottomTabBarContentPadding } from "../../src/theme/layout";
import { THEME_COLORS } from "../../src/theme/themes";

type ToastState = {
  message: string;
  type: "success" | "error";
};

type SearchableUser = {
  id: string;
  displayName: string;
  email: string;
};

function SectionHeading({
  title,
  toneColor,
  icon,
  action,
}: {
  title: string;
  toneColor: string;
  icon: ReactNode;
  action?: ReactNode;
}) {
  return (
    <View className="flex-row items-center gap-3">
      <View className="h-11 w-11 items-center justify-center rounded-2xl border border-primaryTint bg-surface">
        {icon}
      </View>
      <Text className="flex-1 font-nunito-bold text-lg" style={{ color: toneColor }}>
        {title}
      </Text>
      {action}
    </View>
  );
}

function getTimeAgo(
  dateStr: string,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  const diffMins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (diffMins < 1) return t("time.justNow");
  if (diffMins < 60) return t("time.minutesAgo", { count: diffMins });
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return t("time.hoursAgo", { count: diffHours });
  return t("time.daysAgo", { count: Math.floor(diffHours / 24) });
}

function getErrorMessage(
  error: unknown,
  fallback: string,
) {
  if (error instanceof ApiClientError) {
    return error.message || fallback;
  }

  if (error instanceof Error) {
    return error.message || fallback;
  }

  return fallback;
}

function getFuzzyTextScore(query: string, candidate: string) {
  const normalizedQuery = query.trim().toLowerCase();
  const normalizedCandidate = candidate.trim().toLowerCase();

  if (!normalizedQuery || !normalizedCandidate) {
    return null;
  }

  if (normalizedCandidate === normalizedQuery) {
    return 1_000;
  }

  if (normalizedCandidate.startsWith(normalizedQuery)) {
    return 900 - (normalizedCandidate.length - normalizedQuery.length);
  }

  const includesIndex = normalizedCandidate.indexOf(normalizedQuery);

  if (includesIndex >= 0) {
    return 800 - includesIndex;
  }

  let queryIndex = 0;
  let lastMatchIndex = -1;
  let gaps = 0;

  for (let candidateIndex = 0; candidateIndex < normalizedCandidate.length; candidateIndex += 1) {
    if (normalizedCandidate[candidateIndex] !== normalizedQuery[queryIndex]) {
      continue;
    }

    if (lastMatchIndex >= 0) {
      gaps += candidateIndex - lastMatchIndex - 1;
    }

    lastMatchIndex = candidateIndex;
    queryIndex += 1;

    if (queryIndex === normalizedQuery.length) {
      return 500 - gaps - (normalizedCandidate.length - normalizedQuery.length);
    }
  }

  return null;
}

function getUserSearchScore(
  query: string,
  user: SearchableUser,
) {
  return Math.max(
    getFuzzyTextScore(query, user.displayName) ?? Number.NEGATIVE_INFINITY,
    getFuzzyTextScore(query, user.email) ?? Number.NEGATIVE_INFINITY,
    getFuzzyTextScore(query, `${user.displayName} ${user.email}`) ?? Number.NEGATIVE_INFINITY,
  );
}

export default function PvpScreen() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const tc = THEME_COLORS[useThemeStore((state) => state.themeName)];
  const currentUserId = useSessionStore((state) => state.user?.id);
  const { t } = useTranslation();
  const bottomTabPadding = useBottomTabBarContentPadding();

  const [selectedInviteLoadoutId, setSelectedInviteLoadoutId] = useState<string | null>(null);
  const [selectedOpponentId, setSelectedOpponentId] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [loadoutSearchQuery, setLoadoutSearchQuery] = useState("");
  const [opponentSearchQuery, setOpponentSearchQuery] = useState("");
  const [acceptLoadoutMap, setAcceptLoadoutMap] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastAnim = useRef(new Animated.Value(-96)).current;

  const invitesQuery = useQuery({
    queryKey: ["pvp-invites"],
    queryFn: () => apiClient.pvpInvites(),
  });
  const matchesQuery = useQuery({
    queryKey: ["pvp-matches"],
    queryFn: () => apiClient.pvpMatches(),
  });
  const historyQuery = useQuery({
    queryKey: ["pvp-history"],
    queryFn: () => apiClient.pvpHistory(),
  });
  const loadoutsQuery = useQuery({
    queryKey: ["pvp-loadouts"],
    queryFn: () => apiClient.pvpLoadouts(),
  });
  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: () => apiClient.users(),
  });

  const validLoadouts = useMemo(
    () =>
      (loadoutsQuery.data?.loadouts ?? []).filter(
        (loadout) => loadout.invalidCardIds.length === 0,
      ),
    [loadoutsQuery.data?.loadouts],
  );
  const selectedInviteLoadout = useMemo(
    () =>
      validLoadouts.find((loadout) => loadout.id === selectedInviteLoadoutId) ?? null,
    [selectedInviteLoadoutId, validLoadouts],
  );
  const selectedOpponent = useMemo(
    () =>
      usersQuery.data?.users.find((user) => user.id === selectedOpponentId) ?? null,
    [selectedOpponentId, usersQuery.data?.users],
  );

  const pendingReceivedInvites =
    invitesQuery.data?.invites.filter((invite) => invite.inviteeId === currentUserId) ?? [];
  const pendingSentInvites =
    invitesQuery.data?.invites.filter((invite) => invite.inviterId === currentUserId) ?? [];
  const activeMatches = matchesQuery.data?.matches ?? [];
  const historyMatches = historyQuery.data?.matches ?? [];
  const allLoadouts = loadoutsQuery.data?.loadouts ?? [];
  const completedMatches = useMemo(
    () =>
      historyMatches.filter((match) => match.status === "COMPLETED").slice(0, 5),
    [historyMatches],
  );
  const sortedLoadouts = useMemo(
    () =>
      [...allLoadouts].sort((left, right) => {
        const leftOrder = left.invalidCardIds.length === 0 ? 0 : 1;
        const rightOrder = right.invalidCardIds.length === 0 ? 0 : 1;

        if (leftOrder !== rightOrder) {
          return leftOrder - rightOrder;
        }

        return left.name.localeCompare(right.name);
      }),
    [allLoadouts],
  );
  const hasValidLoadout = validLoadouts.length > 0;
  const hasLoadouts = allLoadouts.length > 0;
  const pendingChallengeCount = pendingReceivedInvites.length + pendingSentInvites.length;
  const hasAnyData =
    hasLoadouts ||
    (invitesQuery.data?.invites.length ?? 0) > 0 ||
    (matchesQuery.data?.matches.length ?? 0) > 0 ||
    completedMatches.length > 0;

  const interactionMap = useMemo(() => {
    const next: Record<string, "active" | "pending"> = {};

    activeMatches.forEach((match) => {
      const otherUserId =
        match.inviterId === currentUserId ? match.inviteeId : match.inviterId;
      next[otherUserId] = "active";
    });

    [...pendingSentInvites, ...pendingReceivedInvites].forEach((invite) => {
      const otherUserId =
        invite.inviterId === currentUserId ? invite.inviteeId : invite.inviterId;

      if (!next[otherUserId]) {
        next[otherUserId] = "pending";
      }
    });

    return next;
  }, [activeMatches, currentUserId, pendingReceivedInvites, pendingSentInvites]);
  const sortedOpponentUsers = useMemo(
    () =>
      [...(usersQuery.data?.users ?? [])]
        .filter((user) => user.id !== currentUserId)
        .sort((left, right) => {
          const leftBlocked = interactionMap[left.id] ? 1 : 0;
          const rightBlocked = interactionMap[right.id] ? 1 : 0;

          if (leftBlocked !== rightBlocked) {
            return leftBlocked - rightBlocked;
          }

          return left.displayName.localeCompare(right.displayName);
        }),
    [currentUserId, interactionMap, usersQuery.data?.users],
  );
  const challengeableUsers = useMemo(
    () => sortedOpponentUsers.filter((user) => !interactionMap[user.id]),
    [interactionMap, sortedOpponentUsers],
  );
  const normalizedLoadoutSearch = loadoutSearchQuery.trim().toLowerCase();
  const normalizedOpponentSearch = opponentSearchQuery.trim().toLowerCase();
  const filteredLoadouts = useMemo(() => {
    const filtered = validLoadouts.filter((loadout) =>
      normalizedLoadoutSearch.length === 0
        ? true
        : loadout.name.toLowerCase().includes(normalizedLoadoutSearch),
    );

    return [...filtered].sort((left, right) => {
      if (left.id === selectedInviteLoadoutId) {
        return -1;
      }

      if (right.id === selectedInviteLoadoutId) {
        return 1;
      }

      return left.name.localeCompare(right.name);
    });
  }, [normalizedLoadoutSearch, selectedInviteLoadoutId, validLoadouts]);
  const recentOpponentIds = useMemo(() => {
    const timestamps = new Map<string, number>();

    const pushRecentOpponent = (
      userId: string | null | undefined,
      timestampValue: string | null | undefined,
    ) => {
      if (!userId) {
        return;
      }

      const timestamp = Date.parse(timestampValue ?? "");

      if (!Number.isFinite(timestamp)) {
        return;
      }

      const currentTimestamp = timestamps.get(userId) ?? 0;

      if (timestamp > currentTimestamp) {
        timestamps.set(userId, timestamp);
      }
    };

    historyMatches.forEach((match) => {
      const otherUserId =
        match.inviterId === currentUserId ? match.inviteeId : match.inviterId;

      pushRecentOpponent(otherUserId, match.updatedAt || match.createdAt);
    });

    activeMatches.forEach((match) => {
      const otherUserId =
        match.inviterId === currentUserId ? match.inviteeId : match.inviterId;

      pushRecentOpponent(otherUserId, match.updatedAt || match.createdAt);
    });

    pendingSentInvites.forEach((invite) => {
      pushRecentOpponent(invite.inviteeId, invite.updatedAt || invite.createdAt);
    });

    pendingReceivedInvites.forEach((invite) => {
      pushRecentOpponent(invite.inviterId, invite.updatedAt || invite.createdAt);
    });

    return [...timestamps.entries()]
      .sort((left, right) => right[1] - left[1])
      .map(([userId]) => userId);
  }, [
    activeMatches,
    currentUserId,
    historyMatches,
    pendingReceivedInvites,
    pendingSentInvites,
  ]);
  const recentOpponentUsers = useMemo(() => {
    const challengeableUserMap = new Map(challengeableUsers.map((user) => [user.id, user]));
    const recentUsers: SearchableUser[] = [];
    const seen = new Set<string>();

    if (selectedOpponentId) {
      const selectedUser = challengeableUserMap.get(selectedOpponentId);

      if (selectedUser) {
        recentUsers.push(selectedUser);
        seen.add(selectedUser.id);
      }
    }

    recentOpponentIds.forEach((userId) => {
      const user = challengeableUserMap.get(userId);

      if (!user || seen.has(user.id) || recentUsers.length >= 5) {
        return;
      }

      recentUsers.push(user);
      seen.add(user.id);
    });

    return recentUsers.slice(0, 5);
  }, [challengeableUsers, recentOpponentIds, selectedOpponentId]);
  const searchedOpponentUsers = useMemo(() => {
    if (normalizedOpponentSearch.length === 0) {
      return [];
    }

    return sortedOpponentUsers
      .map((user) => ({
        user,
        score: getUserSearchScore(normalizedOpponentSearch, user),
      }))
      .filter((entry) => Number.isFinite(entry.score))
      .sort((left, right) => {
        if (left.user.id === selectedOpponentId) {
          return -1;
        }

        if (right.user.id === selectedOpponentId) {
          return 1;
        }

        const leftBlocked = interactionMap[left.user.id] ? 1 : 0;
        const rightBlocked = interactionMap[right.user.id] ? 1 : 0;

        if (leftBlocked !== rightBlocked) {
          return leftBlocked - rightBlocked;
        }

        if (left.score !== right.score) {
          return right.score - left.score;
        }

        return left.user.displayName.localeCompare(right.user.displayName);
      })
      .slice(0, 12)
      .map((entry) => entry.user);
  }, [interactionMap, normalizedOpponentSearch, selectedOpponentId, sortedOpponentUsers]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    toastAnim.setValue(-96);
    Animated.sequence([
      Animated.timing(toastAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.delay(3200),
      Animated.timing(toastAnim, {
        toValue: -96,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setToast(null);
      }
    });
  }, [toast, toastAnim]);

  const resetInviteSheetFilters = () => {
    setLoadoutSearchQuery("");
    setOpponentSearchQuery("");
  };

  const openInviteSheet = () => {
    resetInviteSheetFilters();
    setShowInviteModal(true);
  };

  const closeInviteSheet = () => {
    resetInviteSheetFilters();
    setShowInviteModal(false);
  };

  const refreshAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["pvp-invites"] }),
      queryClient.invalidateQueries({ queryKey: ["pvp-matches"] }),
      queryClient.invalidateQueries({ queryKey: ["pvp-history"] }),
      queryClient.invalidateQueries({ queryKey: ["pvp-loadouts"] }),
    ]);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!selectedInviteLoadout || !selectedOpponent) {
        throw new Error(t("pvp.failedSendInvite"));
      }

      return apiClient.createPvpInvite(
        selectedOpponent.email,
        selectedInviteLoadout.cardIds,
      );
    },
    onSuccess: async () => {
      setToast({ message: t("pvp.inviteSent"), type: "success" });
      setSelectedInviteLoadoutId(null);
      setSelectedOpponentId(null);
      closeInviteSheet();
      await refreshAll();
    },
    onError: (error) => {
      setToast({
        message: getErrorMessage(error, t("pvp.failedSendInvite")),
        type: "error",
      });
    },
  });

  const acceptMutation = useMutation({
    mutationFn: ({ id, cardIds }: { id: string; cardIds: string[] }) =>
      apiClient.acceptPvpMatch(id, cardIds),
    onSuccess: async (detail) => {
      await refreshAll();
      router.push(`/pvp-match?id=${detail.match.id}`);
    },
    onError: (error) => {
      setToast({
        message: getErrorMessage(error, t("pvp.failedAcceptInvite")),
        type: "error",
      });
    },
  });

  const declineMutation = useMutation({
    mutationFn: (id: string) => apiClient.declinePvpMatch(id),
    onSuccess: async () => {
      setToast({ message: t("pvp.inviteDeclined"), type: "success" });
      await refreshAll();
    },
    onError: (error) => {
      setToast({
        message: getErrorMessage(error, t("pvp.failedCancelInvite")),
        type: "error",
      });
    },
  });

  const cancelInviteMutation = useMutation({
    mutationFn: (id: string) => apiClient.cancelPvpInvite(id),
    onSuccess: async () => {
      setToast({ message: t("pvp.inviteDeclined"), type: "success" });
      await refreshAll();
    },
    onError: (error) => {
      setToast({
        message: getErrorMessage(error, t("pvp.failedCancelInvite")),
        type: "error",
      });
    },
  });

  return (
    <View className="flex-1 bg-bg">
      {toast ? (
        <ToastBanner
          message={toast.message}
          type={toast.type}
          translateY={toastAnim}
          successColor={tc.successDark}
          errorColor={tc.dangerDark}
        />
      ) : null}

      <ScrollView
        className="flex-1 bg-bg"
        contentContainerStyle={{ gap: 20, padding: 20, paddingBottom: bottomTabPadding }}
      >
        <View className="gap-4" testID="pvp-lobby-hero">
          <View
            style={{
              backgroundColor: tc.surfaceMuted,
              borderRadius: 28,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: tc.primaryBorder,
            }}
          >
            <View className="gap-5 px-5 py-6">
              <View className="flex-row items-start justify-between gap-3">
                <View className="flex-1 gap-3">
                  <View className="flex-row items-center gap-3">
                    <View className="h-14 w-14 items-center justify-center rounded-3xl bg-primaryTint">
                      <SwordsIcon size={28} color={tc.primaryDark} />
                    </View>
                    <View className="flex-1 gap-1">
                      <Text className="font-nunito-extrabold text-[28px] leading-[34px] text-fg">
                        {t("pvp.lobby.title")}
                      </Text>
                      <Text className="font-nunito text-sm leading-5 text-fgMuted">
                        {t("pvp.lobby.subtitle")}
                      </Text>
                    </View>
                  </View>
                  <View className="flex-row gap-3" testID="pvp-lobby-overview">
                    <View className="flex-1 rounded-2xl bg-surface px-3 py-3">
                      <Text className="font-nunito-extrabold text-2xl text-fg">
                        {activeMatches.length}
                      </Text>
                      <Text className="font-nunito-semibold text-xs text-fgMuted">
                        {t("pvp.liveMatches")}
                      </Text>
                    </View>
                    <View className="flex-1 rounded-2xl bg-surface px-3 py-3">
                      <Text className="font-nunito-extrabold text-2xl text-fg">
                        {pendingReceivedInvites.length}
                      </Text>
                      <Text className="font-nunito-semibold text-xs text-fgMuted">
                        {t("pvp.incomingChallenges")}
                      </Text>
                    </View>
                    <View className="flex-1 rounded-2xl bg-surface px-3 py-3">
                      <Text className="font-nunito-extrabold text-2xl text-fg">
                        {validLoadouts.length}
                      </Text>
                      <Text className="font-nunito-semibold text-xs text-fgMuted">
                        {t("pvp.myLoadouts")}
                      </Text>
                    </View>
                  </View>
                </View>
                {pendingReceivedInvites.length > 0 ? (
                  <View className="rounded-full bg-dangerTint px-3 py-1.5">
                    <Text className="font-nunito-bold text-xs text-dangerDark">
                      {pendingReceivedInvites.length}
                    </Text>
                  </View>
                ) : null}
              </View>

              <View className="flex-row gap-3">
                <ThemedExpoButton
                  onPress={() => router.push("/pvp-mechanics")}
                  preferFallback
                  style={{ flex: 1 }}
                  testID="pvp-open-mechanics-button"
                  variant="danger"
                  fallbackLayout="stretch"
                  fallbackAppearance={{
                    backgroundColor: tc.surface,
                    borderColor: tc.primaryBorder,
                    borderRadius: 20,
                    foregroundColor: tc.fg,
                    gradientColors: null,
                    minHeight: 0,
                    paddingHorizontal: 14,
                    paddingVertical: 14,
                  }}
                >
                  <View className="gap-2">
                    <View className="flex-row items-center justify-between gap-2">
                      <Text className="font-nunito-bold text-sm text-fg">
                        {t("pvp.mechanics.open")}
                      </Text>
                      <ChevronRightIcon size={18} color={tc.primaryDark} />
                    </View>
                    <Text className="font-nunito text-xs leading-5 text-fgMuted">
                      {t("pvp.mechanics.intro")}
                    </Text>
                  </View>
                </ThemedExpoButton>
                <ThemedExpoButton
                  onPress={() => router.push("/pvp-reference")}
                  preferFallback
                  style={{ flex: 1 }}
                  testID="pvp-open-reference-button"
                  variant="secondary"
                  fallbackLayout="stretch"
                  fallbackAppearance={{
                    backgroundColor: tc.surface,
                    borderColor: tc.accentBorder,
                    borderRadius: 20,
                    foregroundColor: tc.fg,
                    gradientColors: null,
                    minHeight: 0,
                    paddingHorizontal: 14,
                    paddingVertical: 14,
                  }}
                >
                  <View className="gap-2">
                    <View className="flex-row items-center justify-between gap-2">
                      <Text className="font-nunito-bold text-sm text-fg">
                        {t("pvp.reference.open")}
                      </Text>
                      <ChevronRightIcon size={18} color={tc.accentText} />
                    </View>
                    <Text className="font-nunito text-xs leading-5 text-fgMuted">
                      {t("pvp.reference.intro")}
                    </Text>
                  </View>
                </ThemedExpoButton>
              </View>
            </View>
          </View>

          <ThemedExpoButton
            onPress={() => {
              if (hasValidLoadout) {
                openInviteSheet();
                return;
              }

              router.push("/pvp-loadouts");
            }}
            preferFallback
            style={{ width: "100%" }}
            testID="pvp-primary-action-card"
            variant="primary"
            fallbackLayout="stretch"
            fallbackAppearance={{
              backgroundColor: tc.primaryBg,
              borderColor: tc.primaryBorder,
              borderRadius: 26,
              foregroundColor: tc.fg,
              gradientColors: null,
              minHeight: 0,
              paddingHorizontal: 18,
              paddingVertical: 20,
            }}
          >
            <View className="gap-4">
              <View className="flex-row items-start justify-between gap-3">
                <View className="flex-1 gap-2">
                  <View className="h-12 w-12 items-center justify-center rounded-2xl bg-primaryTint">
                    {hasValidLoadout ? (
                      <UserPlusIcon size={24} color={tc.primaryDark} />
                    ) : (
                      <CardsIcon size={24} color={tc.primaryDark} />
                    )}
                  </View>
                  <Text className="font-nunito-extrabold text-[28px] leading-[34px] text-fg">
                    {hasValidLoadout ? t("pvp.sendChallenge") : t("pvp.createLoadout")}
                  </Text>
                  <Text className="font-nunito text-sm leading-5 text-fgMuted">
                    {hasValidLoadout
                      ? t("pvp.challengeReadyHint")
                      : t("pvp.createLoadoutHint")}
                  </Text>
                </View>
                <ChevronRightIcon size={22} color={tc.primaryDark} />
              </View>
              <View className="flex-row flex-wrap gap-2">
                <View className="rounded-full bg-primaryTint px-3 py-1.5">
                  <Text className="font-nunito-semibold text-xs text-primaryDark">
                    {hasLoadouts ? validLoadouts.length : 0} {t("pvp.loadoutReady").toLowerCase()}
                  </Text>
                </View>
                {pendingChallengeCount > 0 ? (
                  <View className="rounded-full bg-accentTint px-3 py-1.5">
                    <Text className="font-nunito-semibold text-xs text-accentText">
                      {pendingChallengeCount} {t("pvp.openChallenges").toLowerCase()}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          </ThemedExpoButton>

          <View className="flex-row gap-3">
            <ThemedExpoButton
              onPress={() => router.push("/pvp-loadouts")}
              preferFallback
              style={{ flex: 1 }}
              variant="warning"
              fallbackLayout="stretch"
              fallbackAppearance={{
                backgroundColor: tc.surface,
                borderColor: tc.accentBorder,
                borderRadius: 24,
                foregroundColor: tc.fg,
                gradientColors: null,
                minHeight: 0,
                paddingHorizontal: 16,
                paddingVertical: 16,
              }}
            >
              <View className="gap-3">
                <View className="flex-row items-center justify-between gap-2">
                  <View className="h-11 w-11 items-center justify-center rounded-2xl bg-accentTint">
                    <CardsIcon size={22} color={tc.accentText} />
                  </View>
                  <ChevronRightIcon size={18} color={tc.accentText} />
                </View>
                <View className="gap-1">
                  <Text className="font-nunito-bold text-base text-fg">
                    {hasLoadouts ? t("pvp.editLoadouts") : t("pvp.createLoadout")}
                  </Text>
                  <Text className="font-nunito text-xs text-fgMuted">
                    {t("pvp.manageLoadoutsHint")}
                  </Text>
                </View>
              </View>
            </ThemedExpoButton>
            <ThemedExpoButton
              onPress={() => router.push("/pvp-spectate" as never)}
              preferFallback
              style={{ flex: 1 }}
              variant="secondary"
              fallbackLayout="stretch"
              fallbackAppearance={{
                backgroundColor: tc.surface,
                borderColor: tc.infoBorder,
                borderRadius: 24,
                foregroundColor: tc.fg,
                gradientColors: null,
                minHeight: 0,
                paddingHorizontal: 16,
                paddingVertical: 16,
              }}
            >
              <View className="gap-3">
                <View className="flex-row items-center justify-between gap-2">
                  <View className="h-11 w-11 items-center justify-center rounded-2xl bg-infoTint">
                    <EyeIcon size={22} color={tc.infoDark} />
                  </View>
                  <ChevronRightIcon size={18} color={tc.infoDark} />
                </View>
                <View className="gap-1">
                  <Text className="font-nunito-bold text-base text-fg">
                    {t("pvp.spectateOpen")}
                  </Text>
                  <Text className="font-nunito text-xs text-fgMuted">
                    {t("pvp.spectateHint")}
                  </Text>
                </View>
              </View>
            </ThemedExpoButton>
          </View>
        </View>

        {pendingReceivedInvites.length > 0 ? (
          <View className="gap-3">
            <SectionHeading
              title={t("pvp.incomingChallenges")}
              toneColor={tc.dangerDark}
              icon={<SwordsIcon size={20} color={tc.dangerDark} />}
              action={
                <View className="rounded-full bg-dangerTint px-3 py-1">
                  <Text className="font-nunito-bold text-xs text-dangerDark">
                    {pendingReceivedInvites.length}
                  </Text>
                </View>
              }
            />
            <View className="gap-4 rounded-[28px] border border-dangerBorder bg-dangerTint/80 p-4">
              {pendingReceivedInvites.map((invite) => {
                const selectedLoadoutId = acceptLoadoutMap[invite.id] ?? null;

                return (
                  <View
                    key={invite.id}
                    className="gap-3 rounded-[24px] border-2 border-dangerBorder bg-surface p-4"
                  >
                    <View className="flex-row items-center gap-3">
                      <View style={{ borderRadius: 20, overflow: "hidden", width: 40, height: 40 }}>
                        <LinearGradient
                          colors={[tc.danger, tc.dangerDark]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
                        >
                          <SwordsIcon size={20} color="white" />
                        </LinearGradient>
                      </View>
                      <View className="flex-1 gap-0.5">
                        <Text className="font-nunito-bold text-fg">
                          {invite.inviterName ?? `${invite.inviterId.slice(0, 12)}…`}
                        </Text>
                        <Text className="font-nunito text-xs text-fgMuted">
                          {t("pvp.challengeBy", { time: getTimeAgo(invite.createdAt, t) })}
                        </Text>
                      </View>
                    </View>

                    {validLoadouts.length > 0 ? (
                      <>
                        <Text className="font-nunito-semibold text-xs text-primaryDark">
                          {t("pvp.chooseLoadoutAccept")}
                        </Text>
                        <View className="gap-2">
                          {validLoadouts.map((loadout) => (
                            <ThemedExpoButton
                              key={loadout.id}
                              onPress={() =>
                                setAcceptLoadoutMap((current) => ({
                                  ...current,
                                  [invite.id]: loadout.id,
                                }))
                              }
                              preferFallback
                              variant="ghost"
                              fallbackAppearance={{
                                backgroundColor:
                                  selectedLoadoutId === loadout.id
                                    ? tc.primaryBg
                                    : tc.surface,
                                borderColor:
                                  selectedLoadoutId === loadout.id
                                    ? tc.primary
                                    : tc.primaryBorder,
                                borderRadius: 12,
                                foregroundColor: tc.fg,
                                gradientColors: null,
                                minHeight: 0,
                                paddingHorizontal: 12,
                                paddingVertical: 8,
                                textStyle: {
                                  fontFamily: "Nunito_600SemiBold",
                                  fontSize: 14,
                                },
                              }}
                            >
                              {loadout.name}
                            </ThemedExpoButton>
                          ))}
                        </View>
                        <View className="flex-row gap-2">
                          <ThemedExpoButton
                            disabled={!selectedLoadoutId || acceptMutation.isPending}
                            onPress={() => {
                              const selectedLoadout = validLoadouts.find(
                                (loadout) => loadout.id === selectedLoadoutId,
                              );

                              if (!selectedLoadout) {
                                return;
                              }

                              void acceptMutation.mutateAsync({
                                id: invite.id,
                                cardIds: selectedLoadout.cardIds,
                              });
                            }}
                            preferFallback
                            style={{ flex: 1 }}
                            variant="primary"
                            loading={acceptMutation.isPending}
                            fallbackLayout="stretch"
                            fallbackAppearance={{
                              backgroundColor: tc.success,
                              borderColor: tc.success,
                              borderRadius: 12,
                              foregroundColor: "#FFFFFF",
                              gradientColors: [tc.success, tc.successDark],
                              minHeight: 0,
                              paddingHorizontal: 16,
                              paddingVertical: 12,
                            }}
                          >
                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 6,
                              }}
                            >
                              <CheckIcon size={16} color="white" />
                              <Text className="font-nunito-bold text-white">
                                {t("pvp.acceptBattle")}
                              </Text>
                            </View>
                          </ThemedExpoButton>
                          <ThemedExpoButton
                            onPress={() => void declineMutation.mutateAsync(invite.id)}
                            preferFallback
                            style={{ flex: 1 }}
                            variant="ghost"
                            fallbackLayout="stretch"
                            fallbackAppearance={{
                              backgroundColor: tc.surfaceMuted,
                              borderColor: tc.surfaceMuted,
                              borderRadius: 12,
                              foregroundColor: tc.dangerDark,
                              gradientColors: null,
                              minHeight: 0,
                              paddingHorizontal: 16,
                              paddingVertical: 12,
                            }}
                          >
                            <View className="flex-row items-center justify-center gap-2">
                              <XIcon size={16} color={tc.dangerDark} />
                              <Text className="font-nunito-bold text-dangerDark">
                                {t("pvp.lobby.decline")}
                              </Text>
                            </View>
                          </ThemedExpoButton>
                        </View>
                      </>
                    ) : (loadoutsQuery.data?.loadouts.length ?? 0) > 0 ? (
                      <View className="rounded-xl border border-secondaryBorder bg-secondaryTint p-3">
                        <Text className="font-nunito text-sm text-secondaryText">
                          {t("pvp.allLoadoutsInvalid")}
                        </Text>
                        <ThemedExpoButton
                          onPress={() => router.push("/pvp-loadouts")}
                          preferFallback
                          variant="ghost"
                          fallbackAppearance={{
                            backgroundColor: "transparent",
                            borderColor: "transparent",
                            borderRadius: 8,
                            foregroundColor: tc.secondaryText,
                            gradientColors: null,
                            minHeight: 0,
                            paddingHorizontal: 0,
                            paddingVertical: 0,
                            textStyle: {
                              fontFamily: "Nunito_600SemiBold",
                              fontSize: 14,
                            },
                          }}
                          style={{ alignSelf: "flex-start", marginTop: 8 }}
                        >
                          {t("pvp.editLoadouts")}
                        </ThemedExpoButton>
                      </View>
                    ) : (
                      <View className="rounded-xl border border-secondaryBorder bg-secondaryTint p-3">
                        <Text className="font-nunito text-sm text-secondaryText">
                          {t("pvp.createLoadoutToAccept")}
                        </Text>
                        <ThemedExpoButton
                          onPress={() => router.push("/pvp-loadouts")}
                          preferFallback
                          variant="ghost"
                          fallbackAppearance={{
                            backgroundColor: "transparent",
                            borderColor: "transparent",
                            borderRadius: 8,
                            foregroundColor: tc.secondaryText,
                            gradientColors: null,
                            minHeight: 0,
                            paddingHorizontal: 0,
                            paddingVertical: 0,
                            textStyle: {
                              fontFamily: "Nunito_600SemiBold",
                              fontSize: 14,
                            },
                          }}
                          style={{ alignSelf: "flex-start", marginTop: 8 }}
                        >
                          {t("pvp.createLoadout")}
                        </ThemedExpoButton>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        {activeMatches.length > 0 ? (
          <View className="gap-3">
            <SectionHeading
              title={t("pvp.activeBattles", { count: activeMatches.length })}
              toneColor={tc.successDark}
              icon={<ZapIcon size={20} color={tc.successDark} />}
            />
            {activeMatches.map((match, index) => {
              const opponentId =
                match.inviterId === currentUserId ? match.inviteeId : match.inviterId;
              const opponentName =
                match.inviterId === currentUserId ? match.inviteeName : match.inviterName;

              return (
                <ThemedExpoButton
                  key={match.id}
                  onPress={() => router.push(`/pvp-match?id=${match.id}`)}
                  testID={`pvp-active-match-card-${index}`}
                  preferFallback
                  variant="primary"
                  fallbackLayout="stretch"
                  fallbackAppearance={{
                    backgroundColor: tc.surface,
                    borderColor: tc.successBorder,
                    borderRadius: 24,
                    foregroundColor: tc.fg,
                    gradientColors: null,
                    minHeight: 0,
                    paddingHorizontal: 16,
                    paddingVertical: 16,
                  }}
                >
                  <View className="h-11 w-11 items-center justify-center rounded-2xl bg-successTint">
                    <SwordsIcon size={20} color={tc.successDark} />
                  </View>
                  <View className="flex-1 gap-1">
                    <Text className="font-nunito-bold text-fg">
                      vs {opponentName ?? `${opponentId.slice(0, 10)}…`}
                    </Text>
                    <Text className="font-nunito text-xs text-successDark">
                      {t("pvp.lobby.turn", { count: match.currentTurn ?? 1 })}
                    </Text>
                  </View>
                  <View className="rounded-full bg-successTint px-3 py-1.5">
                    <Text className="font-nunito-bold text-xs text-successDark">
                      {t("pvp.continueArrow")}
                    </Text>
                  </View>
                </ThemedExpoButton>
              );
            })}
          </View>
        ) : null}

        {pendingSentInvites.length > 0 ? (
          <View className="gap-3">
            <SectionHeading
              title={t("pvp.sentInvites", { count: pendingSentInvites.length })}
              toneColor={tc.infoDark}
              icon={<ClockIcon size={20} color={tc.infoDark} />}
            />
            {pendingSentInvites.map((invite) => (
              <View
                key={invite.id}
                className="flex-row items-center gap-3 rounded-[24px] border border-infoBorder bg-surface p-4"
              >
                <View className="h-11 w-11 items-center justify-center rounded-2xl bg-infoTint">
                  <ClockIcon size={20} color={tc.info} />
                </View>
                <View className="flex-1">
                  <Text className="font-nunito-semibold text-fg">
                    {invite.inviteeName ?? `${invite.inviteeId.slice(0, 12)}…`}
                  </Text>
                  <Text className="font-nunito text-xs text-fgMuted">
                    {t("pvp.waitingResponse")}
                  </Text>
                </View>
                <ThemedExpoButton
                  disabled={cancelInviteMutation.isPending}
                  onPress={() => void cancelInviteMutation.mutateAsync(invite.id)}
                  testID={`pvp-cancel-invite-${invite.id}`}
                  variant="ghost"
                  fallbackAppearance={{
                    backgroundColor: "transparent",
                    borderColor: "transparent",
                    borderRadius: 12,
                    foregroundColor: tc.dangerDark,
                    gradientColors: null,
                    minHeight: 36,
                    paddingHorizontal: 8,
                    paddingVertical: 8,
                  }}
                  style={{ minHeight: 36, minWidth: 36 }}
                >
                  <XIcon size={20} color={tc.dangerDark} />
                </ThemedExpoButton>
              </View>
            ))}
          </View>
        ) : null}

        {completedMatches.length > 0 ? (
          <View className="gap-3">
            <SectionHeading
              title={t("pvp.recentBattles")}
              toneColor={tc.accentText}
              icon={<TrophyIcon size={20} color={tc.accentText} />}
              action={
                <ThemedExpoButton
                  onPress={() => router.push("/pvp-history" as never)}
                  testID="pvp-history-button"
                  preferFallback
                  variant="ghost"
                  fallbackAppearance={{
                    backgroundColor: "transparent",
                    borderColor: "transparent",
                    borderRadius: 8,
                    foregroundColor: tc.accentText,
                    gradientColors: null,
                    minHeight: 0,
                    paddingHorizontal: 0,
                    paddingVertical: 0,
                    textStyle: {
                      fontFamily: "Nunito_700Bold",
                      fontSize: 14,
                    },
                  }}
                >
                  {t("pvp.viewAllArrow")}
                </ThemedExpoButton>
              }
            />
            {completedMatches.map((match) => {
              const won = match.winnerId === currentUserId;
              const opponentId =
                match.inviterId === currentUserId ? match.inviteeId : match.inviterId;
              const opponentName =
                match.inviterId === currentUserId ? match.inviteeName : match.inviterName;

              return (
                <ThemedExpoButton
                  key={match.id}
                  disabled={!match.hasReplayData}
                  onPress={() => {
                    if (match.hasReplayData) {
                      router.push(`/pvp-replay?id=${match.id}` as never);
                    }
                  }}
                  preferFallback
                  variant={won ? "primary" : "danger"}
                  fallbackLayout="stretch"
                  fallbackAppearance={{
                    backgroundColor: tc.surface,
                    borderColor: won ? tc.successBorder : tc.dangerBorder,
                    borderRadius: 20,
                    foregroundColor: tc.fg,
                    gradientColors: null,
                    minHeight: 0,
                    paddingHorizontal: 12,
                    paddingVertical: 12,
                  }}
                >
                  <Text
                    className={`font-nunito-bold text-sm ${
                      won ? "text-successDark" : "text-dangerDark"
                    }`}
                  >
                    {won ? t("pvp.win") : t("pvp.loss")}
                  </Text>
                  <Text className="flex-1 font-nunito text-sm text-fgMuted">
                    vs {opponentName ?? `${opponentId.slice(0, 10)}…`}
                  </Text>
                  <Text className="font-nunito-bold text-xs text-accent">
                    {match.hasReplayData ? t("pvp.replayArrow") : t("pvp.noReplay")}
                  </Text>
                </ThemedExpoButton>
              );
            })}
          </View>
        ) : null}

        {!hasAnyData ? (
          <View className="overflow-hidden rounded-[28px] border border-primaryTint">
            <LinearGradient
              colors={[tc.primaryBg, tc.surface]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View className="items-center gap-3 px-6 py-8">
                <View className="h-16 w-16 items-center justify-center rounded-3xl bg-primaryTint">
                  <SwordsIcon size={34} color={tc.primaryDark} />
                </View>
                <Text className="text-center font-nunito-bold text-lg text-fg">
                  {t("pvp.readyForBattle")}
                </Text>
                <Text className="text-center font-nunito text-sm text-fgMuted">
                  {t("pvp.readyForBattleHint")}
                </Text>
              </View>
            </LinearGradient>
          </View>
        ) : null}

        {hasLoadouts ? (
          <View className="gap-3">
            <SectionHeading
              title={t("pvp.myLoadouts")}
              toneColor={tc.accentText}
              icon={<CardsIcon size={20} color={tc.accentText} />}
            />
            {sortedLoadouts.map((loadout) => {
              const isValid = loadout.invalidCardIds.length === 0;

              return (
                <View
                  key={loadout.id}
                  className={`rounded-[24px] border bg-surface/95 p-4 ${
                    isValid ? "border-accentBorder" : "border-dangerBorder"
                  }`}
                >
                  <View className="mb-3 flex-row items-center justify-between gap-3">
                    <Text className="flex-1 font-nunito-bold text-fg">{loadout.name}</Text>
                    <View
                      className={`rounded-full px-3 py-1 ${
                        isValid ? "bg-successTint" : "bg-dangerTint"
                      }`}
                    >
                      <Text
                        className={`font-nunito-bold text-xs ${
                          isValid ? "text-successDark" : "text-dangerDark"
                        }`}
                      >
                        {isValid ? t("pvp.loadoutReady") : t("pvp.loadoutNeedsFixes")}
                      </Text>
                    </View>
                  </View>
                  {!isValid ? (
                    <View className="mb-3 flex-row items-center gap-2 rounded-2xl border border-dangerBorder bg-dangerTint px-3 py-2">
                      <Text className="font-nunito-bold text-sm text-dangerDark">
                        {t("pvp.invalidLoadout", {
                          count: loadout.invalidCardIds.length,
                        })}
                      </Text>
                    </View>
                  ) : null}
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 8 }}
                  >
                    <View className="flex-row gap-1">
                      {loadout.cardIds.map((cardId, index) => {
                        const isInvalid = loadout.invalidCardIds.includes(cardId);
                        const card = loadout.cards.find((entry) => entry.id === cardId);

                        return isInvalid ? (
                          <View
                            key={`${loadout.id}-${cardId}-${index}`}
                            className="h-16 w-12 shrink-0 items-center justify-center rounded-lg border-2 border-dangerBorder bg-dangerTint"
                          >
                            <Text className="font-nunito-bold text-lg text-danger">?</Text>
                          </View>
                        ) : (
                          <View
                            key={`${loadout.id}-${cardId}-${index}`}
                            className={`h-16 w-12 shrink-0 overflow-hidden rounded-lg border-2 ${
                              index < 3 ? "border-success" : "border-primaryTint"
                            }`}
                          >
                            {card?.imageAssetId ? (
                              <Image
                                source={{
                                  uri: getCardImageUrl(card.imageAssetId),
                                  cacheKey: getCardImageCacheKey(card.imageAssetId),
                                }}
                                contentFit="cover"
                                cachePolicy="memory-disk"
                                style={{ width: "100%", height: "100%" }}
                              />
                            ) : (
                              <View className="h-full w-full items-center justify-center bg-surfaceMuted px-1">
                                <Text
                                  className="text-center font-nunito-bold text-[10px] text-fgMuted"
                                  numberOfLines={2}
                                >
                                  {card?.name ?? "?"}
                                </Text>
                              </View>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  </ScrollView>
                  <Text className="mt-2 font-nunito text-xs text-fgMuted">
                    {isValid ? t("pvp.manageLoadoutsHint") : t("pvp.firstThreeActive")}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : null}
      </ScrollView>

      <BattleFullScreenSheet
        visible={showInviteModal}
        title={t("pvp.sendChallenge")}
        onClose={closeInviteSheet}
        showCloseButton={false}
        footer={
          <View className="flex-row gap-3">
            <ThemedExpoButton
              onPress={closeInviteSheet}
              preferFallback
              style={{ flex: 1 }}
              variant="ghost"
              fallbackAppearance={{
                backgroundColor: tc.surface,
                borderColor: tc.primaryBorder,
                borderRadius: 12,
                foregroundColor: tc.fg,
                gradientColors: null,
                minHeight: 0,
                paddingHorizontal: 16,
                paddingVertical: 12,
                textStyle: {
                  fontFamily: "Nunito_700Bold",
                  fontSize: 14,
                },
              }}
            >
              {t("common.cancel")}
            </ThemedExpoButton>
            <ThemedExpoButton
              disabled={
                !selectedInviteLoadoutId ||
                !selectedOpponentId ||
                createMutation.isPending ||
                !hasValidLoadout
              }
              onPress={() => void createMutation.mutateAsync()}
              loading={createMutation.isPending}
              label={
                createMutation.isPending ? t("pvp.sending") : t("pvp.sendChallenge")
              }
              preferFallback
              style={{ flex: 1 }}
              variant="primary"
              fallbackAppearance={{
                backgroundColor: tc.primary,
                borderColor: tc.primary,
                borderRadius: 12,
                foregroundColor: "#FFFFFF",
                gradientColors: [tc.primary, tc.primaryDark],
                minHeight: 0,
                paddingHorizontal: 16,
                paddingVertical: 12,
                textStyle: {
                  fontFamily: "Nunito_700Bold",
                  fontSize: 14,
                },
              }}
            />
          </View>
        }
      >
        <View className="gap-5 px-5 pb-6 pt-5">
          <View className="gap-3 rounded-[28px] border border-primaryBorder bg-primaryBg p-4">
            <View className="gap-1">
              <Text className="font-nunito-bold text-base text-primaryDark">
                {t("pvp.challengeReadyHint")}
              </Text>
              <Text className="font-nunito text-sm leading-5 text-fgMuted">
                {t("pvp.challengeSheetIntro")}
              </Text>
            </View>

            <View className="gap-3">
              <View className="flex-row items-center gap-3 rounded-2xl border border-primaryBorder bg-surface p-3">
                <View className="h-11 w-11 items-center justify-center rounded-2xl bg-primaryTint">
                  <CardsIcon size={20} color={tc.primaryDark} />
                </View>
                <View className="flex-1 gap-0.5">
                  <Text className="font-nunito-bold text-xs uppercase tracking-[0.5px] text-primaryDark">
                    {t("pvp.selectLoadoutLabel")}
                  </Text>
                  <Text
                    className={`font-nunito-bold text-sm ${
                      selectedInviteLoadout ? "text-fg" : "text-fgMuted"
                    }`}
                    numberOfLines={1}
                  >
                    {selectedInviteLoadout?.name ?? t("pvp.selectLoadoutLabel")}
                  </Text>
                </View>
                {selectedInviteLoadout ? (
                  <View className="rounded-full bg-successTint px-3 py-1.5">
                    <Text className="font-nunito-bold text-xs text-successDark">
                      {selectedInviteLoadout.cardIds.length}/6
                    </Text>
                  </View>
                ) : null}
              </View>

              <View className="flex-row items-center gap-3 rounded-2xl border border-primaryBorder bg-surface p-3">
                <View className="h-11 w-11 items-center justify-center rounded-2xl bg-accentTint">
                  <UserPlusIcon size={20} color={tc.accentText} />
                </View>
                <View className="flex-1 gap-0.5">
                  <Text className="font-nunito-bold text-xs uppercase tracking-[0.5px] text-accentText">
                    {t("pvp.chooseOpponent").replace(":", "")}
                  </Text>
                  <Text
                    className={`font-nunito-bold text-sm ${
                      selectedOpponent ? "text-fg" : "text-fgMuted"
                    }`}
                    numberOfLines={1}
                  >
                    {selectedOpponent?.displayName ?? t("pvp.chooseOpponent").replace(":", "")}
                  </Text>
                </View>
                <View className="rounded-full bg-accentTint px-3 py-1.5">
                  <Text className="font-nunito-bold text-xs text-accentText">
                    {challengeableUsers.length}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {validLoadouts.length > 0 ? (
            <View className="gap-3 rounded-[28px] border border-primaryBorder bg-surface/95 p-4">
              <View className="flex-row items-center justify-between gap-3">
                <View className="flex-row items-center gap-3">
                  <View className="h-11 w-11 items-center justify-center rounded-2xl bg-primaryTint">
                    <CardsIcon size={20} color={tc.primaryDark} />
                  </View>
                  <View className="gap-0.5">
                    <Text className="font-nunito-bold text-base text-fg">
                      {t("pvp.selectLoadoutLabel")}
                    </Text>
                    <Text className="font-nunito text-xs text-fgMuted">
                      {filteredLoadouts.length} {t("pvp.loadoutReady").toLowerCase()}
                    </Text>
                  </View>
                </View>
                {selectedInviteLoadout ? (
                  <View className="rounded-full bg-successTint px-3 py-1.5">
                    <Text className="font-nunito-bold text-xs text-successDark">
                      {t("pvp.loadoutReady")}
                    </Text>
                  </View>
                ) : null}
              </View>
              <ThemedExpoTextInput
                value={loadoutSearchQuery}
                onChangeText={setLoadoutSearchQuery}
                placeholder={t("pvp.searchLoadoutsPlaceholder")}
                returnKeyType="search"
                hostStyle={{ width: "100%" }}
                style={{
                  backgroundColor: tc.surface,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: tc.primaryBorder,
                  height: 46,
                  paddingHorizontal: 12,
                  width: "100%",
                }}
                textStyle={{
                  color: tc.fg,
                  fontFamily: "Nunito_400Regular",
                  fontSize: 14,
                }}
                placeholderTextColor={tc.muted}
              />
              <View className="gap-2">
                {filteredLoadouts.length === 0 ? (
                  <View className="rounded-2xl border border-primaryBorder bg-primaryBg px-4 py-4">
                    <Text className="font-nunito text-sm text-fgMuted">
                      {t("pvp.noLoadoutMatches")}
                    </Text>
                  </View>
                ) : null}
                {filteredLoadouts.map((loadout) => (
                  <ThemedExpoButton
                    key={loadout.id}
                    onPress={() => setSelectedInviteLoadoutId(loadout.id)}
                    preferFallback
                    variant="ghost"
                    fallbackAppearance={{
                      backgroundColor:
                        selectedInviteLoadoutId === loadout.id
                          ? tc.primaryBg
                          : tc.surface,
                      borderColor:
                        selectedInviteLoadoutId === loadout.id
                          ? tc.primary
                          : tc.primaryBorder,
                      borderRadius: 12,
                      foregroundColor: tc.fg,
                      gradientColors: null,
                      minHeight: 0,
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                    }}
                    fallbackLayout="stretch"
                    preserveChildLayout
                  >
                    <View className="flex-row items-center gap-3">
                      <View
                        className={`h-11 w-11 items-center justify-center rounded-2xl ${
                          selectedInviteLoadoutId === loadout.id
                            ? "bg-primaryTint"
                            : "bg-surfaceMuted"
                        }`}
                      >
                        <CardsIcon
                          size={20}
                          color={
                            selectedInviteLoadoutId === loadout.id
                              ? tc.primaryDark
                              : tc.fgMuted
                          }
                        />
                      </View>
                      <View className="flex-1 gap-2">
                        <View className="gap-1">
                          <Text className="font-nunito-bold text-sm text-fg">
                            {loadout.name}
                          </Text>
                          <View className="flex-row items-center gap-2">
                            <View className="rounded-full bg-successTint px-2.5 py-1">
                              <Text className="font-nunito-bold text-[11px] text-successDark">
                                {t("pvp.loadoutReady")}
                              </Text>
                            </View>
                            <Text className="font-nunito text-xs text-fgMuted">
                              {loadout.cardIds.length}/6
                            </Text>
                          </View>
                        </View>
                        <View className="flex-row gap-1.5">
                          {loadout.cardIds.slice(0, 4).map((cardId, index) => {
                            const card = loadout.cards.find((entry) => entry.id === cardId);

                            return (
                              <View
                                key={`${loadout.id}-${cardId}-${index}`}
                                className="h-10 w-8 overflow-hidden rounded-lg border border-primaryTint bg-surfaceMuted"
                              >
                                {card?.imageAssetId ? (
                                  <Image
                                    source={{
                                      uri: getCardImageUrl(card.imageAssetId),
                                      cacheKey: getCardImageCacheKey(card.imageAssetId),
                                    }}
                                    contentFit="cover"
                                    cachePolicy="memory-disk"
                                    style={{ width: "100%", height: "100%" }}
                                  />
                                ) : (
                                  <View className="h-full w-full items-center justify-center px-1">
                                    <Text
                                      className="text-center font-nunito-bold text-[8px] text-fgMuted"
                                      numberOfLines={2}
                                    >
                                      {card?.name ?? "?"}
                                    </Text>
                                  </View>
                                )}
                              </View>
                            );
                          })}
                        </View>
                      </View>
                      {selectedInviteLoadoutId === loadout.id ? (
                        <CheckIcon size={18} color={tc.primaryDark} />
                      ) : null}
                    </View>
                  </ThemedExpoButton>
                ))}
              </View>
            </View>
          ) : (loadoutsQuery.data?.loadouts.length ?? 0) > 0 ? (
            <View className="rounded-[24px] border border-secondaryBorder bg-secondaryTint p-4">
              <Text className="font-nunito text-sm text-secondaryText">
                {t("pvp.allLoadoutsInvalid")}
              </Text>
            </View>
          ) : (
            <View className="rounded-[24px] border border-secondaryBorder bg-secondaryTint p-4">
              <Text className="font-nunito text-sm text-secondaryText">
                {t("pvp.createLoadoutToAccept")}
              </Text>
            </View>
          )}

          <View className="gap-3 rounded-[28px] border border-accentBorder bg-surface/95 p-4">
            <View className="flex-row items-center justify-between gap-3">
              <View className="flex-row items-center gap-3">
                <View className="h-11 w-11 items-center justify-center rounded-2xl bg-accentTint">
                  <UserPlusIcon size={20} color={tc.accentText} />
                </View>
                <View className="gap-0.5">
                  <Text className="font-nunito-bold text-base text-fg">
                    {t("pvp.chooseOpponent").replace(":", "")}
                  </Text>
                  <Text className="font-nunito text-xs text-fgMuted">
                    {normalizedOpponentSearch.length > 0
                      ? t("pvp.searchResults", { count: searchedOpponentUsers.length })
                      : t("pvp.recentOpponents", { count: recentOpponentUsers.length })}
                  </Text>
                </View>
              </View>
              {selectedOpponent ? (
                <View className="rounded-full bg-primaryTint px-3 py-1.5">
                  <Text className="font-nunito-bold text-xs text-primaryDark">
                    {selectedOpponent.displayName.charAt(0).toUpperCase()}
                  </Text>
                </View>
              ) : null}
            </View>
            <ThemedExpoTextInput
              value={opponentSearchQuery}
              onChangeText={setOpponentSearchQuery}
              placeholder={t("pvp.searchPlayersPlaceholder")}
              returnKeyType="search"
              hostStyle={{ width: "100%" }}
              style={{
                backgroundColor: tc.surface,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: tc.accentBorder,
                height: 46,
                paddingHorizontal: 12,
                width: "100%",
              }}
              textStyle={{
                color: tc.fg,
                fontFamily: "Nunito_400Regular",
                fontSize: 14,
              }}
              placeholderTextColor={tc.muted}
            />
            <View className="rounded-2xl border border-accentBorder bg-accentTint px-4 py-3">
              <Text className="font-nunito text-sm leading-5 text-fgMuted">
                {normalizedOpponentSearch.length > 0
                  ? t("pvp.searchPlayersHint")
                  : t("pvp.recentOpponentsHint")}
              </Text>
            </View>
            <View className="gap-2">
              {usersQuery.isLoading ? (
                <LoadingPanel
                  title={t("pvp.chooseOpponent")}
                  message={t("common.loadingStates.rosterBody")}
                  icon="people"
                />
              ) : sortedOpponentUsers.length === 0 ? (
                <View className="rounded-xl border border-primaryTint bg-surfaceMuted px-4 py-3">
                  <Text className="font-nunito text-fgMuted">
                    {t("pvp.noPlayersAvailable")}
                  </Text>
                </View>
              ) : normalizedOpponentSearch.length === 0 ? (
                recentOpponentUsers.length === 0 ? (
                  <View className="rounded-2xl border border-accentBorder bg-accentTint px-4 py-4">
                    <Text className="font-nunito text-sm text-fgMuted">
                      {t("pvp.noRecentOpponents")}
                    </Text>
                  </View>
                ) : (
                  recentOpponentUsers.map((user) => {
                    const isSelected = selectedOpponentId === user.id;

                    return (
                      <ThemedExpoButton
                        key={user.id}
                        onPress={() => setSelectedOpponentId(user.id)}
                        preferFallback
                        variant="ghost"
                        fallbackLayout="stretch"
                        fallbackAppearance={{
                          backgroundColor: isSelected ? tc.primaryBg : tc.surface,
                          borderColor: isSelected ? tc.primary : tc.primaryBorder,
                          borderRadius: 12,
                          foregroundColor: tc.fg,
                          gradientColors: null,
                          minHeight: 0,
                          paddingHorizontal: 16,
                          paddingVertical: 12,
                        }}
                        preserveChildLayout
                      >
                        <View className="flex-row items-center gap-3">
                          <View
                            className={`h-11 w-11 items-center justify-center rounded-2xl ${
                              isSelected ? "bg-primaryTint" : "bg-accentTint"
                            }`}
                          >
                            <Text
                              className={`font-nunito-bold ${
                                isSelected ? "text-primaryDark" : "text-accentText"
                              }`}
                            >
                              {user.displayName.charAt(0).toUpperCase()}
                            </Text>
                          </View>
                          <View className="flex-1 gap-1">
                            <Text className="font-nunito-bold text-sm text-fg">
                              {user.displayName}
                            </Text>
                            <Text className="font-nunito text-xs text-fgMuted">
                              {user.email}
                            </Text>
                          </View>
                          {isSelected ? <CheckIcon size={18} color={tc.primaryDark} /> : null}
                        </View>
                      </ThemedExpoButton>
                    );
                  })
                )
              ) : (
                <>
                  {searchedOpponentUsers.length === 0 ? (
                    <View className="rounded-2xl border border-accentBorder bg-accentTint px-4 py-4">
                      <Text className="font-nunito text-sm text-fgMuted">
                        {t("pvp.noPlayerMatches")}
                      </Text>
                    </View>
                  ) : null}
                  {searchedOpponentUsers.map((user) => {
                    const isSelected = selectedOpponentId === user.id;
                    const interaction = interactionMap[user.id];
                    const isUnavailable = Boolean(interaction);

                    return (
                      <ThemedExpoButton
                        key={user.id}
                        disabled={isUnavailable}
                        onPress={() => setSelectedOpponentId(user.id)}
                        preferFallback
                        variant="ghost"
                        fallbackLayout="stretch"
                        fallbackAppearance={{
                          backgroundColor: isUnavailable
                            ? tc.surfaceMuted
                            : isSelected
                              ? tc.primaryBg
                              : tc.surface,
                          borderColor: isUnavailable
                            ? tc.primaryBorder
                            : isSelected
                              ? tc.primary
                              : tc.primaryBorder,
                          borderRadius: 12,
                          foregroundColor: tc.fg,
                          gradientColors: null,
                          minHeight: 0,
                          paddingHorizontal: 16,
                          paddingVertical: 12,
                        }}
                        preserveChildLayout
                      >
                        <View className="flex-row items-center gap-3">
                          <View
                            className={`h-11 w-11 items-center justify-center rounded-2xl ${
                              isUnavailable
                                ? "bg-surface"
                                : isSelected
                                  ? "bg-primaryTint"
                                  : "bg-accentTint"
                            }`}
                          >
                            <Text
                              className={`font-nunito-bold ${
                                isUnavailable
                                  ? "text-fgMuted"
                                  : isSelected
                                    ? "text-primaryDark"
                                    : "text-accentText"
                              }`}
                            >
                              {user.displayName.charAt(0).toUpperCase()}
                            </Text>
                          </View>
                          <View className="flex-1 gap-1">
                            <Text className="font-nunito-bold text-sm text-fg">
                              {user.displayName}
                            </Text>
                            <Text className="font-nunito text-xs text-fgMuted">
                              {user.email}
                            </Text>
                          </View>
                          {isUnavailable ? (
                            <View className="rounded-full bg-surface px-3 py-1.5">
                              <Text className="font-nunito-bold text-[11px] text-fgMuted">
                                {interaction === "active"
                                  ? t("pvp.activeMatchExists")
                                  : t("pvp.pendingInviteExists")}
                              </Text>
                            </View>
                          ) : isSelected ? (
                            <CheckIcon size={18} color={tc.primaryDark} />
                          ) : null}
                        </View>
                      </ThemedExpoButton>
                    );
                  })}
                </>
              )}
            </View>
          </View>
        </View>
      </BattleFullScreenSheet>
    </View>
  );
}
