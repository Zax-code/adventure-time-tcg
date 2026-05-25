import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import type { PvpSpectateBattleState } from "@adventure-time/shared";

import { apiClient } from "../../src/lib/api";
import { getCardImageCacheKey, getCardImageUrl } from "../../src/lib/card-images";
import { PrimaryButton } from "../../src/components/button";
import { useThemeStore } from "../../src/stores/theme-store";
import { useBottomTabBarContentPadding } from "../../src/theme/layout";
import { THEME_COLORS } from "../../src/theme/themes";
import { useSessionStore } from "../../src/stores/session-store";
import { useTranslation } from "../../src/i18n";
import {
  SwordsIcon,
  TrophyIcon,
  UserPlusIcon,
  ClockIcon,
  XIcon,
  CheckIcon,
} from "../../src/components/icons";

const DEFAULT_LOADOUT = [
  "finn-hero",
  "46e81111-4cef-4ac1-838e-7557c72f2108",
  "4ff9d797-c8a1-43f3-95f5-fbf7579b6341",
  "65894b66-f196-4bd1-b0e5-9ab2cf498f84",
  "be08faba-3433-4ad9-b344-4d360a0fe217",
  "f971f5e0-0d7d-4aa5-a41d-937d6f17d8be",
];

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

export default function PvpScreen() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const tc = THEME_COLORS[useThemeStore((s) => s.themeName)];
  const currentUserId = useSessionStore((s) => s.user?.id);
  const { t } = useTranslation();
  const bottomTabPadding = useBottomTabBarContentPadding();

  const [inviteeEmail, setInviteeEmail] = useState("");
  const [selectedInviteLoadoutId, setSelectedInviteLoadoutId] = useState<string | null>(null);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [spectateMatchId, setSpectateMatchId] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [acceptLoadoutMap, setAcceptLoadoutMap] = useState<Record<string, string>>({});

  const invitesQuery = useQuery({ queryKey: ["pvp-invites"], queryFn: () => apiClient.pvpInvites() });
  const matchesQuery = useQuery({ queryKey: ["pvp-matches"], queryFn: () => apiClient.pvpMatches() });
  const historyQuery = useQuery({ queryKey: ["pvp-history"], queryFn: () => apiClient.pvpHistory() });
  const loadoutsQuery = useQuery({ queryKey: ["pvp-loadouts"], queryFn: () => apiClient.pvpLoadouts() });
  const spectateQuery = useQuery({ queryKey: ["pvp-spectate"], queryFn: () => apiClient.pvpSpectate() });
  const spectateDetailQuery = useQuery({
    queryKey: ["pvp-spectate", spectateMatchId],
    queryFn: () => apiClient.pvpSpectateMatch(spectateMatchId as string),
    enabled: Boolean(spectateMatchId),
  });
  const selectedMatchQuery = useQuery({
    queryKey: ["pvp-match", selectedMatchId],
    queryFn: () => apiClient.pvpMatch(selectedMatchId as string),
    enabled: Boolean(selectedMatchId),
  });

  const defaultLoadout = loadoutsQuery.data?.loadouts[0]?.cardIds ?? DEFAULT_LOADOUT;

  const pendingReceivedInvites =
    invitesQuery.data?.invites.filter((inv) => inv.inviteeId === currentUserId) ?? [];
  const pendingSentInvites =
    invitesQuery.data?.invites.filter((inv) => inv.inviterId === currentUserId) ?? [];
  const activeMatches = matchesQuery.data?.matches ?? [];
  const completedMatches = historyQuery.data?.matches.slice(0, 5) ?? [];
  const hasValidLoadout =
    loadoutsQuery.data?.loadouts.some((l) => l.invalidCardIds.length === 0) ?? false;
  const hasAnyData =
    (loadoutsQuery.data?.loadouts.length ?? 0) > 0 ||
    (invitesQuery.data?.invites.length ?? 0) > 0 ||
    (matchesQuery.data?.matches.length ?? 0) > 0;

  const refreshAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["pvp-invites"] }),
      queryClient.invalidateQueries({ queryKey: ["pvp-matches"] }),
      queryClient.invalidateQueries({ queryKey: ["pvp-history"] }),
      queryClient.invalidateQueries({ queryKey: ["pvp-loadouts"] }),
      queryClient.invalidateQueries({ queryKey: ["pvp-match", selectedMatchId] }),
    ]);
  };

  const createMutation = useMutation({
    mutationFn: () => {
      const cardIds = selectedInviteLoadoutId
        ? (loadoutsQuery.data?.loadouts.find((l) => l.id === selectedInviteLoadoutId)?.cardIds ?? defaultLoadout)
        : defaultLoadout;
      return apiClient.createPvpInvite(inviteeEmail, cardIds);
    },
    onSuccess: async () => {
      setInviteeEmail("");
      setShowInviteModal(false);
      await refreshAll();
    },
  });
  const acceptMutation = useMutation({
    mutationFn: ({ id, cardIds }: { id: string; cardIds: string[] }) =>
      apiClient.acceptPvpMatch(id, cardIds),
    onSuccess: refreshAll,
  });
  const declineMutation = useMutation({
    mutationFn: (id: string) => apiClient.declinePvpMatch(id),
    onSuccess: refreshAll,
  });
  const concedeMutation = useMutation({
    mutationFn: (id: string) => apiClient.concedePvpMatch(id),
    onSuccess: refreshAll,
  });
  const battleState = useMemo(
    () => selectedMatchQuery.data?.battleState,
    [selectedMatchQuery.data],
  );
  const spectateBattleState: PvpSpectateBattleState | null = spectateDetailQuery.data?.battleState ?? null;

  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentContainerStyle={{ gap: 20, padding: 20, paddingBottom: bottomTabPadding }}
    >

      {/* ── Header ── */}
      <View className="items-center gap-2 mb-1">
        <View style={{ position: "relative", alignItems: "center" }}>
          <View className="flex-row items-center gap-2">
            <SwordsIcon size={32} color={tc.primaryDark} />
            <Text className="font-nunito-extrabold text-3xl text-primaryDark">{t("pvp.lobby.title")}</Text>
          </View>
          {pendingReceivedInvites.length > 0 && (
            <View
              style={{ position: "absolute", top: -6, right: -32 }}
              className="min-w-5 items-center justify-center rounded-full bg-dangerDark px-1.5 py-0.5"
            >
              <Text className="font-nunito-bold text-xs text-white">{pendingReceivedInvites.length}</Text>
            </View>
          )}
        </View>
        <Text className="font-nunito-semibold text-center text-sm text-primary">
          {t("pvp.lobby.subtitle")}
        </Text>
        <View className="flex-row gap-3 mt-1">
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

      {/* ── 3-button action grid ── */}
      <View className="flex-row gap-3">
        <Pressable
          disabled={!hasValidLoadout}
          style={{ flex: 1, borderRadius: 16, overflow: "hidden", opacity: hasValidLoadout ? 1 : 0.5 }}
          onPress={() => setShowInviteModal(true)}
        >
          <LinearGradient
            colors={[tc.primary, tc.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ alignItems: "center", paddingVertical: 16, paddingHorizontal: 12, gap: 4 }}
          >
            <UserPlusIcon size={22} color="white" />
            <Text className="font-nunito-bold text-center text-xs text-white">
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
            <Text className="font-nunito-bold text-center text-xs text-white">
              {(loadoutsQuery.data?.loadouts.length ?? 0) > 0
                ? t("pvp.editLoadouts")
                : t("pvp.createLoadout")}
            </Text>
          </LinearGradient>
        </Pressable>
        <Pressable style={{ flex: 1, borderRadius: 16, overflow: "hidden" }}>
          <LinearGradient
            colors={[tc.info, tc.infoDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ alignItems: "center", paddingVertical: 16, paddingHorizontal: 12, gap: 4 }}
          >
            <SwordsIcon size={22} color="white" />
            <Text className="font-nunito-bold text-center text-xs text-white">
              {t("pvp.spectateOpen")}
            </Text>
          </LinearGradient>
        </Pressable>
      </View>

      {/* ── Incoming Challenges ── */}
      {pendingReceivedInvites.length > 0 && (
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
            <Text className="font-nunito-bold flex-1 text-white">
              {t("pvp.incomingChallenges")}
            </Text>
            <View className="items-center justify-center rounded-full bg-surface px-2 py-0.5">
              <Text className="font-nunito-bold text-xs text-dangerDark">{pendingReceivedInvites.length}</Text>
            </View>
          </LinearGradient>
          <View className="gap-4 rounded-b-2xl border-2 border-t-0 border-dangerBorder bg-dangerTint p-4">
            {pendingReceivedInvites.map((invite) => {
              const selectedLoadoutId = acceptLoadoutMap[invite.id];
              const validLoadouts =
                loadoutsQuery.data?.loadouts.filter((l) => l.invalidCardIds.length === 0) ?? [];
              return (
                <View key={invite.id} className="gap-3 rounded-xl border-2 border-dangerBorder bg-surface p-4">
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
                      <Text className="font-nunito-bold text-fg">{invite.inviterName ?? `${invite.inviterId.slice(0, 12)}…`}</Text>
                      <Text className="font-nunito text-xs text-fgMuted">
                        {t("pvp.challengeBy", { time: getTimeAgo(invite.createdAt, t) })}
                      </Text>
                    </View>
                  </View>
                  {validLoadouts.length > 0 ? (
                    <>
                      <Text className="font-nunito-semibold text-xs text-primaryDark">
                        {t("pvp.selectLoadout")}
                      </Text>
                      <View className="gap-2">
                        {validLoadouts.map((l) => (
                          <Pressable
                            key={l.id}
                            onPress={() =>
                              setAcceptLoadoutMap((m) => ({ ...m, [invite.id]: l.id }))
                            }
                            className={`rounded-xl border-2 px-3 py-2 ${
                              selectedLoadoutId === l.id
                                ? "border-primary bg-primaryBg"
                                : "border-primaryTint bg-surface"
                            }`}
                          >
                            <Text className="font-nunito-semibold text-fg">{l.name}</Text>
                          </Pressable>
                        ))}
                      </View>
                      <View className="flex-row gap-2">
                        <Pressable
                          style={{ flex: 1, borderRadius: 12, overflow: "hidden" }}
                          onPress={() => {
                            const cardIds = selectedLoadoutId
                              ? (loadoutsQuery.data?.loadouts.find((l) => l.id === selectedLoadoutId)?.cardIds ?? defaultLoadout)
                              : defaultLoadout;
                            void acceptMutation.mutateAsync({ id: invite.id, cardIds });
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
                            <Text className="font-nunito-bold text-white">{t("pvp.lobby.accept")}</Text>
                          </LinearGradient>
                        </Pressable>
                        <Pressable
                          className="flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-surfaceMuted px-4 py-3"
                          onPress={() => void declineMutation.mutateAsync(invite.id)}
                        >
                          <XIcon size={16} color={tc.dangerDark} />
                          <Text className="font-nunito-bold text-dangerDark">{t("pvp.lobby.decline")}</Text>
                        </Pressable>
                      </View>
                    </>
                  ) : (
                    <View className="rounded-xl border border-secondaryBorder bg-secondaryTint p-3">
                      <Text className="font-nunito text-sm text-secondaryText">
                        {t("pvp.needValidLoadout")}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* ── Active Battles ── */}
      {activeMatches.length > 0 && (
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
                   <Text className="font-nunito-bold text-fg">vs {opponentName ?? `${opponentId.slice(0, 10)}…`}</Text>
                   <Text className="font-nunito text-xs text-successDark">
                     {t("pvp.lobby.turn", { count: match.currentTurn ?? 1 })}
                   </Text>
                </View>
                <Text className="font-nunito-bold text-success">{t("pvp.continueArrow")}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* ── Sent Invites ── */}
      {pendingSentInvites.length > 0 && (
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
                <Text className="font-nunito-semibold text-fg">{invite.inviteeName ?? `${invite.inviteeId.slice(0, 12)}…`}</Text>
                <Text className="font-nunito text-xs text-fgMuted">
                  {t("pvp.waitingResponse")}
                </Text>
              </View>
              <Pressable onPress={() => void declineMutation.mutateAsync(invite.id)} className="p-2">
                <XIcon size={20} color={tc.dangerDark} />
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {/* ── Recent Battles ── */}
      {completedMatches.length > 0 && (
        <View className="gap-3">
          <View className="flex-row items-center gap-2">
            <TrophyIcon size={20} color={tc.primary} />
            <Text className="font-nunito-bold flex-1 text-lg text-fg">
              {t("pvp.recentBattles")}
            </Text>
            <Text className="font-nunito-bold text-sm text-accentText">{t("pvp.viewAllArrow")}</Text>
          </View>
          {completedMatches.map((match) => {
            const won = match.winnerId === currentUserId;
            const isExpired = match.status === "EXPIRED";
            const isDeclined = match.status === "DECLINED";
            const opponentId =
              match.inviterId === currentUserId ? match.inviteeId : match.inviterId;
            const opponentName =
              match.inviterId === currentUserId ? match.inviteeName : match.inviterName;
            return (
              <Pressable
                key={match.id}
                className={`flex-row items-center gap-3 rounded-xl border bg-surface p-3 ${
                  isExpired || isDeclined
                    ? "border-infoBorder"
                    : won
                      ? "border-successBorder"
                      : "border-dangerBorder"
                }`}
                onPress={() => setSelectedMatchId(match.id)}
              >
                <Text
                  className={`font-nunito-bold text-sm ${
                    isExpired || isDeclined
                      ? "text-infoDark"
                      : won
                        ? "text-successDark"
                        : "text-dangerDark"
                  }`}
                >
                  {isExpired
                     ? t("pvp.lobby.expired")
                     : isDeclined
                       ? t("pvp.lobby.declined")
                       : won
                        ? t("pvp.win")
                        : match.winnerId
                          ? t("pvp.loss")
                          : "—"}
                </Text>
                <Text className="flex-1 font-nunito text-sm text-fgMuted">
                  vs {opponentName ?? `${opponentId.slice(0, 10)}…`}
                </Text>
                <Text className="font-nunito-bold text-xs text-accent">{t("pvp.replayArrow")}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* ── Empty State ── */}
      {!hasAnyData && (
        <View className="items-center gap-3 rounded-2xl border border-primaryTint bg-surface p-8">
          <SwordsIcon size={48} color={tc.primaryBorder} />
          <Text className="font-nunito-bold text-center text-lg text-fg">
            {t("pvp.readyForBattle")}
          </Text>
          <Text className="font-nunito text-center text-sm text-fgMuted">
            {t("pvp.readyForBattleHint")}
          </Text>
        </View>
      )}

      {/* ── My Loadouts ── */}
      {(loadoutsQuery.data?.loadouts.length ?? 0) > 0 && (
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
                {!isValid && (
                  <View className="mb-3 flex-row items-center gap-2 rounded-lg border border-dangerBorder bg-dangerTint px-3 py-2">
                    <Text className="font-nunito-bold text-sm text-dangerDark">
                      ⚠ {t("pvp.invalidLoadout", { count: loadout.invalidCardIds.length })}
                    </Text>
                  </View>
                )}
                <Text className="font-nunito-bold mb-2 text-fg">{loadout.name}</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: 8 }}
                >
                  <View className="flex-row gap-1">
                    {loadout.cardIds.map((cardId, i) => {
                      const isInvalid = loadout.invalidCardIds.includes(cardId);
                      const card = loadout.cards.find((entry) => entry.id === cardId);

                      return isInvalid ? (
                        <View
                          key={`${loadout.id}-${cardId}-${i}`}
                          className="h-16 w-12 shrink-0 items-center justify-center rounded-lg border-2 border-dangerBorder bg-dangerTint"
                        >
                          <Text className="font-nunito-bold text-lg text-danger">?</Text>
                        </View>
                      ) : (
                        <View
                          key={`${loadout.id}-${cardId}-${i}`}
                          className={`h-16 w-12 shrink-0 overflow-hidden rounded-lg border-2 ${
                            i < 3 ? "border-success" : "border-primaryTint"
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
                              <Text className="text-center font-nunito-bold text-[10px] text-fgMuted" numberOfLines={2}>
                                {card?.name ?? "?"}
                              </Text>
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                </ScrollView>
                <Text className="font-nunito mt-1 text-xs text-fgMuted">
                  {t("pvp.firstThreeActive")}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {/* ── Spectate Section ── */}
      {(spectateQuery.data?.matches.length ?? 0) > 0 && (
        <View className="gap-3">
          <View className="flex-row items-center gap-2">
            <SwordsIcon size={20} color={tc.info} />
            <Text className="font-nunito-bold text-lg text-infoDark">{t("pvp.liveMatches")}</Text>
          </View>
          {spectateQuery.data!.matches.map((m) => (
            <View key={m.id} className="gap-2 rounded-2xl border border-infoBorder bg-infoTint p-4">
              <Text className="font-nunito text-fg">
                 {t("pvp.lobby.turn", { count: m.currentTurn })} · {m.id.slice(0, 8)}
               </Text>
              <Pressable
                className="rounded-xl border border-infoBorder px-4 py-2"
                onPress={() => setSpectateMatchId(m.id)}
              >
                 <Text className="font-nunito-semibold text-infoDark">{t("pvp.lobby.watch")}</Text>
               </Pressable>
            </View>
          ))}
          {spectateMatchId && spectateDetailQuery.data ? (
            <View className="gap-2 rounded-2xl bg-primaryBg p-3">
               <Text className="font-nunito-semibold text-fg">{t("pvp.lobby.spectating")}</Text>
              {spectateBattleState?.players.map((player) => (
                <View key={player.userId} className="gap-1">
                  <Text className="font-nunito-semibold text-fg">{player.userId}</Text>
                  {player.units.map((unit) => (
                    <Text key={unit.instanceId} className="font-nunito text-fgMuted">
                      {unit.name}: {unit.hp}/{unit.maxHp}
                      {unit.knockedOut ? " KO" : ""}
                    </Text>
                  ))}
                  {player.bench.length > 0 ? (
                    <Text className="font-nunito text-xs text-fgMuted">{t("pvp.board.bench")}</Text>
                  ) : null}
                  {player.bench.map((unit) => (
                    <Text key={unit.instanceId} className="font-nunito text-fgMuted">
                      {unit.name}: {unit.hp}/{unit.maxHp}
                      {unit.knockedOut ? " KO" : ""}
                    </Text>
                  ))}
                </View>
              ))}
              <Pressable
                className="rounded-xl border border-primaryBorder px-4 py-2"
                onPress={() => setSpectateMatchId(null)}
              >
                <Text className="font-nunito-semibold text-primaryText">
                  {t("pvp.stopWatching")}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      )}


      {/* ── Send Invite Modal ── */}
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
            {(loadoutsQuery.data?.loadouts.filter((l) => l.invalidCardIds.length === 0).length ?? 0) > 0 && (
              <View className="gap-2">
                <Text className="font-nunito-semibold text-sm text-primaryDark">
                  {t("pvp.selectLoadoutLabel")}
                </Text>
                <View className="gap-2">
                  {loadoutsQuery.data!.loadouts
                    .filter((l) => l.invalidCardIds.length === 0)
                    .map((l) => (
                      <Pressable
                        key={l.id}
                        onPress={() => setSelectedInviteLoadoutId(l.id)}
                        className={`rounded-xl border-2 px-4 py-3 ${
                          selectedInviteLoadoutId === l.id
                            ? "border-primary bg-primaryBg"
                            : "border-primaryTint bg-surface"
                        }`}
                      >
                        <Text className="font-nunito-semibold text-fg">{l.name}</Text>
                      </Pressable>
                    ))}
                </View>
              </View>
            )}
            <View className="gap-2">
              <Text className="font-nunito-semibold text-sm text-primaryDark">
                {t("pvp.friendEmail")}
              </Text>
              <TextInput
                value={inviteeEmail}
                onChangeText={setInviteeEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder={t("pvp.friendEmailPlaceholder")}
                placeholderTextColor={tc.muted}
                className="rounded-2xl border border-primaryBorder bg-primaryBg px-4 py-3 font-nunito text-fg"
              />
            </View>
            <View className="flex-row gap-3">
              <Pressable
                className="flex-1 items-center rounded-xl bg-surfaceMuted py-3"
                onPress={() => setShowInviteModal(false)}
              >
                 <Text className="font-nunito-bold text-fgMuted">{t("common.cancel")}</Text>
               </Pressable>
              <Pressable
                disabled={!inviteeEmail}
                style={{ flex: 1, borderRadius: 12, overflow: "hidden", opacity: inviteeEmail ? 1 : 0.5 }}
                onPress={() => void createMutation.mutateAsync()}
              >
                <LinearGradient
                  colors={[tc.primary, tc.primaryDark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ alignItems: "center", paddingVertical: 12, paddingHorizontal: 16 }}
                >
                  <Text className="font-nunito-bold text-white">{t("pvp.sendChallenge")}</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
}
