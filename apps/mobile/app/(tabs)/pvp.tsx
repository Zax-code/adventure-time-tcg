import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { ApiClientError } from "@adventure-time/api-client";

import { ToastBanner } from "../../src/components/toast-banner";
import { LoadingPanel } from "../../src/components/loading-state";
import {
  CheckIcon,
  ClockIcon,
  SwordsIcon,
  TrophyIcon,
  UserPlusIcon,
  XIcon,
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

  const pendingReceivedInvites =
    invitesQuery.data?.invites.filter((invite) => invite.inviteeId === currentUserId) ?? [];
  const pendingSentInvites =
    invitesQuery.data?.invites.filter((invite) => invite.inviterId === currentUserId) ?? [];
  const activeMatches = matchesQuery.data?.matches ?? [];
  const completedMatches = useMemo(
    () =>
      (historyQuery.data?.matches ?? [])
        .filter((match) => match.status === "COMPLETED")
        .slice(0, 5),
    [historyQuery.data?.matches],
  );
  const hasValidLoadout = validLoadouts.length > 0;
  const hasAnyData =
    (loadoutsQuery.data?.loadouts.length ?? 0) > 0 ||
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
      const selectedLoadout = validLoadouts.find((loadout) => loadout.id === selectedInviteLoadoutId);
      const selectedOpponent = usersQuery.data?.users.find((user) => user.id === selectedOpponentId);

      if (!selectedLoadout || !selectedOpponent) {
        throw new Error(t("pvp.failedSendInvite"));
      }

      return apiClient.createPvpInvite(selectedOpponent.email, selectedLoadout.cardIds);
    },
    onSuccess: async () => {
      setToast({ message: t("pvp.inviteSent"), type: "success" });
      setSelectedInviteLoadoutId(null);
      setSelectedOpponentId(null);
      setShowInviteModal(false);
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
        <View className="mb-1 items-center gap-2">
          <View style={{ position: "relative", alignItems: "center" }}>
            <View className="flex-row items-center gap-2">
              <SwordsIcon size={32} color={tc.primaryDark} />
              <Text className="font-nunito-extrabold text-3xl text-primaryDark">
                {t("pvp.lobby.title")}
              </Text>
            </View>
            {pendingReceivedInvites.length > 0 ? (
              <View
                style={{ position: "absolute", top: -6, right: -32 }}
                className="min-w-5 items-center justify-center rounded-full bg-dangerDark px-1.5 py-0.5"
              >
                <Text className="font-nunito-bold text-xs text-white">
                  {pendingReceivedInvites.length}
                </Text>
              </View>
            ) : null}
          </View>
          <Text className="text-center font-nunito-semibold text-sm text-primary">
            {t("pvp.lobby.subtitle")}
          </Text>
          <View className="mt-1 flex-row gap-3">
            <Pressable
              onPress={() => router.push("/pvp-mechanics")}
              className="rounded-xl border border-dangerBorder bg-dangerTint px-4 py-2"
            >
              <Text className="font-nunito-bold text-sm text-dangerText">
                {t("pvp.mechanics.open")}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => router.push("/pvp-reference")}
              className="rounded-xl border border-infoBorder bg-infoTint px-4 py-2"
            >
              <Text className="font-nunito-bold text-sm text-infoDark">
                {t("pvp.reference.open")}
              </Text>
            </Pressable>
          </View>
        </View>

        <View className="flex-row gap-3">
          <Pressable
            disabled={!hasValidLoadout}
            style={{
              flex: 1,
              borderRadius: 16,
              overflow: "hidden",
              opacity: hasValidLoadout ? 1 : 0.5,
            }}
            onPress={() => setShowInviteModal(true)}
          >
            <LinearGradient
              colors={[tc.primary, tc.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ alignItems: "center", paddingVertical: 16, paddingHorizontal: 12, gap: 4 }}
            >
              <UserPlusIcon size={22} color="white" />
              <Text className="text-center font-nunito-bold text-xs text-white">
                {t("pvp.sendInvite")}
              </Text>
            </LinearGradient>
          </Pressable>
          <Pressable
            style={{ flex: 1, borderRadius: 16, overflow: "hidden" }}
            onPress={() => router.push("/pvp-loadouts")}
          >
            <LinearGradient
              colors={[tc.accent, tc.accentDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ alignItems: "center", paddingVertical: 16, paddingHorizontal: 12, gap: 4 }}
            >
              <SwordsIcon size={22} color="white" />
              <Text className="text-center font-nunito-bold text-xs text-white">
                {(loadoutsQuery.data?.loadouts.length ?? 0) > 0
                  ? t("pvp.editLoadouts")
                  : t("pvp.createLoadout")}
              </Text>
            </LinearGradient>
          </Pressable>
          <Pressable
            style={{ flex: 1, borderRadius: 16, overflow: "hidden" }}
            onPress={() => router.push("/pvp-spectate" as never)}
          >
            <LinearGradient
              colors={[tc.info, tc.infoDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ alignItems: "center", paddingVertical: 16, paddingHorizontal: 12, gap: 4 }}
            >
              <SwordsIcon size={22} color="white" />
              <Text className="text-center font-nunito-bold text-xs text-white">
                {t("pvp.spectateOpen")}
              </Text>
            </LinearGradient>
          </Pressable>
        </View>

        {pendingReceivedInvites.length > 0 ? (
          <View>
            <LinearGradient
              colors={[tc.danger, tc.dangerDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                borderTopLeftRadius: 16,
                borderTopRightRadius: 16,
                paddingHorizontal: 16,
                paddingVertical: 10,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
              }}
            >
              <SwordsIcon size={20} color="white" />
              <Text className="flex-1 font-nunito-bold text-white">
                {t("pvp.incomingChallenges")}
              </Text>
              <View className="items-center justify-center rounded-full bg-surface px-2 py-0.5">
                <Text className="font-nunito-bold text-xs text-dangerDark">
                  {pendingReceivedInvites.length}
                </Text>
              </View>
            </LinearGradient>

            <View className="gap-4 rounded-b-2xl border-2 border-t-0 border-dangerBorder bg-dangerTint p-4">
              {pendingReceivedInvites.map((invite) => {
                const selectedLoadoutId = acceptLoadoutMap[invite.id] ?? null;

                return (
                  <View
                    key={invite.id}
                    className="gap-3 rounded-xl border-2 border-dangerBorder bg-surface p-4"
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
                      <View className="flex-1">
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
                            <Pressable
                              key={loadout.id}
                              onPress={() =>
                                setAcceptLoadoutMap((current) => ({
                                  ...current,
                                  [invite.id]: loadout.id,
                                }))
                              }
                              className={`rounded-xl border-2 px-3 py-2 ${
                                selectedLoadoutId === loadout.id
                                  ? "border-primary bg-primaryBg"
                                  : "border-primaryTint bg-surface"
                              }`}
                            >
                              <Text className="font-nunito-semibold text-fg">
                                {loadout.name}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                        <View className="flex-row gap-2">
                          <Pressable
                            disabled={!selectedLoadoutId || acceptMutation.isPending}
                            style={{
                              flex: 1,
                              borderRadius: 12,
                              overflow: "hidden",
                              opacity: selectedLoadoutId && !acceptMutation.isPending ? 1 : 0.5,
                            }}
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
                          >
                            <LinearGradient
                              colors={[tc.success, tc.successDark]}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 1 }}
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                justifyContent: "center",
                                paddingVertical: 12,
                                paddingHorizontal: 16,
                                gap: 6,
                              }}
                            >
                              <CheckIcon size={16} color="white" />
                              <Text className="font-nunito-bold text-white">
                                {acceptMutation.isPending
                                  ? t("pvp.accepting")
                                  : t("pvp.acceptBattle")}
                              </Text>
                            </LinearGradient>
                          </Pressable>
                          <Pressable
                            className="flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-surfaceMuted px-4 py-3"
                            onPress={() => void declineMutation.mutateAsync(invite.id)}
                          >
                            <XIcon size={16} color={tc.dangerDark} />
                            <Text className="font-nunito-bold text-dangerDark">
                              {t("pvp.lobby.decline")}
                            </Text>
                          </Pressable>
                        </View>
                      </>
                    ) : (loadoutsQuery.data?.loadouts.length ?? 0) > 0 ? (
                      <View className="rounded-xl border border-secondaryBorder bg-secondaryTint p-3">
                        <Text className="font-nunito text-sm text-secondaryText">
                          {t("pvp.allLoadoutsInvalid")}
                        </Text>
                        <Pressable onPress={() => router.push("/pvp-loadouts")} className="mt-2">
                          <Text className="font-nunito-semibold text-sm text-secondaryText">
                            {t("pvp.editLoadouts")}
                          </Text>
                        </Pressable>
                      </View>
                    ) : (
                      <View className="rounded-xl border border-secondaryBorder bg-secondaryTint p-3">
                        <Text className="font-nunito text-sm text-secondaryText">
                          {t("pvp.createLoadoutToAccept")}
                        </Text>
                        <Pressable onPress={() => router.push("/pvp-loadouts")} className="mt-2">
                          <Text className="font-nunito-semibold text-sm text-secondaryText">
                            {t("pvp.createLoadout")}
                          </Text>
                        </Pressable>
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
            <View className="flex-row items-center gap-2">
              <SwordsIcon size={20} color={tc.successDark} />
              <Text className="font-nunito-bold text-lg text-successDark">
                {t("pvp.activeBattles", { count: activeMatches.length })}
              </Text>
            </View>
            {activeMatches.map((match) => {
              const opponentId =
                match.inviterId === currentUserId ? match.inviteeId : match.inviterId;
              const opponentName =
                match.inviterId === currentUserId ? match.inviteeName : match.inviterName;

              return (
                <Pressable
                  key={match.id}
                  className="flex-row items-center gap-3 rounded-2xl border-2 border-successBorder bg-surface p-4"
                  onPress={() => router.push(`/pvp-match?id=${match.id}`)}
                >
                  <View className="h-10 w-10 items-center justify-center rounded-full bg-successTint">
                    <SwordsIcon size={20} color={tc.successDark} />
                  </View>
                  <View className="flex-1">
                    <Text className="font-nunito-bold text-fg">
                      vs {opponentName ?? `${opponentId.slice(0, 10)}…`}
                    </Text>
                    <Text className="font-nunito text-xs text-successDark">
                      {t("pvp.lobby.turn", { count: match.currentTurn ?? 1 })}
                    </Text>
                  </View>
                  <Text className="font-nunito-bold text-success">
                    {t("pvp.continueArrow")}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {pendingSentInvites.length > 0 ? (
          <View className="gap-3">
            <View className="flex-row items-center gap-2">
              <ClockIcon size={20} color={tc.infoDark} />
              <Text className="font-nunito-bold text-lg text-infoDark">
                {t("pvp.sentInvites", { count: pendingSentInvites.length })}
              </Text>
            </View>
            {pendingSentInvites.map((invite) => (
              <View
                key={invite.id}
                className="flex-row items-center gap-3 rounded-2xl border-2 border-infoBorder bg-surface p-4"
              >
                <View className="h-10 w-10 items-center justify-center rounded-full bg-infoTint">
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
                <Pressable
                  disabled={cancelInviteMutation.isPending}
                  onPress={() => void cancelInviteMutation.mutateAsync(invite.id)}
                  className="p-2"
                >
                  <XIcon size={20} color={tc.dangerDark} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}

        {completedMatches.length > 0 ? (
          <View className="gap-3">
            <View className="flex-row items-center gap-2">
              <TrophyIcon size={20} color={tc.primary} />
              <Text className="flex-1 font-nunito-bold text-lg text-fg">
                {t("pvp.recentBattles")}
              </Text>
              <Pressable onPress={() => router.push("/pvp-history" as never)}>
                <Text className="font-nunito-bold text-sm text-accentText">
                  {t("pvp.viewAllArrow")}
                </Text>
              </Pressable>
            </View>
            {completedMatches.map((match) => {
              const won = match.winnerId === currentUserId;
              const opponentId =
                match.inviterId === currentUserId ? match.inviteeId : match.inviterId;
              const opponentName =
                match.inviterId === currentUserId ? match.inviteeName : match.inviterName;

              return (
                <Pressable
                  key={match.id}
                  disabled={!match.hasReplayData}
                  className={`flex-row items-center gap-3 rounded-xl border bg-surface p-3 ${
                    won ? "border-successBorder" : "border-dangerBorder"
                  } ${match.hasReplayData ? "" : "opacity-70"}`}
                  onPress={() => {
                    if (match.hasReplayData) {
                      router.push(`/pvp-replay?id=${match.id}` as never);
                    }
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
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {!hasAnyData ? (
          <View className="items-center gap-3 rounded-2xl border border-primaryTint bg-surface p-8">
            <SwordsIcon size={48} color={tc.primaryBorder} />
            <Text className="text-center font-nunito-bold text-lg text-fg">
              {t("pvp.readyForBattle")}
            </Text>
            <Text className="text-center font-nunito text-sm text-fgMuted">
              {t("pvp.readyForBattleHint")}
            </Text>
          </View>
        ) : null}

        {(loadoutsQuery.data?.loadouts.length ?? 0) > 0 ? (
          <View className="gap-3">
            <Text className="font-nunito-bold text-lg text-accentText">
              {t("pvp.myLoadouts")}
            </Text>
            {loadoutsQuery.data!.loadouts.map((loadout) => {
              const isValid = loadout.invalidCardIds.length === 0;

              return (
                <View
                  key={loadout.id}
                  className={`rounded-2xl border-2 bg-surface/90 p-4 shadow-lg ${
                    isValid ? "border-accentBorder" : "border-dangerBorder"
                  }`}
                >
                  {!isValid ? (
                    <View className="mb-3 flex-row items-center gap-2 rounded-lg border border-dangerBorder bg-dangerTint px-3 py-2">
                      <Text className="font-nunito-bold text-sm text-dangerDark">
                        {t("pvp.invalidLoadout", {
                          count: loadout.invalidCardIds.length,
                        })}
                      </Text>
                    </View>
                  ) : null}
                  <Text className="mb-2 font-nunito-bold text-fg">{loadout.name}</Text>
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
                                className="h-full w-full"
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
                  <Text className="mt-1 font-nunito text-xs text-fgMuted">
                    {t("pvp.firstThreeActive")}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : null}
      </ScrollView>

      <Modal
        animationType="slide"
        transparent
        visible={showInviteModal}
        onRequestClose={() => setShowInviteModal(false)}
      >
        <View className="flex-1 justify-end" style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
          <View className="gap-5 rounded-t-3xl bg-surface p-6">
            <View className="flex-row items-center justify-between">
              <Text className="font-nunito-bold text-xl text-primaryText">
                {t("pvp.sendChallenge")}
              </Text>
              <Pressable onPress={() => setShowInviteModal(false)} className="p-1">
                <XIcon size={22} color={tc.dangerDark} />
              </Pressable>
            </View>

            {validLoadouts.length > 0 ? (
              <View className="gap-2">
                <Text className="font-nunito-semibold text-sm text-primaryDark">
                  {t("pvp.selectLoadoutLabel")}
                </Text>
                <View className="gap-2">
                  {validLoadouts.map((loadout) => (
                    <Pressable
                      key={loadout.id}
                      onPress={() => setSelectedInviteLoadoutId(loadout.id)}
                      className={`rounded-xl border-2 px-4 py-3 ${
                        selectedInviteLoadoutId === loadout.id
                          ? "border-primary bg-primaryBg"
                          : "border-primaryTint bg-surface"
                      }`}
                    >
                      <Text className="font-nunito-semibold text-fg">{loadout.name}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : (loadoutsQuery.data?.loadouts.length ?? 0) > 0 ? (
              <View className="rounded-xl border border-secondaryBorder bg-secondaryTint p-3">
                <Text className="font-nunito text-sm text-secondaryText">
                  {t("pvp.allLoadoutsInvalid")}
                </Text>
              </View>
            ) : (
              <View className="rounded-xl border border-secondaryBorder bg-secondaryTint p-3">
                <Text className="font-nunito text-sm text-secondaryText">
                  {t("pvp.createLoadoutToAccept")}
                </Text>
              </View>
            )}

            <View className="gap-2">
              <Text className="font-nunito-semibold text-sm text-primaryDark">
                {t("pvp.chooseOpponent")}
              </Text>
              <ScrollView style={{ maxHeight: 240 }} showsVerticalScrollIndicator={false}>
                <View className="gap-2">
                  {usersQuery.isLoading ? (
                    <LoadingPanel
                      title={t("pvp.chooseOpponent")}
                      message={t("common.loadingStates.rosterBody")}
                      icon="people"
                    />
                  ) : (usersQuery.data?.users.length ?? 0) === 0 ? (
                    <View className="rounded-xl border border-primaryTint bg-surfaceMuted px-4 py-3">
                      <Text className="font-nunito text-fgMuted">{t("pvp.noPlayersAvailable")}</Text>
                    </View>
                  ) : (
                    usersQuery.data!.users.map((user) => {
                      const interaction = interactionMap[user.id];
                      const hasInteraction = interaction != null;
                      const isSelected = selectedOpponentId === user.id;

                      return (
                        <Pressable
                          key={user.id}
                          disabled={hasInteraction}
                          onPress={() => setSelectedOpponentId(user.id)}
                          className={`rounded-xl border-2 px-4 py-3 ${
                            hasInteraction
                              ? "border-primaryTint bg-surfaceMuted opacity-50"
                              : isSelected
                                ? "border-primary bg-primaryBg"
                                : "border-primaryTint bg-surface"
                          }`}
                        >
                          <View className="flex-row items-center gap-3">
                            <View className="h-10 w-10 items-center justify-center rounded-full bg-primaryTint">
                              <Text className="font-nunito-bold text-primaryDark">
                                {user.displayName.charAt(0).toUpperCase()}
                              </Text>
                            </View>
                            <Text className="flex-1 font-nunito-semibold text-fg">
                              {user.displayName}
                            </Text>
                            {hasInteraction ? (
                              <Text className="font-nunito text-xs text-fgMuted">
                                {interaction === "active"
                                  ? t("pvp.activeMatchExists")
                                  : t("pvp.pendingInviteExists")}
                              </Text>
                            ) : isSelected ? (
                              <CheckIcon size={18} color={tc.primaryDark} />
                            ) : null}
                          </View>
                        </Pressable>
                      );
                    })
                  )}
                </View>
              </ScrollView>
            </View>

            <View className="flex-row gap-3">
              <Pressable
                className="flex-1 items-center rounded-xl bg-surfaceMuted py-3"
                onPress={() => setShowInviteModal(false)}
              >
                <Text className="font-nunito-bold text-fgMuted">{t("common.cancel")}</Text>
              </Pressable>
              <Pressable
                disabled={
                  !selectedInviteLoadoutId ||
                  !selectedOpponentId ||
                  createMutation.isPending ||
                  !hasValidLoadout
                }
                style={{
                  flex: 1,
                  borderRadius: 12,
                  overflow: "hidden",
                  opacity:
                    selectedInviteLoadoutId &&
                    selectedOpponentId &&
                    !createMutation.isPending &&
                    hasValidLoadout
                      ? 1
                      : 0.5,
                }}
                onPress={() => void createMutation.mutateAsync()}
              >
                <LinearGradient
                  colors={[tc.primary, tc.primaryDark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ alignItems: "center", paddingVertical: 12, paddingHorizontal: 16 }}
                >
                  <Text className="font-nunito-bold text-white">
                    {createMutation.isPending ? t("pvp.sending") : t("pvp.sendChallenge")}
                  </Text>
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
