import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { apiClient } from "../../src/lib/api";

export default function GiftsScreen() {
  const queryClient = useQueryClient();
  const [recipientId, setRecipientId] = useState("");
  const [cardId, setCardId] = useState("");
  const [message, setMessage] = useState("");
  const usersQuery = useQuery({ queryKey: ["users"], queryFn: () => apiClient.users() });
  const giftsQuery = useQuery({ queryKey: ["gifts"], queryFn: () => apiClient.gifts() });
  const sendGiftMutation = useMutation({
    mutationFn: () => apiClient.sendGift({ cardId, toUserId: recipientId, quantity: 1, message }),
    onSuccess: async () => {
      setMessage("");
      await queryClient.invalidateQueries({ queryKey: ["gifts"] });
    },
  });
  const processGiftMutation = useMutation({
    mutationFn: (payload: { giftId: string; action: "accept" | "reject" }) => apiClient.processGift(payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["gifts"] }),
        queryClient.invalidateQueries({ queryKey: ["collection"] }),
        queryClient.invalidateQueries({ queryKey: ["home"] }),
      ]);
    },
  });

  return (
    <ScrollView className="flex-1 bg-parchment" contentContainerClassName="gap-4 p-5">
      <Text className="text-3xl font-bold text-amber-900">Gifts</Text>
      <View className="gap-3 rounded-3xl bg-white p-4">
        <Text className="text-lg font-bold text-stone-900">Send Gift</Text>
        <TextInput value={cardId} onChangeText={setCardId} placeholder="Card ID" className="rounded-2xl border border-orange-300 bg-white px-4 py-3" />
        <TextInput value={recipientId} onChangeText={setRecipientId} placeholder="Recipient user ID" className="rounded-2xl border border-orange-300 bg-white px-4 py-3" />
        <TextInput value={message} onChangeText={setMessage} placeholder="Message" className="rounded-2xl border border-orange-300 bg-white px-4 py-3" />
        <Pressable className="items-center rounded-2xl bg-orange-600 px-4 py-4" onPress={() => void sendGiftMutation.mutateAsync()}>
          <Text className="font-bold text-white">Send gift</Text>
        </Pressable>
        <Text className="text-sm text-stone-600">Users: {(usersQuery.data?.users ?? []).map((user) => `${user.displayName} (${user.id})`).slice(0, 4).join(", ")}</Text>
      </View>
      <View className="gap-3 rounded-3xl bg-white p-4">
        <Text className="text-lg font-bold text-stone-900">Inbox / Sent</Text>
        <Text className="text-stone-700">Pending received: {giftsQuery.data?.pendingCount ?? 0}</Text>
        {giftsQuery.data?.gifts.map((gift) => (
          <View key={gift.id} className="gap-2 rounded-2xl bg-orange-50 p-3">
            <Text className="font-semibold text-stone-900">{gift.card.name} x{gift.quantity}</Text>
            <Text className="text-stone-700">From: {gift.fromUser.displayName}</Text>
            <Text className="text-stone-700">To: {gift.toUser.displayName}</Text>
            <Text className="text-stone-700">Status: {gift.status}</Text>
            {gift.message ? <Text className="text-stone-700">Message: {gift.message}</Text> : null}
            {gift.status === "pending" ? (
              <View className="flex-row gap-2">
                <Pressable className="rounded-xl bg-green-600 px-4 py-2" onPress={() => void processGiftMutation.mutateAsync({ giftId: gift.id, action: "accept" })}>
                  <Text className="font-semibold text-white">Accept</Text>
                </Pressable>
                <Pressable className="rounded-xl bg-red-600 px-4 py-2" onPress={() => void processGiftMutation.mutateAsync({ giftId: gift.id, action: "reject" })}>
                  <Text className="font-semibold text-white">Reject</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
