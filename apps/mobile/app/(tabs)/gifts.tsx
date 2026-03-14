import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { apiClient } from "../../src/lib/api";
import { PrimaryButton } from "../../src/components/button";

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
    <ScrollView className="flex-1 bg-bg" contentContainerClassName="gap-4 p-5">
      <Text className="font-nunito-extrabold text-2xl text-fg">Gifts</Text>
      <View className="gap-3 rounded-3xl border border-primaryBorder bg-white p-4">
        <Text className="font-nunito-bold text-lg text-fg">Send Gift</Text>
        <TextInput value={cardId} onChangeText={setCardId} placeholder="Card ID" placeholderTextColor="#9CA3AF" className="rounded-2xl border border-primaryBorder bg-primaryBg px-4 py-3 font-nunito text-fg" />
        <TextInput value={recipientId} onChangeText={setRecipientId} placeholder="Recipient user ID" placeholderTextColor="#9CA3AF" className="rounded-2xl border border-primaryBorder bg-primaryBg px-4 py-3 font-nunito text-fg" />
        <TextInput value={message} onChangeText={setMessage} placeholder="Message" placeholderTextColor="#9CA3AF" className="rounded-2xl border border-primaryBorder bg-primaryBg px-4 py-3 font-nunito text-fg" />
        <PrimaryButton onPress={() => void sendGiftMutation.mutateAsync()}>
          Send gift
        </PrimaryButton>
        <Text className="font-nunito text-xs text-fgMuted">Users: {(usersQuery.data?.users ?? []).map((user) => `${user.displayName} (${user.id})`).slice(0, 4).join(", ")}</Text>
      </View>
      <View className="gap-3 rounded-3xl border border-primaryBorder bg-white p-4">
        <Text className="font-nunito-bold text-lg text-fg">Inbox / Sent</Text>
        <View className="self-start rounded-full bg-primaryTint px-3 py-1">
          <Text className="font-nunito-bold text-sm text-primaryText">Pending: {giftsQuery.data?.pendingCount ?? 0}</Text>
        </View>
        {giftsQuery.data?.gifts.map((gift) => (
          <View key={gift.id} className="gap-2 rounded-2xl bg-primaryTint p-3">
            <Text className="font-nunito-semibold text-fg">{gift.card.name} x{gift.quantity}</Text>
            <Text className="font-nunito text-fgMuted">From: {gift.fromUser.displayName}</Text>
            <Text className="font-nunito text-fgMuted">To: {gift.toUser.displayName}</Text>
            <Text className="font-nunito text-fgMuted">Status: {gift.status}</Text>
            {gift.message ? <Text className="font-nunito text-fgMuted">Message: {gift.message}</Text> : null}
            {gift.status === "pending" ? (
              <View className="flex-row gap-2">
                <Pressable className="flex-1 items-center rounded-xl bg-green-600 px-4 py-2" onPress={() => void processGiftMutation.mutateAsync({ giftId: gift.id, action: "accept" })}>
                  <Text className="font-nunito-bold text-white">Accept</Text>
                </Pressable>
                <Pressable className="flex-1 items-center rounded-xl bg-red-500 px-4 py-2" onPress={() => void processGiftMutation.mutateAsync({ giftId: gift.id, action: "reject" })}>
                  <Text className="font-nunito-bold text-white">Reject</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
