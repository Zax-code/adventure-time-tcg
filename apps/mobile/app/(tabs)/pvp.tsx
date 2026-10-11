import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ScrollView,
  Text,
  View,
  Pressable,
} from "react-native";
import {
  cancelAnimation,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import BookOpen from "lucide-react-native/icons/book-open";
import Check from "lucide-react-native/icons/check";
import Eye from "lucide-react-native/icons/eye";
import Layers from "lucide-react-native/icons/layers";
import Clock from "lucide-react-native/icons/clock";
import RotateCcwClock from "lucide-react-native/icons/rotate-ccw-clock";
import Swords from "lucide-react-native/icons/swords";
import X from "lucide-react-native/icons/x";
import Zap from "lucide-react-native/icons/zap";

import { ApiClientError } from "@adventure-time/api-client";
import { RADIUS } from "@adventure-time/theme";

import { Button } from "../../src/components/ui/button";
import { ThemedExpoTextInput } from "../../src/components/expo-ui/themed-text-input";
import { BattleFullScreenSheet } from "../../src/features/pvp/battle-full-screen-sheet";
import { ToastBanner } from "../../src/components/toast-banner";
import { LoadingPanel } from "../../src/components/loading-state";
import {
  CardsIcon,
  CheckIcon,
  UserPlusIcon,
} from "../../src/components/icons";
import { useFocusedRefetchInterval } from "../../src/hooks/use-focused-refetch-interval";
import { useTranslation } from "../../src/i18n";
import { apiClient } from "../../src/lib/api";
import {
  getCardImageCacheKey,
  getCardImageUrl,
} from "../../src/lib/card-images";
import { useSessionStore } from "../../src/stores/session-store";
import { useThemeStore } from "../../src/stores/theme-store";
import {
  useAppHeaderHeight,
  useBottomTabBarContentPadding,
} from "../../src/theme/layout";
import { THEME_COLORS } from "../../src/theme/themes";
import {
  formatTurnTimeout,
  useMinuteNow,
} from "../../src/features/pvp/turn-timeout";
import { Card } from "../../src/components/ui/card";
import { Chip } from "../../src/components/ui/chip";
import { IconTile } from "../../src/components/ui/icon-tile";
import { ListRow } from "../../src/components/ui/list-row";
import { Notice } from "../../src/components/ui/notice";
import { PageTitle } from "../../src/components/ui/page-title";
import { SectionHeader } from "../../src/components/ui/section-header";
import { StatTile } from "../../src/components/ui/stat-tile";

type ToastState = {
  message: string;
  type: "success" | "error";
};

const PVP_REFRESH_QUERY_KEYS = [
  ["pvp-invites"],
  ["pvp-matches"],
  ["pvp-history"],
  ["pvp-loadouts"],
] as const;

type SearchableUser = {
  id: string;
  displayName: string;
  email: string;
};

const PVP_LOBBY_REFETCH_INTERVAL_MS = 5_000;

type PvpLobbyMatchSummary = {
  inviterId: string;
  inviteeId: string;
  inviterName?: string | null;
  inviteeName?: string | null;
  inviterLoadout: string[];
  inviteeLoadout: string[];
};

type PvpLobbyTurnStatus = {
  isMyTurn: boolean;
  labelKey: string;
  tone: "viewer" | "opponent" | "unknown";
};

function getTimeAgo(
  dateStr: string,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  const diffMins = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 60000,
  );
  if (diffMins < 1) return t("time.justNow");
  if (diffMins < 60) return t("time.minutesAgo", { count: diffMins });
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return t("time.hoursAgo", { count: diffHours });
  return t("time.daysAgo", { count: Math.floor(diffHours / 24) });
}

