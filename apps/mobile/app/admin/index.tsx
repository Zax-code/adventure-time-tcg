import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

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

type AbilityDraft = {
  key: string;
  name: string;
  description: string;
  type: "PASSIVE" | "SKILL" | "ULTIMATE";
  cost: string;
  cooldown: string;
  oncePerMatch: boolean;
  payload: string;
};

export default function AdminScreen() {
  const queryClient = useQueryClient();
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [selectedAbilityId, setSelectedAbilityId] = useState<string | null>(null);
  const [assignmentDraft, setAssignmentDraft] = useState({ passiveId: "", skillId: "", ultimateId: "" });
  const cardsQuery = useQuery({ queryKey: ["admin-cards"], queryFn: () => apiClient.adminCards() });
  const detailQuery = useQuery({
    queryKey: ["admin-card", selectedCardId],
    queryFn: () => apiClient.adminCard(selectedCardId as string),
    enabled: Boolean(selectedCardId),
  });
  const abilitiesQuery = useQuery({ queryKey: ["admin-abilities"], queryFn: () => apiClient.adminAbilities() });

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
  const createAbilityMutation = useMutation({
    mutationFn: (input: Record<string, unknown>) => apiClient.createAdminAbility(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-abilities"] });
    },
  });
  const updateAbilityMutation = useMutation({
    mutationFn: (params: { id: string; input: Record<string, unknown> }) => apiClient.updateAdminAbility(params.id, params.input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-abilities"] });
    },
  });
  const deleteAbilityMutation = useMutation({
    mutationFn: (id: string) => apiClient.deleteAdminAbility(id),
    onSuccess: async () => {
      setSelectedAbilityId(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-abilities"] });
    },
  });
  const assignAbilityMutation = useMutation({
    mutationFn: (input: { cardId: string; passiveId?: string | null; skillId?: string | null; ultimateId?: string | null }) => apiClient.assignAdminCardAbility(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-abilities"] });
    },
  });
  const clearAssignmentMutation = useMutation({
    mutationFn: (cardId: string) => apiClient.deleteAdminCardAbility(cardId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-abilities"] });
    },
  });

  const detail = detailQuery.data;
  const form = useMemo(
    () =>
      detail
        ? {
            name: detail.name,
            character: detail.character,
            description: detail.description,
            hp: String(detail.hp),
            attack: String(detail.attack),
            defense: String(detail.defense),
            speed: String(detail.speed),
            type: detail.type,
            rarityId: detail.rarityId,
          }
        : null,
    [detail],
  );
  const [draft, setDraft] = useState<CardDraft | null>(null);
  const resolvedDraft = draft ?? form;

  const selectedAbility = useMemo(
    () => abilitiesQuery.data?.abilities.find((ability) => ability.id === selectedAbilityId) ?? null,
    [abilitiesQuery.data, selectedAbilityId],
  );
  const [abilityDraft, setAbilityDraft] = useState<AbilityDraft>({
    key: "",
    name: "",
    description: "",
    type: "SKILL",
    cost: "0",
    cooldown: "",
    oncePerMatch: false,
    payload: "{}",
  });

  const selectedCardAssignment = useMemo(() => {
    if (!selectedCardId || !abilitiesQuery.data) return null;
    return abilitiesQuery.data.cardAbilities.find((assignment) => assignment.cardId === selectedCardId) ?? null;
  }, [abilitiesQuery.data, selectedCardId]);

  return (
    <ScrollView className="flex-1 bg-parchment" contentContainerClassName="gap-4 p-6">
      <Text className="text-3xl font-bold text-amber-900">Admin</Text>
      <Text className="text-stone-700">Native admin now covers cards and combat abilities.</Text>

      <View className="gap-3 rounded-3xl bg-white p-4">
        <Text className="text-lg font-bold text-stone-900">Card Catalog</Text>
        {cardsQuery.data?.cards.slice(0, 30).map((card) => (
          <View key={card.id} className="gap-2 rounded-2xl bg-orange-50 p-3">
            <Text className="font-semibold text-stone-900">{card.name}</Text>
            <Text className="text-stone-700">{card.character} · {card.rarityName}</Text>
            <Text className="text-stone-700">Featured: {card.isFeatured ? "yes" : "no"} · Archived: {card.isArchived ? "yes" : "no"}</Text>
            <View className="flex-row gap-2">
              <Pressable className="rounded-xl bg-stone-200 px-4 py-2" onPress={() => { setSelectedCardId(card.id); setDraft(null); setAssignmentDraft({ passiveId: "", skillId: "", ultimateId: "" }); }}>
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
          <Pressable className="items-center rounded-2xl bg-orange-600 px-4 py-4" onPress={() => void saveCardMutation.mutateAsync({ name: resolvedDraft.name, character: resolvedDraft.character, description: resolvedDraft.description, hp: Number(resolvedDraft.hp), attack: Number(resolvedDraft.attack), defense: Number(resolvedDraft.defense), speed: Number(resolvedDraft.speed), type: resolvedDraft.type, rarityId: resolvedDraft.rarityId })}>
            <Text className="font-semibold text-white">Save card</Text>
          </Pressable>

          <View className="mt-4 gap-2 rounded-2xl bg-orange-50 p-3">
            <Text className="text-base font-bold text-stone-900">Ability Assignment</Text>
            <Text className="text-sm text-stone-700">Current: P {selectedCardAssignment?.passiveId ?? "-"} / S {selectedCardAssignment?.skillId ?? "-"} / U {selectedCardAssignment?.ultimateId ?? "-"}</Text>
            <TextInput value={assignmentDraft.passiveId} onChangeText={(value) => setAssignmentDraft((current) => ({ ...current, passiveId: value }))} placeholder="Passive ability ID" className="rounded-2xl border border-orange-300 bg-white px-4 py-3" />
            <TextInput value={assignmentDraft.skillId} onChangeText={(value) => setAssignmentDraft((current) => ({ ...current, skillId: value }))} placeholder="Skill ability ID" className="rounded-2xl border border-orange-300 bg-white px-4 py-3" />
            <TextInput value={assignmentDraft.ultimateId} onChangeText={(value) => setAssignmentDraft((current) => ({ ...current, ultimateId: value }))} placeholder="Ultimate ability ID" className="rounded-2xl border border-orange-300 bg-white px-4 py-3" />
            <View className="flex-row gap-2">
              <Pressable className="rounded-xl bg-orange-600 px-4 py-3" onPress={() => void assignAbilityMutation.mutateAsync({ cardId: selectedCardId, passiveId: assignmentDraft.passiveId || null, skillId: assignmentDraft.skillId || null, ultimateId: assignmentDraft.ultimateId || null })}>
                <Text className="font-semibold text-white">Save assignment</Text>
              </Pressable>
              <Pressable className="rounded-xl bg-stone-900 px-4 py-3" onPress={() => void clearAssignmentMutation.mutateAsync(selectedCardId)}>
                <Text className="font-semibold text-white">Clear</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

      <View className="gap-3 rounded-3xl bg-white p-4">
        <Text className="text-lg font-bold text-stone-900">Abilities</Text>
        <Text className="text-sm text-stone-700">Imported abilities can now be edited or new ones can be created.</Text>
        {abilitiesQuery.data?.abilities.slice(0, 40).map((ability) => (
          <View key={ability.id} className="gap-2 rounded-2xl bg-orange-50 p-3">
            <Text className="font-semibold text-stone-900">{ability.key}</Text>
            <Text className="text-stone-700">{ability.name} · {ability.type}</Text>
            <View className="flex-row gap-2">
              <Pressable className="rounded-xl bg-stone-200 px-4 py-2" onPress={() => { setSelectedAbilityId(ability.id); setAbilityDraft({ key: ability.key, name: ability.name, description: ability.description, type: ability.type, cost: String(ability.cost), cooldown: ability.cooldown == null ? "" : String(ability.cooldown), oncePerMatch: ability.oncePerMatch, payload: JSON.stringify(ability.payload) }); }}>
                <Text className="text-stone-900">Edit ability</Text>
              </Pressable>
              <Pressable className="rounded-xl bg-red-600 px-4 py-2" onPress={() => void deleteAbilityMutation.mutateAsync(ability.id)}>
                <Text className="font-semibold text-white">Delete</Text>
              </Pressable>
            </View>
          </View>
        ))}

        <View className="mt-4 gap-2 rounded-2xl bg-stone-50 p-3">
          <Text className="text-base font-bold text-stone-900">{selectedAbilityId ? "Edit Ability" : "Create Ability"}</Text>
          <TextInput value={abilityDraft.key} onChangeText={(value) => setAbilityDraft((current) => ({ ...current, key: value }))} placeholder="ability.key" className="rounded-2xl border border-orange-300 bg-white px-4 py-3" />
          <TextInput value={abilityDraft.name} onChangeText={(value) => setAbilityDraft((current) => ({ ...current, name: value }))} placeholder="Name" className="rounded-2xl border border-orange-300 bg-white px-4 py-3" />
          <TextInput value={abilityDraft.description} onChangeText={(value) => setAbilityDraft((current) => ({ ...current, description: value }))} placeholder="Description" className="rounded-2xl border border-orange-300 bg-white px-4 py-3" />
          <TextInput value={abilityDraft.type} onChangeText={(value) => setAbilityDraft((current) => ({ ...current, type: (value as AbilityDraft["type"]) || "SKILL" }))} placeholder="Type" className="rounded-2xl border border-orange-300 bg-white px-4 py-3" />
          <TextInput value={abilityDraft.cost} onChangeText={(value) => setAbilityDraft((current) => ({ ...current, cost: value }))} placeholder="Cost" className="rounded-2xl border border-orange-300 bg-white px-4 py-3" />
          <TextInput value={abilityDraft.cooldown} onChangeText={(value) => setAbilityDraft((current) => ({ ...current, cooldown: value }))} placeholder="Cooldown" className="rounded-2xl border border-orange-300 bg-white px-4 py-3" />
          <TextInput value={abilityDraft.payload} onChangeText={(value) => setAbilityDraft((current) => ({ ...current, payload: value }))} placeholder='{"damageMul":1.2}' className="rounded-2xl border border-orange-300 bg-white px-4 py-3" multiline />
          <View className="flex-row gap-2">
            <Pressable
              className="rounded-xl bg-orange-600 px-4 py-3"
              onPress={() => {
                const input = {
                  key: abilityDraft.key,
                  name: abilityDraft.name,
                  description: abilityDraft.description,
                  type: abilityDraft.type,
                  cost: Number(abilityDraft.cost || 0),
                  cooldown: abilityDraft.cooldown ? Number(abilityDraft.cooldown) : null,
                  oncePerMatch: abilityDraft.oncePerMatch,
                  payload: JSON.parse(abilityDraft.payload || "{}"),
                };
                if (selectedAbilityId) {
                  void updateAbilityMutation.mutateAsync({ id: selectedAbilityId, input });
                } else {
                  void createAbilityMutation.mutateAsync(input);
                }
              }}
            >
              <Text className="font-semibold text-white">{selectedAbilityId ? "Save ability" : "Create ability"}</Text>
            </Pressable>
            <Pressable className="rounded-xl bg-stone-900 px-4 py-3" onPress={() => { setSelectedAbilityId(null); setAbilityDraft({ key: "", name: "", description: "", type: "SKILL", cost: "0", cooldown: "", oncePerMatch: false, payload: "{}" }); }}>
              <Text className="font-semibold text-white">Reset</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
