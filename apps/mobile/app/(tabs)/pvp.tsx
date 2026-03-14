import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useState } from "react";

import { apiClient } from "../../src/lib/api";

const DEFAULT_LOADOUT = ["finn-hero","finn-hero","finn-hero","finn-hero","finn-hero","finn-hero"];

export default function PvpScreen() {
  const queryClient = useQueryClient();
  const [inviteeEmail, setInviteeEmail] = useState("");
  const invitesQuery = useQuery({ queryKey: ["pvp-invites"], queryFn: () => apiClient.pvpInvites() });
  const matchesQuery = useQuery({ queryKey: ["pvp-matches"], queryFn: () => apiClient.pvpMatches() });
  const createMutation = useMutation({
    mutationFn: () => apiClient.createPvpInvite(inviteeEmail, DEFAULT_LOADOUT),
    onSuccess: async () => {
      setInviteeEmail("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["pvp-invites"] }),
        queryClient.invalidateQueries({ queryKey: ["pvp-matches"] }),
      ]);
    },
  });
  const acceptMutation = useMutation({ mutationFn: (id: string) => apiClient.acceptPvpMatch(id, DEFAULT_LOADOUT), onSuccess: async () => { await Promise.all([queryClient.invalidateQueries({ queryKey: ["pvp-invites"] }), queryClient.invalidateQueries({ queryKey: ["pvp-matches"] })]); } });
  const declineMutation = useMutation({ mutationFn: (id: string) => apiClient.declinePvpMatch(id), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["pvp-invites"] }); } });
  const concedeMutation = useMutation({ mutationFn: (id: string) => apiClient.concedePvpMatch(id), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["pvp-matches"] }); } });

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
            <Text className="text-stone-800">{invite.status} - {invite.id.slice(0,8)}</Text>
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
            <Text className="text-stone-800">{match.status} - {match.id.slice(0,8)}</Text>
            {match.status === "IN_PROGRESS" ? <Pressable className="rounded-xl bg-stone-900 px-4 py-3" onPress={() => void concedeMutation.mutateAsync(match.id)}><Text className="font-semibold text-white">Concede</Text></Pressable> : null}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
