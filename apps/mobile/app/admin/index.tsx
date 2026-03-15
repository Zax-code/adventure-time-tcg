import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";

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

const BLANK_CARD_DRAFT: CardDraft = { name: "", character: "", description: "", hp: "100", attack: "30", defense: "20", speed: "40", type: "Hero", rarityId: "" };

export default function AdminScreen() {
  const queryClient = useQueryClient();
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [selectedAbilityId, setSelectedAbilityId] = useState<string | null>(null);
  const [assignmentDraft, setAssignmentDraft] = useState({ passiveId: "", skillId: "", ultimateId: "" });
  const [createCardDraft, setCreateCardDraft] = useState<CardDraft>(BLANK_CARD_DRAFT);
  const [showCreateCard, setShowCreateCard] = useState(false);
  const [coinDelta, setCoinDelta] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [activeTab, setActiveTab] = useState<"cards" | "abilities" | "users" | "allowlist">("cards");

  const cardsQuery = useQuery({ queryKey: ["admin-cards"], queryFn: () => apiClient.adminCards() });
  const detailQuery = useQuery({
    queryKey: ["admin-card", selectedCardId],
    queryFn: () => apiClient.adminCard(selectedCardId as string),
    enabled: Boolean(selectedCardId),
  });
  const abilitiesQuery = useQuery({ queryKey: ["admin-abilities"], queryFn: () => apiClient.adminAbilities() });
  const raritiesQuery = useQuery({ queryKey: ["admin-rarities"], queryFn: () => apiClient.rarities() });
  const usersQuery = useQuery({ queryKey: ["admin-users"], queryFn: () => apiClient.adminUsers(), enabled: activeTab === "users" });
  const emailsQuery = useQuery({ queryKey: ["admin-emails"], queryFn: () => apiClient.adminAllowedEmails(), enabled: activeTab === "allowlist" });

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
  const createCardMutation = useMutation({
    mutationFn: (input: Record<string, unknown>) => apiClient.createAdminCard(input),
    onSuccess: async () => {
      setCreateCardDraft(BLANK_CARD_DRAFT);
      setShowCreateCard(false);
      await queryClient.invalidateQueries({ queryKey: ["admin-cards"] });
    },
  });
  const uploadCardImageMutation = useMutation({
    mutationFn: async (cardId: string) => {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.85,
      });
      if (result.canceled || !result.assets[0]) throw new Error("Cancelled");
      const asset = result.assets[0];
      const formData = new FormData();
      formData.append("file", { uri: asset.uri, name: "card.jpg", type: asset.mimeType ?? "image/jpeg" } as any);
      return apiClient.uploadAdminCardImage(cardId, formData);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-cards"] });
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
  const adjustCoinsMutation = useMutation({
    mutationFn: ({ userId, delta }: { userId: string; delta: number }) => apiClient.adjustAdminUserCoins(userId, delta),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });
  const addEmailMutation = useMutation({
    mutationFn: (email: string) => apiClient.addAdminAllowedEmail(email),
    onSuccess: async () => {
      setNewEmail("");
      await queryClient.invalidateQueries({ queryKey: ["admin-emails"] });
    },
  });
  const toggleEmailAdminMutation = useMutation({
    mutationFn: ({ id, isAdmin }: { id: string; isAdmin: boolean }) => apiClient.updateAdminAllowedEmail(id, isAdmin),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-emails"] });
    },
  });
  const deleteEmailMutation = useMutation({
    mutationFn: (id: string) => apiClient.deleteAdminAllowedEmail(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-emails"] });
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

  const cardFields = [
    ["name", "Name"],
    ["character", "Character"],
    ["description", "Description"],
    ["hp", "HP"],
    ["attack", "Attack"],
    ["defense", "Defense"],
    ["speed", "Speed"],
    ["type", "Type"],
    ["rarityId", "Rarity ID"],
  ] as const;

  return (
    <ScrollView className="flex-1 bg-parchment" contentContainerClassName="gap-4 p-6">
      <Text className="text-3xl font-bold text-amber-900">Admin</Text>

      <View className="flex-row gap-2">
        {(["cards", "abilities", "users", "allowlist"] as const).map((tab) => (
          <Pressable key={tab} onPress={() => setActiveTab(tab)} className={`rounded-2xl px-4 py-2 ${activeTab === tab ? "bg-orange-600" : "bg-stone-200"}`}>
            <Text className={activeTab === tab ? "font-semibold text-white" : "text-stone-900"}>{tab}</Text>
          </Pressable>
        ))}
      </View>

      {activeTab === "cards" ? (
        <>
          <View className="gap-3 rounded-3xl bg-white p-4">
            <View className="flex-row items-center justify-between">
              <Text className="text-lg font-bold text-stone-900">Card Catalog</Text>
              <Pressable className="rounded-xl bg-orange-600 px-4 py-2" onPress={() => setShowCreateCard(!showCreateCard)}>
                <Text className="font-semibold text-white">{showCreateCard ? "Cancel" : "+ New card"}</Text>
              </Pressable>
            </View>

            {showCreateCard ? (
              <View className="gap-2 rounded-2xl bg-orange-50 p-3">
                <Text className="font-bold text-stone-900">Create card</Text>
                {raritiesQuery.data?.rarities.map((r) => (
                  <Pressable key={r.id} onPress={() => setCreateCardDraft((d) => ({ ...d, rarityId: r.id }))}
                    className={`rounded-xl px-3 py-2 ${createCardDraft.rarityId === r.id ? "bg-orange-600" : "bg-stone-200"}`}>
                    <Text className={createCardDraft.rarityId === r.id ? "text-white" : "text-stone-900"}>{r.name}</Text>
                  </Pressable>
                ))}
                {cardFields.map(([field, label]) => (
                  <View key={field} className="gap-1">
                    <Text className="text-sm font-semibold text-stone-700">{label}</Text>
                    <TextInput value={createCardDraft[field]} onChangeText={(value) => setCreateCardDraft((d) => ({ ...d, [field]: value }))} className="rounded-2xl border border-orange-300 bg-white px-4 py-3" />
                  </View>
                ))}
                <Pressable className="items-center rounded-2xl bg-orange-600 px-4 py-4" onPress={() => void createCardMutation.mutateAsync({ name: createCardDraft.name, character: createCardDraft.character, description: createCardDraft.description, hp: Number(createCardDraft.hp), attack: Number(createCardDraft.attack), defense: Number(createCardDraft.defense), speed: Number(createCardDraft.speed), type: createCardDraft.type, rarityId: createCardDraft.rarityId })}>
                  <Text className="font-semibold text-white">Create card</Text>
                </Pressable>
              </View>
            ) : null}

            {cardsQuery.data?.cards.slice(0, 30).map((card) => (
              <View key={card.id} className="gap-2 rounded-2xl bg-orange-50 p-3">
                <Text className="font-semibold text-stone-900">{card.name}</Text>
                <Text className="text-stone-700">{card.character} · {card.rarityName}</Text>
                <Text className="text-stone-700">Featured: {card.isFeatured ? "yes" : "no"} · Archived: {card.isArchived ? "yes" : "no"}</Text>
                <View className="flex-row flex-wrap gap-2">
                  <Pressable className="rounded-xl bg-stone-200 px-4 py-2" onPress={() => { setSelectedCardId(card.id); setDraft(null); setAssignmentDraft({ passiveId: "", skillId: "", ultimateId: "" }); }}>
                    <Text className="text-stone-900">Edit</Text>
                  </Pressable>
                  <Pressable className="rounded-xl bg-teal-700 px-4 py-2" onPress={() => void uploadCardImageMutation.mutateAsync(card.id)}>
                    <Text className="font-semibold text-white">Upload image</Text>
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
              {cardFields.map(([field, label]) => (
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
        </>
      ) : null}

      {activeTab === "abilities" ? (
        <View className="gap-3 rounded-3xl bg-white p-4">
          <Text className="text-lg font-bold text-stone-900">Abilities</Text>
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
      ) : null}

      {activeTab === "users" ? (
        <View className="gap-3 rounded-3xl bg-white p-4">
          <Text className="text-lg font-bold text-stone-900">Users</Text>
          {usersQuery.data?.users.map((u) => (
            <View key={u.id} className="gap-2 rounded-2xl bg-orange-50 p-3">
              <Text className="font-semibold text-stone-900">{u.email}</Text>
              <Text className="text-stone-700">Coins: {u.coins} · Admin: {u.isAdmin ? "yes" : "no"}</Text>
              <View className="flex-row items-center gap-2">
                <TextInput
                  value={coinDelta}
                  onChangeText={setCoinDelta}
                  placeholder="±delta"
                  keyboardType="numeric"
                  className="w-24 rounded-2xl border border-orange-300 bg-white px-4 py-2"
                />
                <Pressable className="rounded-xl bg-orange-600 px-4 py-2" onPress={() => { const d = parseInt(coinDelta, 10); if (!isNaN(d)) void adjustCoinsMutation.mutateAsync({ userId: u.id, delta: d }); }}>
                  <Text className="font-semibold text-white">Adjust coins</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {activeTab === "allowlist" ? (
        <View className="gap-3 rounded-3xl bg-white p-4">
          <Text className="text-lg font-bold text-stone-900">Allowlist</Text>
          <View className="flex-row gap-2">
            <TextInput
              value={newEmail}
              onChangeText={setNewEmail}
              autoCapitalize="none"
              placeholder="email@example.com"
              className="flex-1 rounded-2xl border border-orange-300 bg-white px-4 py-3"
            />
            <Pressable className="rounded-xl bg-orange-600 px-4 py-3" onPress={() => void addEmailMutation.mutateAsync(newEmail)}>
              <Text className="font-semibold text-white">Add</Text>
            </Pressable>
          </View>
          {emailsQuery.data?.emails.map((entry) => (
            <View key={entry.id} className="gap-2 rounded-2xl bg-orange-50 p-3">
              <Text className="font-semibold text-stone-900">{entry.email}</Text>
              <Text className="text-stone-700">Admin: {entry.isAdmin ? "yes" : "no"}</Text>
              <View className="flex-row gap-2">
                <Pressable className="rounded-xl bg-stone-200 px-4 py-2" onPress={() => void toggleEmailAdminMutation.mutateAsync({ id: entry.id, isAdmin: !entry.isAdmin })}>
                  <Text className="text-stone-900">Toggle admin</Text>
                </Pressable>
                <Pressable className="rounded-xl bg-red-600 px-4 py-2" onPress={() => void deleteEmailMutation.mutateAsync(entry.id)}>
                  <Text className="font-semibold text-white">Remove</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}
