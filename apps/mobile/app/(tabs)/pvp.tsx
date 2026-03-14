import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { apiClient } from "../../src/lib/api";

const DEFAULT_LOADOUT = ["finn-hero", "finn-hero", "finn-hero", "finn-hero", "finn-hero", "finn-hero"];

export default function PvpScreen() {
  const queryClient = useQueryClient();
  const [inviteeEmail, setInviteeEmail] = useState("");
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const invitesQuery = useQuery({ queryKey: ["pvp-invites"], queryFn: () => apiClient.pvpInvites() });
  const matchesQuery = useQuery({ queryKey: ["pvp-matches"], queryFn: () => apiClient.pvpMatches() });
  const historyQuery = useQuery({ queryKey: ["pvp-history"], queryFn: () => apiClient.pvpHistory() });
  const selectedMatchQuery = useQuery({
    queryKey: ["pvp-match", selectedMatchId],
    queryFn: () => apiClient.pvpMatch(selectedMatchId as string),
    enabled: Boolean(selectedMatchId),
  });

  const refreshAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["pvp-invites"] }),
      queryClient.invalidateQueries({ queryKey: ["pvp-matches"] }),
      queryClient.invalidateQueries({ queryKey: ["pvp-history"] }),
      queryClient.invalidateQueries({ queryKey: ["pvp-match", selectedMatchId] }),
    ]);
  };

  const createMutation = useMutation({
    mutationFn: () => apiClient.createPvpInvite(inviteeEmail, DEFAULT_LOADOUT),
    onSuccess: async () => {
      setInviteeEmail("");
      await refreshAll();
    },
  });
  const acceptMutation = useMutation({ mutationFn: (id: string) => apiClient.acceptPvpMatch(id, DEFAULT_LOADOUT), onSuccess: refreshAll });
  const declineMutation = useMutation({ mutationFn: (id: string) => apiClient.declinePvpMatch(id), onSuccess: refreshAll });
  const concedeMutation = useMutation({ mutationFn: (id: string) => apiClient.concedePvpMatch(id), onSuccess: refreshAll });
  const attackMutation = useMutation({ mutationFn: (id: string) => apiClient.actPvpMatch(id), onSuccess: refreshAll });
  const endTurnMutation = useMutation({ mutationFn: (id: string) => apiClient.endTurnPvpMatch(id), onSuccess: refreshAll });

  const battleState = useMemo(() => selectedMatchQuery.data?.battleState, [selectedMatchQuery.data]);

  return (
    <ScrollView className="flex-1 bg-parchment" contentContainerClassName="gap-4 p-5">
      <Text className="text-3xl font-bold text-amber-900">PvP</Text>
      <View className="gap-3 rounded-3xl bg-white p-4">
        <Text className="text-lg font-bold text-stone-900">Send Invite</Text>
        <TextInput value={inviteeEmail} onChangeText={setInviteeEmail} autoCapitalize="none" placeholder="Friend email" className="rounded-2xl border border-orange-300 bg-white px-4 py-3" />
        <Pressable className="items-center rounded-2xl bg-orange-600 px-4 py-4" onPress={() => void createMutation.mutateAsync()}>
          <Text className="font-bold text-white">Send invite</Text>
        </Pressable>
      </View>
      <View className="gap-3 rounded-3xl bg-white p-4">
        <Text className="text-lg font-bold text-stone-900">Invites</Text>
        {invitesQuery.data?.invites.map((invite) => (
          <View key={invite.id} className="gap-2 rounded-2xl bg-orange-50 p-3">
            <Text className="text-stone-800">{invite.status} - {invite.id.slice(0, 8)}</Text>
            <Pressable className="rounded-xl bg-stone-200 px-4 py-2" onPress={() => setSelectedMatchId(invite.id)}><Text className="text-stone-900">Inspect</Text></Pressable>
            {invite.status === "PENDING" ? (
              <View className="flex-row gap-2">
                <Pressable className="rounded-xl bg-green-600 px-4 py-3" onPress={() => void acceptMutation.mutateAsync(invite.id)}><Text className="font-semibold text-white">Accept</Text></Pressable>
                <Pressable className="rounded-xl bg-red-600 px-4 py-3" onPress={() => void declineMutation.mutateAsync(invite.id)}><Text className="font-semibold text-white">Decline</Text></Pressable>
              </View>
            ) : null}
          </View>
        ))}
      </View>
      <View className="gap-3 rounded-3xl bg-white p-4">
        <Text className="text-lg font-bold text-stone-900">Matches</Text>
        {matchesQuery.data?.matches.map((match) => (
          <View key={match.id} className="gap-2 rounded-2xl bg-orange-50 p-3">
            <Text className="text-stone-800">{match.status} - turn {match.currentTurn ?? 1}</Text>
            <View className="flex-row gap-2">
              <Pressable className="rounded-xl bg-stone-200 px-4 py-2" onPress={() => setSelectedMatchId(match.id)}><Text className="text-stone-900">Open</Text></Pressable>
              {match.status === "IN_PROGRESS" ? <Pressable className="rounded-xl bg-stone-900 px-4 py-3" onPress={() => void concedeMutation.mutateAsync(match.id)}><Text className="font-semibold text-white">Concede</Text></Pressable> : null}
            </View>
          </View>
        ))}
      </View>
      <View className="gap-3 rounded-3xl bg-white p-4">
        <Text className="text-lg font-bold text-stone-900">History</Text>
        {historyQuery.data?.matches.map((match) => (
          <View key={match.id} className="rounded-2xl bg-orange-50 p-3">
            <Text className="text-stone-800">{match.status} - winner {match.winnerId ?? "n/a"}</Text>
          </View>
        ))}
      </View>
      {selectedMatchId ? (
        <View className="gap-3 rounded-3xl bg-white p-4">
          <Text className="text-lg font-bold text-stone-900">Selected Match</Text>
          {selectedMatchQuery.isLoading ? <Text>Loading battle state...</Text> : null}
          {battleState ? (
            <>
              <Text className="text-stone-700">Turn: {battleState.turn}</Text>
              <Text className="text-stone-700">Current player: {battleState.currentPlayerId}</Text>
              {battleState.players.map((player) => (
                <View key={player.userId} className="gap-2 rounded-2xl bg-orange-50 p-3">
                  <Text className="font-semibold text-stone-900">{player.userId}</Text>
                  {player.team.map((unit) => (
                    <Text key={`${player.userId}-${unit.cardId}-${unit.name}`} className="text-stone-700">{unit.name}: {unit.hp}/{unit.maxHp}{unit.knockedOut ? " KO" : ""}</Text>
                  ))}
                </View>
              ))}
              <View className="flex-row gap-2">
                <Pressable className="rounded-xl bg-orange-600 px-4 py-3" onPress={() => void attackMutation.mutateAsync(selectedMatchId)}><Text className="font-semibold text-white">Attack</Text></Pressable>
                <Pressable className="rounded-xl bg-stone-900 px-4 py-3" onPress={() => void endTurnMutation.mutateAsync(selectedMatchId)}><Text className="font-semibold text-white">End turn</Text></Pressable>
              </View>
              <View className="gap-1 rounded-2xl bg-stone-100 p-3">
                <Text className="font-semibold text-stone-900">Log</Text>
                {battleState.log.slice(-8).map((event, index) => (
                  <Text key={`${event.turn}-${index}`} className="text-stone-700">T{event.turn}: {event.summary}</Text>
                ))}
              </View>
            </>
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  );
}
