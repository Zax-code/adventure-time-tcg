import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { apiClient } from "../../src/lib/api";
import { PrimaryButton } from "../../src/components/button";

const DEFAULT_LOADOUT = ["finn-hero", "46e81111-4cef-4ac1-838e-7557c72f2108", "4ff9d797-c8a1-43f3-95f5-fbf7579b6341", "65894b66-f196-4bd1-b0e5-9ab2cf498f84", "be08faba-3433-4ad9-b344-4d360a0fe217", "f971f5e0-0d7d-4aa5-a41d-937d6f17d8be"];

export default function PvpScreen() {
  const queryClient = useQueryClient();
  const [inviteeEmail, setInviteeEmail] = useState("");
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [loadoutName, setLoadoutName] = useState("Starter Loadout");
  const [spectateMatchId, setSpectateMatchId] = useState<string | null>(null);
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

  const refreshAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["pvp-invites"] }),
      queryClient.invalidateQueries({ queryKey: ["pvp-matches"] }),
      queryClient.invalidateQueries({ queryKey: ["pvp-history"] }),
      queryClient.invalidateQueries({ queryKey: ["pvp-loadouts"] }),
      queryClient.invalidateQueries({ queryKey: ["pvp-match", selectedMatchId] }),
    ]);
  };

  const createLoadoutMutation = useMutation({
    mutationFn: () => apiClient.createPvpLoadout(loadoutName, DEFAULT_LOADOUT),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["pvp-loadouts"] });
    },
  });
  const createMutation = useMutation({
    mutationFn: () => apiClient.createPvpInvite(inviteeEmail, defaultLoadout),
    onSuccess: async () => {
      setInviteeEmail("");
      await refreshAll();
    },
  });
  const acceptMutation = useMutation({ mutationFn: (id: string) => apiClient.acceptPvpMatch(id, defaultLoadout), onSuccess: refreshAll });
  const declineMutation = useMutation({ mutationFn: (id: string) => apiClient.declinePvpMatch(id), onSuccess: refreshAll });
  const concedeMutation = useMutation({ mutationFn: (id: string) => apiClient.concedePvpMatch(id), onSuccess: refreshAll });
  const attackMutation = useMutation({ mutationFn: (id: string) => apiClient.actPvpMatch(id), onSuccess: refreshAll });
  const endTurnMutation = useMutation({ mutationFn: (id: string) => apiClient.endTurnPvpMatch(id), onSuccess: refreshAll });

  const battleState = useMemo(() => selectedMatchQuery.data?.battleState, [selectedMatchQuery.data]);

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerClassName="gap-4 p-5">
      <Text className="font-nunito-extrabold text-2xl text-fg">PvP</Text>
      <View className="gap-3 rounded-3xl border border-primaryBorder bg-white p-4">
        <Text className="font-nunito-bold text-lg text-fg">Loadouts</Text>
        <TextInput value={loadoutName} onChangeText={setLoadoutName} placeholder="Loadout name" placeholderTextColor="#9CA3AF" className="rounded-2xl border border-primaryBorder bg-primaryBg px-4 py-3 font-nunito text-fg" />
        <PrimaryButton onPress={() => void createLoadoutMutation.mutateAsync()}>
          Save starter loadout
        </PrimaryButton>
        {loadoutsQuery.data?.loadouts.map((loadout) => (
          <View key={loadout.id} className="rounded-2xl bg-primaryTint p-3">
            <Text className="font-nunito-semibold text-fg">{loadout.name}</Text>
            <Text className="font-nunito text-fgMuted">Cards: {loadout.cardIds.length}</Text>
            {loadout.invalidCardIds.length > 0 ? <Text className="font-nunito text-sm text-red-600">Invalid cards: {loadout.invalidCardIds.length}</Text> : null}
          </View>
        ))}
      </View>
      <View className="gap-3 rounded-3xl border border-primaryBorder bg-white p-4">
        <Text className="font-nunito-bold text-lg text-fg">Send Invite</Text>
        <TextInput value={inviteeEmail} onChangeText={setInviteeEmail} autoCapitalize="none" placeholder="Friend email" placeholderTextColor="#9CA3AF" className="rounded-2xl border border-primaryBorder bg-primaryBg px-4 py-3 font-nunito text-fg" />
        <PrimaryButton onPress={() => void createMutation.mutateAsync()}>
          Send invite
        </PrimaryButton>
      </View>
      <View className="gap-3 rounded-3xl border border-primaryBorder bg-white p-4">
        <Text className="font-nunito-bold text-lg text-fg">Invites</Text>
        {invitesQuery.data?.invites.map((invite) => (
          <View key={invite.id} className="gap-2 rounded-2xl bg-primaryTint p-3">
            <Text className="font-nunito text-fg">{invite.status} - {invite.id.slice(0, 8)}</Text>
            <Pressable className="rounded-xl border border-primaryBorder px-4 py-2" onPress={() => setSelectedMatchId(invite.id)}>
              <Text className="font-nunito-semibold text-primaryText">Inspect</Text>
            </Pressable>
            {invite.status === "PENDING" ? (
              <View className="flex-row gap-2">
                <Pressable className="flex-1 items-center rounded-xl bg-green-600 px-4 py-3" onPress={() => void acceptMutation.mutateAsync(invite.id)}>
                  <Text className="font-nunito-bold text-white">Accept</Text>
                </Pressable>
                <Pressable className="flex-1 items-center rounded-xl bg-red-500 px-4 py-3" onPress={() => void declineMutation.mutateAsync(invite.id)}>
                  <Text className="font-nunito-bold text-white">Decline</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ))}
      </View>
      <View className="gap-3 rounded-3xl border border-primaryBorder bg-white p-4">
        <Text className="font-nunito-bold text-lg text-fg">Matches</Text>
        {matchesQuery.data?.matches.map((match) => (
          <View key={match.id} className="gap-2 rounded-2xl bg-primaryTint p-3">
            <Text className="font-nunito text-fg">{match.status} - turn {match.currentTurn ?? 1}</Text>
            <View className="flex-row gap-2">
              <Pressable className="rounded-xl border border-primaryBorder px-4 py-2" onPress={() => setSelectedMatchId(match.id)}>
                <Text className="font-nunito-semibold text-primaryText">Open</Text>
              </Pressable>
              {match.status === "IN_PROGRESS" ? (
                <Pressable className="rounded-xl bg-primaryDark px-4 py-2" onPress={() => void concedeMutation.mutateAsync(match.id)}>
                  <Text className="font-nunito-bold text-white">Concede</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ))}
      </View>
      <View className="gap-3 rounded-3xl border border-primaryBorder bg-white p-4">
        <Text className="font-nunito-bold text-lg text-fg">History</Text>
        {historyQuery.data?.matches.map((match) => (
          <View key={match.id} className="rounded-2xl bg-primaryTint p-3">
            <Text className="font-nunito text-fgMuted">{match.status} - winner {match.winnerId ?? "n/a"}</Text>
          </View>
        ))}
      </View>
      <View className="gap-3 rounded-3xl border border-primaryBorder bg-white p-4">
        <Text className="font-nunito-bold text-lg text-fg">Spectate</Text>
        {spectateQuery.data?.matches.length === 0 ? <Text className="font-nunito text-fgMuted">No live matches to spectate.</Text> : null}
        {spectateQuery.data?.matches.map((m) => (
          <View key={m.id} className="gap-2 rounded-2xl bg-primaryTint p-3">
            <Text className="font-nunito text-fg">Turn {m.currentTurn} · {m.id.slice(0, 8)}</Text>
            <Pressable className="rounded-xl border border-primaryBorder px-4 py-2" onPress={() => setSpectateMatchId(m.id)}>
              <Text className="font-nunito-semibold text-primaryText">Watch</Text>
            </Pressable>
          </View>
        ))}
        {spectateMatchId && spectateDetailQuery.data ? (
          <View className="gap-2 rounded-2xl bg-primaryBg p-3">
            <Text className="font-nunito-semibold text-fg">Spectating match</Text>
            {(spectateDetailQuery.data.battleState as any)?.players?.map((player: any) => (
              <View key={player.userId} className="gap-1">
                <Text className="font-nunito-semibold text-fg">{player.userId}</Text>
                {player.team?.map((unit: any) => (
                  <Text key={unit.cardId} className="font-nunito text-fgMuted">{unit.name}: {unit.hp}/{unit.maxHp}{unit.knockedOut ? " KO" : ""}</Text>
                ))}
              </View>
            ))}
            <Pressable className="rounded-xl border border-primaryBorder px-4 py-2" onPress={() => setSpectateMatchId(null)}>
              <Text className="font-nunito-semibold text-primaryText">Stop watching</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      {selectedMatchId ? (
        <View className="gap-3 rounded-3xl border border-primaryBorder bg-white p-4">
          <Text className="font-nunito-bold text-lg text-fg">Selected Match</Text>
          {selectedMatchQuery.isLoading ? <Text className="font-nunito text-fgMuted">Loading battle state...</Text> : null}
          {battleState ? (
            <>
              <Text className="font-nunito text-fgMuted">Turn: {battleState.turn}</Text>
              <Text className="font-nunito text-fgMuted">Current player: {battleState.currentPlayerId}</Text>
              {battleState.players.map((player) => (
                <View key={player.userId} className="gap-2 rounded-2xl bg-primaryTint p-3">
                  <Text className="font-nunito-semibold text-fg">{player.userId}</Text>
                  {player.team.map((unit) => (
                    <Text key={`${player.userId}-${unit.cardId}-${unit.name}`} className="font-nunito text-fgMuted">{unit.name}: {unit.hp}/{unit.maxHp}{unit.knockedOut ? " KO" : ""}</Text>
                  ))}
                </View>
              ))}
              <View className="flex-row gap-2">
                <PrimaryButton onPress={() => void attackMutation.mutateAsync(selectedMatchId)} style={{ flex: 1 }}>
                  Attack
                </PrimaryButton>
                <Pressable className="flex-1 items-center rounded-full border border-primaryBorder px-4 py-3" onPress={() => void endTurnMutation.mutateAsync(selectedMatchId)}>
                  <Text className="font-nunito-semibold text-primaryText">End turn</Text>
                </Pressable>
              </View>
              <View className="gap-1 rounded-2xl bg-primaryBg p-3">
                <Text className="font-nunito-semibold text-fg">Log</Text>
                {battleState.log.slice(-8).map((event, index) => (
                  <Text key={`${event.turn}-${index}`} className="font-nunito text-sm text-fgMuted">T{event.turn}: {event.summary}</Text>
                ))}
              </View>
            </>
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  );
}