function getErrorMessage(error: unknown, fallback: string) {
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

  for (
    let candidateIndex = 0;
    candidateIndex < normalizedCandidate.length;
    candidateIndex += 1
  ) {
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

function getUserSearchScore(query: string, user: SearchableUser) {
  return Math.max(
    getFuzzyTextScore(query, user.displayName) ?? Number.NEGATIVE_INFINITY,
    getFuzzyTextScore(query, user.email) ?? Number.NEGATIVE_INFINITY,
    getFuzzyTextScore(query, `${user.displayName} ${user.email}`) ??
      Number.NEGATIVE_INFINITY,
  );
}

function getPlayerDisplayLabel(
  name: string | null | undefined,
  userId: string,
  t: (key: string, params?: Record<string, string | number>) => string,
) {
  const trimmedName = name?.trim();

  if (trimmedName) {
    return trimmedName;
  }

  return t("pvp.unknownPlayerWithId", { id: userId.slice(0, 8) });
}

function getLobbyMatchSummary(
  match: PvpLobbyMatchSummary,
  currentUserId: string | null | undefined,
  t: (key: string, params?: Record<string, string | number>) => string,
) {
  const inviterLabel = getPlayerDisplayLabel(
    match.inviterName,
    match.inviterId,
    t,
  );
  const inviteeLabel = getPlayerDisplayLabel(
    match.inviteeName,
    match.inviteeId,
    t,
  );

  if (currentUserId === match.inviterId) {
    return {
      title: `vs ${inviteeLabel}`,
      viewerLoadoutCount: match.inviterLoadout.length,
      opponentLoadoutCount: match.inviteeLoadout.length,
    };
  }

  if (currentUserId === match.inviteeId) {
    return {
      title: `vs ${inviterLabel}`,
      viewerLoadoutCount: match.inviteeLoadout.length,
      opponentLoadoutCount: match.inviterLoadout.length,
    };
  }

  return {
    title: `${inviterLabel} vs ${inviteeLabel}`,
    viewerLoadoutCount: match.inviterLoadout.length,
    opponentLoadoutCount: match.inviteeLoadout.length,
  };
}

function getLobbyTurnStatus(
  match: { currentPlayerId?: string | null },
  currentUserId: string | null | undefined,
): PvpLobbyTurnStatus {
  if (!match.currentPlayerId || !currentUserId) {
    return {
      isMyTurn: false,
      labelKey: "pvp.activeBattleTurnUnknown",
      tone: "unknown",
    };
  }

  if (match.currentPlayerId === currentUserId) {
    return {
      isMyTurn: true,
      labelKey: "pvp.activeBattleYourTurn",
      tone: "viewer",
    };
  }

  return {
    isMyTurn: false,
    labelKey: "pvp.activeBattleTheirTurn",
    tone: "opponent",
  };
}

export default function PvpScreen() {
  return usePvpScreenView();
}

function usePvpScreenView() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const tc = THEME_COLORS[useThemeStore((state) => state.themeName)];
  const currentUserId = useSessionStore((state) => state.user?.id);
  const { t } = useTranslation();
  const headerHeight = useAppHeaderHeight();
  const bottomTabPadding = useBottomTabBarContentPadding();
  const bottomContentPadding = bottomTabPadding + 14;

  const [selectedInviteLoadoutId, setSelectedInviteLoadoutId] = useState<
    string | null
  >(null);
  const [selectedOpponentId, setSelectedOpponentId] = useState<string | null>(
    null,
  );
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [loadoutSearchQuery, setLoadoutSearchQuery] = useState("");
  const [opponentSearchQuery, setOpponentSearchQuery] = useState("");
  const [acceptLoadoutMap, setAcceptLoadoutMap] = useState<
    Record<string, string>
  >({});
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastAnim = useSharedValue(-96);

  const lobbyRefetchInterval = useFocusedRefetchInterval(
    PVP_LOBBY_REFETCH_INTERVAL_MS,
  );
  const { data: invitesQueryData } = useQuery({
    queryKey: ["pvp-invites"],
    queryFn: () => apiClient.pvpInvites(),
    refetchOnMount: "always",
    refetchInterval: lobbyRefetchInterval,
  });
  const { data: matchesQueryData } = useQuery({
    queryKey: ["pvp-matches"],
    queryFn: () => apiClient.pvpMatches(),
    refetchOnMount: "always",
    refetchInterval: lobbyRefetchInterval,
  });
  const { data: historyQueryData } = useQuery({
    queryKey: ["pvp-history"],
    queryFn: () => apiClient.pvpHistory(),
    refetchOnMount: "always",
    refetchInterval: lobbyRefetchInterval,
  });
  const { data: spectateQueryData } = useQuery({
    queryKey: ["pvp-spectate"],
    queryFn: () => apiClient.pvpSpectate(),
    refetchInterval: lobbyRefetchInterval,
  });
  const { data: loadoutsQueryData } = useQuery({
    queryKey: ["pvp-loadouts"],
    queryFn: () => apiClient.pvpLoadouts(),
  });
  const { data: usersQueryData, isLoading: usersQueryIsLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => apiClient.users(),
  });
  const currentPvpUserId =
    matchesQueryData?.currentUserId ??
    historyQueryData?.currentUserId ??
    currentUserId ??
    null;

  useFocusEffect(
    useCallback(() => {
      void Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["pvp-invites"],
          refetchType: "active",
        }),
        queryClient.invalidateQueries({
          queryKey: ["pvp-matches"],
          refetchType: "active",
        }),
        queryClient.invalidateQueries({
          queryKey: ["pvp-history"],
          refetchType: "active",
        }),
      ]);
    }, [queryClient]),
  );

  const validLoadouts = useMemo(
    () =>
      (loadoutsQueryData?.loadouts ?? []).filter(
        (loadout) => loadout.invalidCardIds.length === 0,
      ),
    [loadoutsQueryData?.loadouts],
  );
  const selectedInviteLoadout = useMemo(
    () =>
      validLoadouts.find((loadout) => loadout.id === selectedInviteLoadoutId) ??
      null,
    [selectedInviteLoadoutId, validLoadouts],
  );
  const selectedOpponent = useMemo(
    () =>
      usersQueryData?.users.find((user) => user.id === selectedOpponentId) ??
      null,
    [selectedOpponentId, usersQueryData?.users],
  );

  const pendingReceivedInvites = useMemo(
    () =>
      invitesQueryData?.invites.filter(
        (invite) => invite.inviteeId === currentPvpUserId,
      ) ?? [],
    [currentPvpUserId, invitesQueryData?.invites],
  );
  const pendingSentInvites = useMemo(
    () =>
      invitesQueryData?.invites.filter(
        (invite) => invite.inviterId === currentPvpUserId,
      ) ?? [],
    [currentPvpUserId, invitesQueryData?.invites],
  );
  const activeMatches = useMemo(
    () => matchesQueryData?.matches ?? [],
    [matchesQueryData?.matches],
  );
  const now = useMinuteNow(activeMatches.length > 0);
  const historyMatches = useMemo(
    () => historyQueryData?.matches ?? [],
    [historyQueryData?.matches],
  );
  const allLoadouts = useMemo(
    () => loadoutsQueryData?.loadouts ?? [],
    [loadoutsQueryData?.loadouts],
  );
  const hasValidLoadout = validLoadouts.length > 0;
  const hasLoadouts = allLoadouts.length > 0;
  const inviteActionDisabled = !hasValidLoadout;
  const inviteActionHint = hasValidLoadout
    ? t("pvp.challengeReadyHint")
    : hasLoadouts
      ? t("pvp.allLoadoutsInvalid")
      : t("pvp.needLoadoutToInvite");
  const spectateMatchCount = spectateQueryData?.matches.length ?? 0;
  const wins = historyQueryData?.stats?.wins ?? 0;
  const losses = historyQueryData?.stats?.losses ?? 0;
  const draws = historyQueryData?.stats?.draws ?? 0;
  const interactionMap = useMemo(() => {
    const next: Record<string, "active" | "pending"> = {};

    activeMatches.forEach((match) => {
      const otherUserId =
        match.inviterId === currentPvpUserId ? match.inviteeId : match.inviterId;
      next[otherUserId] = "active";
    });

    [...pendingSentInvites, ...pendingReceivedInvites].forEach((invite) => {
      const otherUserId =
        invite.inviterId === currentPvpUserId
          ? invite.inviteeId
          : invite.inviterId;

      if (!next[otherUserId]) {
        next[otherUserId] = "pending";
      }
    });

    return next;
  }, [
    activeMatches,
    currentPvpUserId,
    pendingReceivedInvites,
    pendingSentInvites,
  ]);
  const sortedOpponentUsers = useMemo(
    () =>
      [...(usersQueryData?.users ?? [])]
        .filter((user) => user.id !== currentPvpUserId)
        .sort((left, right) => {
          const leftBlocked = interactionMap[left.id] ? 1 : 0;
          const rightBlocked = interactionMap[right.id] ? 1 : 0;

          if (leftBlocked !== rightBlocked) {
            return leftBlocked - rightBlocked;
          }

          return left.displayName.localeCompare(right.displayName);
        }),
    [currentPvpUserId, interactionMap, usersQueryData?.users],
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
        match.inviterId === currentPvpUserId ? match.inviteeId : match.inviterId;

      pushRecentOpponent(otherUserId, match.updatedAt || match.createdAt);
    });

    activeMatches.forEach((match) => {
      const otherUserId =
        match.inviterId === currentPvpUserId ? match.inviteeId : match.inviterId;

      pushRecentOpponent(otherUserId, match.updatedAt || match.createdAt);
    });

    pendingSentInvites.forEach((invite) => {
      pushRecentOpponent(
        invite.inviteeId,
        invite.updatedAt || invite.createdAt,
      );
    });

    pendingReceivedInvites.forEach((invite) => {
      pushRecentOpponent(
        invite.inviterId,
        invite.updatedAt || invite.createdAt,
      );
    });

    return [...timestamps.entries()]
      .sort((left, right) => right[1] - left[1])
      .map(([userId]) => userId);
  }, [
    activeMatches,
    currentPvpUserId,
    historyMatches,
    pendingReceivedInvites,
    pendingSentInvites,
  ]);
  const recentOpponentUsers = useMemo(() => {
    const challengeableUserMap = new Map(
      challengeableUsers.map((user) => [user.id, user]),
    );
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
      .flatMap((user) => {
        const score = getUserSearchScore(normalizedOpponentSearch, user);

        return Number.isFinite(score) ? [{ user, score }] : [];
      })
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
  }, [
    interactionMap,
    normalizedOpponentSearch,
    selectedOpponentId,
    sortedOpponentUsers,
  ]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    toastAnim.value = -96;
    toastAnim.value = withSequence(
      withTiming(0, { duration: 180 }),
      withDelay(
        3200,
        withTiming(-96, { duration: 180 }, (finished) => {
          if (finished) {
            scheduleOnRN(setToast, null);
          }
        }),
      ),
    );
    return () => cancelAnimation(toastAnim);
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
      await Promise.all(
        PVP_REFRESH_QUERY_KEYS.map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      );
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
      await Promise.all(
        PVP_REFRESH_QUERY_KEYS.map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      );
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
      await Promise.all(
        PVP_REFRESH_QUERY_KEYS.map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      );
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
      await Promise.all(
        PVP_REFRESH_QUERY_KEYS.map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      );
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
          topOffset={headerHeight + 16}
        />
      ) : null}

      <ScrollView
        className="flex-1 bg-bg"
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 0,
        }}
      >
        <View
          className="gap-ds-3"
          testID="pvp-lobby-hero"
          style={{ paddingTop: headerHeight }}
        >
          <PageTitle
            title={t("pvp.lobby.title")}
            subtitle={t("pvp.lobby.subtitle")}
          />
          <View className="flex-row gap-ds-3" testID="pvp-lobby-overview">
            <StatTile
              className="flex-1"
              tone="success"
              label={t("pvp.hub.liveMatches")}
              value={activeMatches.length}
            />
            <StatTile
              className="flex-1"
              tone={pendingReceivedInvites.length > 0 ? "danger" : "primary"}
              label={t("pvp.hub.incoming")}
              value={pendingReceivedInvites.length}
            />
            <StatTile
              className="flex-1"
              tone="accent"
              label={t("pvp.hub.myLoadouts")}
              value={validLoadouts.length}
            />
          </View>

          {activeMatches.map((match, index) => {
            const timeoutLabel = formatTurnTimeout(
              match.turnExpiresAt,
              t,
              now,
            );
            const summary = getLobbyMatchSummary(match, currentPvpUserId, t);
            const turnStatus = getLobbyTurnStatus(match, currentPvpUserId);
            const turnParts = [
              t(turnStatus.labelKey),
              t("pvp.hub.turnShort", { count: match.currentTurn ?? 1 }),
              ...(timeoutLabel
                ? [t("pvp.hub.expiresIn", { remaining: timeoutLabel.remaining })]
                : []),
            ];

            return (
              <Pressable
                key={match.id}
                onPress={() => router.push(`/pvp-match?id=${match.id}`)}
                testID={`pvp-active-match-card-${index}`}
                accessibilityRole="button"
                accessibilityLabel={`${summary.title}. ${t(turnStatus.labelKey)}. ${t(
                  "pvp.continueBattle",
                )}`}
              >
                <Notice
                  tone={turnStatus.isMyTurn ? "success" : "info"}
                  icon={Zap}
                  title={t("pvp.hub.activeBattle", { title: summary.title })}
                  body={t("pvp.hub.activeBattleBody", {
                    status: turnParts.join(" · "),
                  })}
                />
              </Pressable>
            );
          })}

          {pendingReceivedInvites.map((invite) => {
            const selectedLoadoutId = acceptLoadoutMap[invite.id] ?? null;

            return (
              <Card
                key={invite.id}
                tone="danger"
                testID={`pvp-incoming-invite-${invite.id}`}
              >
                <View className="flex-row items-center gap-ds-3">
                  <IconTile icon={Swords} tone="danger" size={40} onTint />
                  <View className="flex-1 gap-[2px]">
                    <Text className="font-nunito-extrabold text-ds-body text-dangerText">
                      {t("pvp.hub.incomingChallenge", {
                        name:
                          invite.inviterName ??
                          `${invite.inviterId.slice(0, 12)}…`,
                      })}
                    </Text>
                    <Text className="font-nunito text-ds-sm text-fg">
                      {t("pvp.challengeBy", {
                        time: getTimeAgo(invite.createdAt, t),
                      })}
                    </Text>
                  </View>
                </View>

                {validLoadouts.length > 0 ? (
                  <>
                    <Text className="font-nunito-bold text-ds-sm text-fg">
                      {t("pvp.chooseLoadoutAccept")}
                    </Text>
                    <View className="flex-row flex-wrap gap-ds-2">
                      {validLoadouts.map((loadout) => (
                        <Chip
                          key={loadout.id}
                          tone={
                            selectedLoadoutId === loadout.id
                              ? "selected"
                              : "neutral"
                          }
                          label={loadout.name}
                          accessibilityState={{
                            selected: selectedLoadoutId === loadout.id,
                          }}
                          onPress={() =>
                            setAcceptLoadoutMap((current) => ({
                              ...current,
                              [invite.id]: loadout.id,
                            }))
                          }
                        />
                      ))}
                    </View>
                    <View className="flex-row gap-ds-3">
                      <Button
                        tone="ghost"
                        icon={X}
                        onPress={() => declineMutation.mutate(invite.id)}
                        style={{ flex: 1 }}
                      >
                        {t("pvp.lobby.decline")}
                      </Button>
                      <Button
                        tone="primary"
                        icon={Check}
                        disabled={
                          !selectedLoadoutId || acceptMutation.isPending
                        }
                        onPress={() => {
                          const selectedLoadout = validLoadouts.find(
                            (loadout) => loadout.id === selectedLoadoutId,
                          );

                          if (!selectedLoadout) {
                            return;
                          }

                          acceptMutation.mutate({
                            id: invite.id,
                            cardIds: selectedLoadout.cardIds,
                          });
                        }}
                        style={{ flex: 1 }}
                        loading={acceptMutation.isPending}
                      >
                        {t("pvp.acceptBattle")}
                      </Button>
                    </View>
                  </>
                ) : (
                  <View className="gap-ds-2">
                    <Text className="font-nunito text-ds-sm text-fg">
                      {hasLoadouts
                        ? t("pvp.allLoadoutsInvalid")
                        : t("pvp.createLoadoutToAccept")}
                    </Text>
                    <Button
                      tone="ghost"
                      size="sm"
                      onPress={() => router.push("/pvp-loadouts")}
                      style={{ alignSelf: "flex-start" }}
                    >
                      {hasLoadouts
                        ? t("pvp.hub.editLoadouts")
                        : t("pvp.hub.createLoadout")}
                    </Button>
                  </View>
                )}
              </Card>
            );
          })}

          <Card tone={inviteActionDisabled ? "neutral" : "primary"}>
            <View className="gap-[2px]">
              <Text
                className={`font-nunito-extrabold text-ds-h2 ${
                  inviteActionDisabled ? "text-fgMuted" : "text-fg"
                }`}
              >
                {t("pvp.hub.sendChallenge")}
              </Text>
              <Text className="font-nunito text-ds-body text-fgMuted">
                {inviteActionHint}
              </Text>
            </View>
            <View className="flex-row flex-wrap gap-ds-2">
              <Chip
                tone={inviteActionDisabled ? "neutral" : "success"}
                icon={inviteActionDisabled ? undefined : Check}
                label={t(
                  validLoadouts.length === 1
                    ? "pvp.hub.loadoutReadyOne"
                    : "pvp.hub.loadoutReadyMany",
                  { count: validLoadouts.length },
                )}
              />
            </View>
            <Button
              size="lg"
              icon={Swords}
              disabled={inviteActionDisabled}
              onPress={openInviteSheet}
              testID="pvp-primary-action-card"
            >
              {t("pvp.hub.sendChallenge")}
            </Button>
          </Card>

          {pendingSentInvites.length > 0 ? (
            <Card flush testID="pvp-sent-invites">
              {pendingSentInvites.map((invite, index) => (
                <ListRow
                  key={invite.id}
                  icon={Clock}
                  iconTone="info"
                  title={t("pvp.hub.sentInvite", {
                    name:
                      invite.inviteeName ??
                      `${invite.inviteeId.slice(0, 12)}…`,
                  })}
                  meta={t("pvp.waitingResponse")}
                  divider={index < pendingSentInvites.length - 1}
                  trailingAction={{
                    tone: "danger",
                    icon: X,
                    disabled: cancelInviteMutation.isPending,
                    onPress: () => cancelInviteMutation.mutate(invite.id),
                    testID: `pvp-cancel-invite-${invite.id}`,
                    accessibilityLabel: t("common.cancel"),
                  }}
                />
              ))}
            </Card>
          ) : null}

          <SectionHeader title={t("pvp.hub.more")} />
          <Card flush>
            <ListRow
              icon={Layers}
              iconTone="accent"
              title={
                hasLoadouts ? t("pvp.hub.editLoadouts") : t("pvp.hub.createLoadout")
              }
              meta={
                hasLoadouts
                  ? t(
                      allLoadouts.length === 1
                        ? "pvp.hub.savedTeamsOne"
                        : "pvp.hub.savedTeamsMany",
                      { count: allLoadouts.length },
                    )
                  : t("pvp.hub.noSavedTeams")
              }
              chevron
              onPress={() => router.push("/pvp-loadouts")}
              testID="pvp-open-loadouts-button"
            />
            <ListRow
              icon={Eye}
              iconTone="info"
              title={t("pvp.spectateOpen")}
              meta={t(
                spectateMatchCount === 1
                  ? "pvp.hub.liveMatchOne"
                  : "pvp.hub.liveMatchMany",
                { count: spectateMatchCount },
              )}
              chevron
              onPress={() => router.push("/pvp-spectate" as never)}
              testID="pvp-open-spectate-button"
            />
            <ListRow
              icon={RotateCcwClock}
              iconTone="primary"
              title={t("pvp.hub.matchHistory")}
              meta={
                draws > 0
                  ? t("pvp.hub.recordWithDraws", { wins, losses, draws })
                  : t("pvp.hub.record", { wins, losses })
              }
              chevron
              onPress={() => router.push("/pvp-history" as never)}
              testID="pvp-history-button"
            />
            <ListRow
              icon={BookOpen}
              iconTone="secondary"
              title={t("pvp.hub.howPvpWorks")}
              meta={t("pvp.hub.howPvpWorksMeta")}
              chevron
              divider={false}
              onPress={() => router.push("/pvp-mechanics")}
              testID="pvp-open-mechanics-button"
            />
          </Card>
        </View>
        <View style={{ height: bottomContentPadding }} />
      </ScrollView>

      <BattleFullScreenSheet
        visible={showInviteModal}
        title={t("pvp.sendChallenge")}
        onClose={closeInviteSheet}
        testID="pvp-invite-sheet"
        iosPresentation="modal"
        showCloseButton={false}
        footer={
          <View className="flex-row gap-3">
            <Button
              tone="ghost"
              onPress={closeInviteSheet}
              style={{ flex: 1 }}
              testID="pvp-invite-sheet-cancel-button"
            >
              {t("common.cancel")}
            </Button>
            <Button
              tone="primary"
              disabled={
                !selectedInviteLoadoutId ||
                !selectedOpponentId ||
                createMutation.isPending ||
                !hasValidLoadout
              }
              onPress={() => createMutation.mutate()}
              loading={createMutation.isPending}
              style={{ flex: 1 }}
            >
              {
                createMutation.isPending
                  ? t("pvp.sending")
                  : t("pvp.sendChallenge")
              }
            </Button>
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
                    {selectedOpponent?.displayName ??
                      t("pvp.chooseOpponent").replace(":", "")}
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
                      {filteredLoadouts.length}{" "}
                      {t("pvp.loadoutReady").toLowerCase()}
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
                  <Pressable
                    key={loadout.id}
                    onPress={() => setSelectedInviteLoadoutId(loadout.id)}
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      {
                        borderRadius: RADIUS.md,
                        borderWidth: 1,
                        borderColor: selectedInviteLoadoutId === loadout.id
                          ? tc.primary
                          : tc.primaryBorder,
                        backgroundColor: selectedInviteLoadoutId === loadout.id
                          ? tc.primaryBg
                          : tc.surface,
                        paddingHorizontal: 16,
                        paddingVertical: 12,
                        opacity: pressed ? 0.85 : 1,
                      },
                    ]}
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
                            const card = loadout.cards.find(
                              (entry) => entry.id === cardId,
                            );

                            return (
                              <View
                                key={`${loadout.id}-${cardId}-${index}`}
                                className="h-10 w-8 overflow-hidden rounded-lg border border-primaryTint bg-surfaceMuted"
                              >
                                {card?.imageAssetId ? (
                                  <Image
                                    source={{
                                      uri: getCardImageUrl(card.imageAssetId),
                                      cacheKey: getCardImageCacheKey(
                                        card.imageAssetId,
                                      ),
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
                  </Pressable>
                ))}
              </View>
            </View>
          ) : (loadoutsQueryData?.loadouts.length ?? 0) > 0 ? (
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
                      ? t("pvp.searchResults", {
                          count: searchedOpponentUsers.length,
                        })
                      : t("pvp.recentOpponents", {
                          count: recentOpponentUsers.length,
                        })}
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
              {usersQueryIsLoading ? (
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
                      <Pressable
                        key={user.id}
                        onPress={() => setSelectedOpponentId(user.id)}
                        accessibilityRole="button"
                        style={({ pressed }) => [
                          {
                            borderRadius: RADIUS.md,
                            borderWidth: 1,
                            borderColor: isSelected
                            ? tc.primary
                            : tc.primaryBorder,
                            backgroundColor: isSelected
                            ? tc.primaryBg
                            : tc.surface,
                            paddingHorizontal: 16,
                            paddingVertical: 12,
                            opacity: pressed ? 0.85 : 1,
                          },
                        ]}
                      >
                        <View className="flex-row items-center gap-3">
                          <View
                            className={`h-11 w-11 items-center justify-center rounded-2xl ${
                              isSelected ? "bg-primaryTint" : "bg-accentTint"
                            }`}
                          >
                            <Text
                              className={`font-nunito-bold ${
                                isSelected
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
                          {isSelected ? (
                            <CheckIcon size={18} color={tc.primaryDark} />
                          ) : null}
                        </View>
                      </Pressable>
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
                      <Pressable
                        key={user.id}
                        onPress={() => setSelectedOpponentId(user.id)}
                        disabled={isUnavailable}
                        accessibilityRole="button"
                        style={({ pressed }) => [
                          {
                            borderRadius: RADIUS.md,
                            borderWidth: 1,
                            borderColor: isUnavailable
                            ? tc.primaryBorder
                            : isSelected
                              ? tc.primary
                              : tc.primaryBorder,
                            backgroundColor: isUnavailable
                            ? tc.surfaceMuted
                            : isSelected
                              ? tc.primaryBg
                              : tc.surface,
                            paddingHorizontal: 16,
                            paddingVertical: 12,
                            opacity: isUnavailable ? 0.6 : pressed ? 0.85 : 1,
                          },
                        ]}
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
                      </Pressable>
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
