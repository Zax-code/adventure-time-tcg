import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ScrollView, Pressable, Text, TextInput, View } from "react-native";

import { apiClient } from "../../src/lib/api";

type CardDraft = {
  name: string;
  character: string;
  description: string;
  hp: string;
  attack: string;
  defense: string;
  speed: string;
  type: string;
  rarityId: string;
};

export default function AdminScreen() {
  const queryClient = useQueryClient();
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const cardsQuery = useQuery({ queryKey: ["admin-cards"], queryFn: () => apiClient.adminCards() });
  const detailQuery = useQuery({
    queryKey: ["admin-card", selectedCardId],
    queryFn: () => apiClient.adminCard(selectedCardId as string),
    enabled: Boolean(selectedCardId),
  });
  const updateCardMutation = useMutation({
    mutationFn: (input: { cardId: string; isFeatured?: boolean; isArchived?: boolean }) => apiClient.updateAdminCard(input.cardId, input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-cards"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-card", selectedCardId] }),
      ]);
    },
  });
  const saveCardMutation = useMutation({
    mutationFn: (input: Record<string, unknown>) => apiClient.saveAdminCard(selectedCardId as string, input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-cards"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-card", selectedCardId] }),
      ]);
    },
  });

  const detail = detailQuery.data;
  const form = useMemo(() => detail ? {
    name: detail.name,
    character: detail.character,
    description: detail.description,
    hp: String(detail.hp),
    attack: String(detail.attack),
    defense: String(detail.defense),
    speed: String(detail.speed),
    type: detail.type,
    rarityId: detail.rarityId,
  } satisfies CardDraft : null, [detail]);
  const [draft, setDraft] = useState<CardDraft | null>(null);
  const resolvedDraft = draft ?? form;

  return (
    <ScrollView className="flex-1 bg-parchment" contentContainerClassName="gap-4 p-6">
      <Text className="text-3xl font-bold text-amber-900">Admin</Text>
      <Text className="text-stone-700">This route group is intentionally hidden from normal navigation.</Text>
      <View className="gap-3 rounded-3xl bg-white p-4">
        <Text className="text-lg font-bold text-stone-900">Card Catalog</Text>
        {cardsQuery.data?.cards.slice(0, 50).map((card) => (
          <View key={card.id} className="gap-2 rounded-2xl bg-orange-50 p-3">
            <Text className="font-semibold text-stone-900">{card.name}</Text>
            <Text className="text-stone-700">{card.character} · {card.rarityName}</Text>
            <Text className="text-stone-700">Featured: {card.isFeatured ? "yes" : "no"} · Archived: {card.isArchived ? "yes" : "no"}</Text>
            <View className="flex-row gap-2">
              <Pressable className="rounded-xl bg-stone-200 px-4 py-2" onPress={() => { setSelectedCardId(card.id); setDraft(null); }}>
                <Text className="text-stone-900">Edit</Text>
              </Pressable>
              <Pressable className="rounded-xl bg-orange-600 px-4 py-2" onPress={() => void updateCardMutation.mutateAsync({ cardId: card.id, isFeatured: !card.isFeatured })}>
                <Text className="font-semibold text-white">Toggle featured</Text>
              </Pressable>
              <Pressable className="rounded-xl bg-stone-900 px-4 py-2" onPress={() => void updateCardMutation.mutateAsync({ cardId: card.id, isArchived: !card.isArchived })}>
                <Text className="font-semibold text-white">Toggle archive</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </View>
      {selectedCardId && resolvedDraft ? (
        <View className="gap-3 rounded-3xl bg-white p-4">
          <Text className="text-lg font-bold text-stone-900">Edit Card</Text>
          {([
            ["name", "Name"],
            ["character", "Character"],
            ["description", "Description"],
            ["hp", "HP"],
            ["attack", "Attack"],
            ["defense", "Defense"],
            ["speed", "Speed"],
            ["type", "Type"],
            ["rarityId", "Rarity ID"],
          ] as const).map(([field, label]) => (
            <View key={field} className="gap-1">
              <Text className="text-sm font-semibold text-stone-700">{label}</Text>
              <TextInput value={resolvedDraft[field]} onChangeText={(value) => setDraft((current) => ({ ...(current ?? resolvedDraft), [field]: value }))} className="rounded-2xl border border-orange-300 bg-white px-4 py-3" />
            </View>
          ))}
          <Pressable
            className="items-center rounded-2xl bg-orange-600 px-4 py-4"
            onPress={() => void saveCardMutation.mutateAsync({
              name: resolvedDraft.name,
              character: resolvedDraft.character,
              description: resolvedDraft.description,
              hp: Number(resolvedDraft.hp),
              attack: Number(resolvedDraft.attack),
              defense: Number(resolvedDraft.defense),
              speed: Number(resolvedDraft.speed),
              type: resolvedDraft.type,
              rarityId: resolvedDraft.rarityId,
            })}
          >
            <Text className="font-semibold text-white">Save card</Text>
          </Pressable>
        </View>
      ) : null}
    </ScrollView>
  );
}
