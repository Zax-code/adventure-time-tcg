import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ZodError } from "zod";

import { apiClient } from "../../src/lib/api";
import {
  AbilityTypeChip,
  AdminButton,
  AdminChip,
  AdminEmptyState,
  AdminModal,
  AdminPageScroll,
  AdminPanel,
  AdminSearchInput,
  AdminSectionTitle,
} from "../../src/components/admin/admin-ui";

function formatAbilitiesError(error: unknown) {
  if (error instanceof ZodError) {
    const details = error.issues
      .slice(0, 3)
      .map((issue) => {
        const path = issue.path.length ? issue.path.join(".") : "response";
        return `${path}: ${issue.message}`;
      })
      .join("; ");

    return `Ability data from the API is invalid. ${details}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return null;
}

export default function AdminAbilitiesScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"abilities" | "assignments">("abilities");
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "PASSIVE" | "SKILL" | "ULTIMATE">("all");
  const [assigningCardId, setAssigningCardId] = useState<string | null>(null);
  const [assignmentDraft, setAssignmentDraft] = useState({ passiveId: "", skillId: "", ultimateId: "" });

  const abilitiesQuery = useQuery({ queryKey: ["admin-abilities"], queryFn: () => apiClient.adminAbilities() });
  const isAbilitiesLoading = abilitiesQuery.isLoading;
  const abilitiesError = formatAbilitiesError(abilitiesQuery.error);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.deleteAdminAbility(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-abilities"] });
    },
  });
  const assignmentMutation = useMutation({
    mutationFn: (input: { cardId: string; passiveId?: string | null; skillId?: string | null; ultimateId?: string | null }) =>
      apiClient.assignAdminCardAbility(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-abilities"] });
      setAssigningCardId(null);
    },
  });

  const filteredAbilities = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return (abilitiesQuery.data?.abilities ?? []).filter((ability) => {
      if (typeFilter !== "all" && ability.type !== typeFilter) return false;
      if (!query) return true;
      return `${ability.name} ${ability.key} ${ability.description}`.toLowerCase().includes(query);
    });
  }, [abilitiesQuery.data?.abilities, searchQuery, typeFilter]);

  const filteredCards = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return (abilitiesQuery.data?.cards ?? []).filter((card) => {
      if (!query) return true;
      return `${card.name} ${card.character} ${card.type}`.toLowerCase().includes(query);
    });
  }, [abilitiesQuery.data?.cards, searchQuery]);

  const selectedAssignment = abilitiesQuery.data?.cardAbilities.find((entry) => entry.cardId === assigningCardId);

  return (
    <>
      <AdminPageScroll>
        <AdminPanel>
          <AdminSectionTitle title="Abilities" subtitle="Use the same two-mode management flow as the PWA: ability library and card assignments." />
          <View className="h-3" />
          <View className="flex-row gap-2">
            <Pressable
              className={`flex-1 py-[10] rounded-[14] items-center ${activeTab === "abilities" ? "bg-primaryText" : "bg-surface/78"}`}
              onPress={() => setActiveTab("abilities")}
            >
              <Text className={`font-nunito-extrabold ${activeTab === "abilities" ? "text-white" : "text-primaryText"}`}>Abilities</Text>
            </Pressable>
            <Pressable
              className={`flex-1 py-[10] rounded-[14] items-center ${activeTab === "assignments" ? "bg-primaryText" : "bg-surface/78"}`}
              onPress={() => setActiveTab("assignments")}
            >
              <Text className={`font-nunito-extrabold ${activeTab === "assignments" ? "text-white" : "text-primaryText"}`}>Assignments</Text>
            </Pressable>
          </View>
          <View className="h-3" />
          <AdminSearchInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={activeTab === "abilities" ? "Search abilities" : "Search cards"}
          />
          {activeTab === "abilities" ? (
            <View className="mt-3 flex-row flex-wrap gap-2">
              {(["all", "PASSIVE", "SKILL", "ULTIMATE"] as const).map((type) => {
                const active = typeFilter === type;
                return (
                  <Pressable
                    key={type}
                    className={`px-[10] py-2 rounded-full ${active ? "bg-primaryTint border border-primaryBorder" : "bg-surface/86"}`}
                    onPress={() => setTypeFilter(type)}
                  >
                    <Text className={`font-nunito-bold text-xs ${active ? "text-primaryStrong" : "text-primaryText"}`}>{type}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
          {activeTab === "abilities" ? <AdminButton label="Create ability" icon="add" onPress={() => router.push({ pathname: "/admin-ability-editor", params: { mode: "create" } } as any)} /> : null}
        </AdminPanel>

        {activeTab === "abilities" ? (
          <AdminPanel>
            <AdminSectionTitle title={`Ability library (${filteredAbilities.length})`} />
            <View className="mt-3 gap-3">
              {isAbilitiesLoading ? (
                <Text className="font-nunito-bold text-[13px] text-primaryText">Loading abilities...</Text>
              ) : abilitiesError ? (
                <Text className="font-nunito-bold text-[13px] text-dangerText">{abilitiesError}</Text>
              ) : filteredAbilities.length ? (
                filteredAbilities.map((ability) => (
                  <Pressable
                    key={ability.id}
                    className="gap-[10] p-[14] rounded-[20] bg-surfaceMuted border border-primaryBorder/20"
                    onPress={() => router.push({ pathname: "/admin-ability-editor", params: { mode: "edit", abilityId: ability.id } } as any)}
                  >
                    <View className="flex-row justify-between items-center gap-2">
                      <Text className="flex-1 font-nunito-extrabold text-[15px] text-fg">{ability.name}</Text>
                      <AbilityTypeChip type={ability.type} />
                    </View>
                    <View className="flex-row flex-wrap gap-2">
                      <AdminChip label={ability.key} tone="accent" />
                      <AdminChip label={`Cost ${ability.cost}`} tone="info" />
                      {ability.cooldown ? <AdminChip label={`CD ${ability.cooldown}`} tone="warning" /> : null}
                      {ability.oncePerMatch ? <AdminChip label="Once / match" tone="success" /> : null}
                    </View>
                    <Text className="font-nunito-semibold text-[13px] text-fgMuted">{ability.description}</Text>
                    <View className="flex-row gap-2">
                      <AdminButton label="Edit" variant="ghost" onPress={() => router.push({ pathname: "/admin-ability-editor", params: { mode: "edit", abilityId: ability.id } } as any)} />
                      <AdminButton label="Delete" variant="danger" onPress={() => deleteMutation.mutate(ability.id)} />
                    </View>
                  </Pressable>
                ))
              ) : (
                <AdminEmptyState icon="flash" title="No abilities" body="No abilities match the current search filters, or this API has no imported ability data yet." />
              )}
            </View>
          </AdminPanel>
        ) : (
          <AdminPanel>
            <AdminSectionTitle title={`Card assignments (${filteredCards.length})`} />
            <View className="mt-3 gap-3">
              {isAbilitiesLoading ? (
                <Text className="font-nunito-bold text-[13px] text-primaryText">Loading card assignments...</Text>
              ) : abilitiesError ? (
                <Text className="font-nunito-bold text-[13px] text-dangerText">{abilitiesError}</Text>
              ) : filteredCards.length ? (
                filteredCards.map((card) => {
                  const assignment = abilitiesQuery.data?.cardAbilities.find((entry) => entry.cardId === card.id);
                  const passive = abilitiesQuery.data?.abilities.find((ability) => ability.id === assignment?.passiveId);
                  const skill = abilitiesQuery.data?.abilities.find((ability) => ability.id === assignment?.skillId);
                  const ultimate = abilitiesQuery.data?.abilities.find((ability) => ability.id === assignment?.ultimateId);

                  return (
                    <Pressable
                      key={card.id}
                      className="gap-[10] p-[14] rounded-[20] bg-surfaceMuted border border-primaryBorder/20"
                      onPress={() => {
                        setAssigningCardId(card.id);
                        setAssignmentDraft({
                          passiveId: assignment?.passiveId ?? "",
                          skillId: assignment?.skillId ?? "",
                          ultimateId: assignment?.ultimateId ?? "",
                        });
                      }}
                    >
                      <Text className="flex-1 font-nunito-extrabold text-[15px] text-fg">{card.name}</Text>
                      <Text className="font-nunito-semibold text-xs text-muted">{card.character} - {card.type}</Text>
                      <View className="flex-row flex-wrap gap-2">
                        <AdminChip label={`Passive: ${passive?.name ?? "Default"}`} tone="success" />
                        <AdminChip label={`Skill: ${skill?.name ?? "Default"}`} tone="info" />
                        <AdminChip label={`Ultimate: ${ultimate?.name ?? "Default"}`} tone="warning" />
                      </View>
                      <AdminButton label="Manage" variant="ghost" onPress={() => {
                        setAssigningCardId(card.id);
                        setAssignmentDraft({
                          passiveId: assignment?.passiveId ?? "",
                          skillId: assignment?.skillId ?? "",
                          ultimateId: assignment?.ultimateId ?? "",
                        });
                      }} />
                    </Pressable>
                  );
                })
              ) : (
                <AdminEmptyState icon="people" title="No cards" body="Cards appear here once the admin catalog has content." />
              )}
            </View>
          </AdminPanel>
        )}
      </AdminPageScroll>
      <AdminModal visible={assigningCardId !== null} title="Assign abilities" onClose={() => setAssigningCardId(null)}>
        {(["passive", "skill", "ultimate"] as const).map((role) => {
          const selectedId = assignmentDraft[`${role}Id` as const];
          return (
            <View key={role} className="gap-[10] rounded-[20] p-[14] bg-surface/82">
              <Text className="font-nunito-extrabold text-sm text-primaryText">{role.toUpperCase()}</Text>
              <AdminButton
                label="Use default"
                variant="ghost"
                onPress={() => setAssignmentDraft((current) => ({ ...current, [`${role}Id`]: "" } as typeof current))}
              />
              {(abilitiesQuery.data?.abilities ?? [])
                .filter((ability) => ability.type === role.toUpperCase())
                .map((ability) => (
                  <Pressable
                    key={ability.id}
                    className={`gap-[6] rounded-2xl p-3 border ${selectedId === ability.id ? "bg-primaryBg border-primary" : "bg-surface/90 border-primaryBorder/16"}`}
                    onPress={() => setAssignmentDraft((current) => ({ ...current, [`${role}Id`]: ability.id } as typeof current))}
                  >
                    <Text className="flex-1 font-nunito-extrabold text-[15px] text-fg">{ability.name}</Text>
                    <Text className="font-nunito-semibold text-[13px] text-fgMuted">{ability.description}</Text>
                  </Pressable>
                ))}
            </View>
          );
        })}
        <AdminButton
          label="Save assignments"
          onPress={() =>
            assigningCardId &&
            assignmentMutation.mutate({
              cardId: assigningCardId,
              passiveId: assignmentDraft.passiveId || null,
              skillId: assignmentDraft.skillId || null,
              ultimateId: assignmentDraft.ultimateId || null,
            })
          }
        />
      </AdminModal>
    </>
  );
}
