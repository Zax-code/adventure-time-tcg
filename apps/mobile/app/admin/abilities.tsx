import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "../../src/lib/api";
import {
  AbilityTypeChip,
  AdminButton,
  AdminChip,
  AdminEmptyState,
  AdminField,
  AdminModal,
  AdminPageScroll,
  AdminPanel,
  AdminSearchInput,
  AdminSectionTitle,
} from "../../src/components/admin/admin-ui";

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

const BLANK_ABILITY: AbilityDraft = {
  key: "",
  name: "",
  description: "",
  type: "SKILL",
  cost: "0",
  cooldown: "",
  oncePerMatch: false,
  payload: "{}",
};

export default function AdminAbilitiesScreen() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"abilities" | "assignments">("abilities");
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "PASSIVE" | "SKILL" | "ULTIMATE">("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [assigningCardId, setAssigningCardId] = useState<string | null>(null);
  const [draft, setDraft] = useState<AbilityDraft>(BLANK_ABILITY);
  const [assignmentDraft, setAssignmentDraft] = useState({ passiveId: "", skillId: "", ultimateId: "" });

  const abilitiesQuery = useQuery({ queryKey: ["admin-abilities"], queryFn: () => apiClient.adminAbilities() });

  const createMutation = useMutation({
    mutationFn: (input: Record<string, unknown>) => apiClient.createAdminAbility(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-abilities"] });
      setEditingId(null);
      setDraft(BLANK_ABILITY);
    },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Record<string, unknown> }) => apiClient.updateAdminAbility(id, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-abilities"] });
      setEditingId(null);
      setDraft(BLANK_ABILITY);
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.deleteAdminAbility(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-abilities"] });
      setEditingId(null);
      setDraft(BLANK_ABILITY);
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

  const submit = () => {
    const input = {
      key: draft.key,
      name: draft.name,
      description: draft.description,
      type: draft.type,
      cost: Number(draft.cost || 0),
      cooldown: draft.cooldown ? Number(draft.cooldown) : null,
      oncePerMatch: draft.oncePerMatch,
      payload: JSON.parse(draft.payload || "{}"),
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, input });
      return;
    }

    createMutation.mutate(input);
  };

  return (
    <>
      <AdminPageScroll>
        <AdminPanel>
          <AdminSectionTitle title="Abilities" subtitle="Use the same two-mode management flow as the PWA: ability library and card assignments." />
          <View style={{ height: 12 }} />
          <View style={styles.tabRow}>
            <Pressable style={[styles.tabButton, activeTab === "abilities" ? styles.tabButtonActive : null]} onPress={() => setActiveTab("abilities")}>
              <Text style={[styles.tabLabel, activeTab === "abilities" ? styles.tabLabelActive : null]}>Abilities</Text>
            </Pressable>
            <Pressable style={[styles.tabButton, activeTab === "assignments" ? styles.tabButtonActive : null]} onPress={() => setActiveTab("assignments")}>
              <Text style={[styles.tabLabel, activeTab === "assignments" ? styles.tabLabelActive : null]}>Assignments</Text>
            </Pressable>
          </View>
          <View style={{ height: 12 }} />
          <AdminSearchInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={activeTab === "abilities" ? "Search abilities" : "Search cards"}
          />
          {activeTab === "abilities" ? (
            <View style={styles.filterRow}>
              {(["all", "PASSIVE", "SKILL", "ULTIMATE"] as const).map((type) => {
                const active = typeFilter === type;
                return (
                  <Pressable key={type} style={[styles.filterPill, active ? styles.filterPillActive : null]} onPress={() => setTypeFilter(type)}>
                    <Text style={[styles.filterLabel, active ? styles.filterLabelActive : null]}>{type}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
          {activeTab === "abilities" ? <AdminButton label="Create ability" icon="add" onPress={() => { setEditingId(""); setDraft(BLANK_ABILITY); }} /> : null}
        </AdminPanel>

        {activeTab === "abilities" ? (
          <AdminPanel>
            <AdminSectionTitle title={`Ability library (${filteredAbilities.length})`} />
            <View style={styles.list}>
              {filteredAbilities.length ? (
                filteredAbilities.map((ability) => (
                  <Pressable
                    key={ability.id}
                    style={styles.listCard}
                    onPress={() => {
                      setEditingId(ability.id);
                      setDraft({
                        key: ability.key,
                        name: ability.name,
                        description: ability.description,
                        type: ability.type,
                        cost: String(ability.cost),
                        cooldown: ability.cooldown == null ? "" : String(ability.cooldown),
                        oncePerMatch: ability.oncePerMatch,
                        payload: JSON.stringify(ability.payload ?? {}, null, 2),
                      });
                    }}
                  >
                    <View style={styles.listHeader}>
                      <Text style={styles.listTitle}>{ability.name}</Text>
                      <AbilityTypeChip type={ability.type} />
                    </View>
                    <View style={styles.metaRow}>
                      <AdminChip label={ability.key} tone="accent" />
                      <AdminChip label={`Cost ${ability.cost}`} tone="info" />
                      {ability.cooldown ? <AdminChip label={`CD ${ability.cooldown}`} tone="warning" /> : null}
                      {ability.oncePerMatch ? <AdminChip label="Once / match" tone="success" /> : null}
                    </View>
                    <Text style={styles.description}>{ability.description}</Text>
                    <View style={styles.actionRow}>
                      <AdminButton label="Edit" variant="ghost" onPress={() => {
                        setEditingId(ability.id);
                        setDraft({
                          key: ability.key,
                          name: ability.name,
                          description: ability.description,
                          type: ability.type,
                          cost: String(ability.cost),
                          cooldown: ability.cooldown == null ? "" : String(ability.cooldown),
                          oncePerMatch: ability.oncePerMatch,
                          payload: JSON.stringify(ability.payload ?? {}, null, 2),
                        });
                      }} />
                      <AdminButton label="Delete" variant="danger" onPress={() => deleteMutation.mutate(ability.id)} />
                    </View>
                  </Pressable>
                ))
              ) : (
                <AdminEmptyState icon="flash" title="No abilities" body="Create a new ability or adjust the search filters." />
              )}
            </View>
          </AdminPanel>
        ) : (
          <AdminPanel>
            <AdminSectionTitle title={`Card assignments (${filteredCards.length})`} />
            <View style={styles.list}>
              {filteredCards.length ? (
                filteredCards.map((card) => {
                  const assignment = abilitiesQuery.data?.cardAbilities.find((entry) => entry.cardId === card.id);
                  const passive = abilitiesQuery.data?.abilities.find((ability) => ability.id === assignment?.passiveId);
                  const skill = abilitiesQuery.data?.abilities.find((ability) => ability.id === assignment?.skillId);
                  const ultimate = abilitiesQuery.data?.abilities.find((ability) => ability.id === assignment?.ultimateId);

                  return (
                    <Pressable
                      key={card.id}
                      style={styles.listCard}
                      onPress={() => {
                        setAssigningCardId(card.id);
                        setAssignmentDraft({
                          passiveId: assignment?.passiveId ?? "",
                          skillId: assignment?.skillId ?? "",
                          ultimateId: assignment?.ultimateId ?? "",
                        });
                      }}
                    >
                      <Text style={styles.listTitle}>{card.name}</Text>
                      <Text style={styles.assignmentCardMeta}>{card.character} - {card.type}</Text>
                      <View style={styles.metaRow}>
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

      <AdminModal visible={editingId !== null} title={editingId ? "Edit ability" : "Create ability"} onClose={() => { setEditingId(null); setDraft(BLANK_ABILITY); }}>
        <View style={styles.typeRow}>
          {(["PASSIVE", "SKILL", "ULTIMATE"] as const).map((type) => (
            <Pressable key={type} style={[styles.typeButton, draft.type === type ? styles.typeButtonActive : null]} onPress={() => setDraft((current) => ({ ...current, type }))}>
              <Text style={[styles.typeButtonLabel, draft.type === type ? styles.typeButtonLabelActive : null]}>{type}</Text>
            </Pressable>
          ))}
        </View>
        <AdminField label="Key" value={draft.key} onChangeText={(value) => setDraft((current) => ({ ...current, key: value }))} />
        <AdminField label="Name" value={draft.name} onChangeText={(value) => setDraft((current) => ({ ...current, name: value }))} />
        <AdminField label="Description" value={draft.description} multiline onChangeText={(value) => setDraft((current) => ({ ...current, description: value }))} />
        <View style={styles.inlineFields}>
          <View style={{ flex: 1 }}>
            <AdminField label="Cost" value={draft.cost} keyboardType="numeric" onChangeText={(value) => setDraft((current) => ({ ...current, cost: value }))} />
          </View>
          <View style={{ flex: 1 }}>
            <AdminField label="Cooldown" value={draft.cooldown} keyboardType="numeric" onChangeText={(value) => setDraft((current) => ({ ...current, cooldown: value }))} />
          </View>
        </View>
        <Pressable style={[styles.onceToggle, draft.oncePerMatch ? styles.onceToggleActive : null]} onPress={() => setDraft((current) => ({ ...current, oncePerMatch: !current.oncePerMatch }))}>
          <Text style={[styles.onceToggleText, draft.oncePerMatch ? styles.onceToggleTextActive : null]}>Once per match</Text>
        </Pressable>
        <AdminField label="Payload JSON" value={draft.payload} multiline onChangeText={(value) => setDraft((current) => ({ ...current, payload: value }))} />
        <View style={styles.actionRow}>
          <AdminButton label={editingId ? "Save" : "Create"} onPress={submit} />
          {editingId ? <AdminButton label="Delete" variant="danger" onPress={() => deleteMutation.mutate(editingId)} /> : null}
        </View>
      </AdminModal>

      <AdminModal visible={assigningCardId !== null} title="Assign abilities" onClose={() => setAssigningCardId(null)}>
        {(["passive", "skill", "ultimate"] as const).map((role) => {
          const selectedId = assignmentDraft[`${role}Id` as const];
          return (
            <View key={role} style={styles.assignmentGroup}>
              <Text style={styles.assignmentGroupTitle}>{role.toUpperCase()}</Text>
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
                    style={[styles.assignmentOption, selectedId === ability.id ? styles.assignmentOptionActive : null]}
                    onPress={() => setAssignmentDraft((current) => ({ ...current, [`${role}Id`]: ability.id } as typeof current))}
                  >
                    <Text style={styles.listTitle}>{ability.name}</Text>
                    <Text style={styles.description}>{ability.description}</Text>
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

const styles = StyleSheet.create({
  tabRow: {
    flexDirection: "row",
    gap: 8,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.78)",
    alignItems: "center",
  },
  tabButtonActive: {
    backgroundColor: "#DB2777",
  },
  tabLabel: {
    fontFamily: "Nunito_800ExtraBold",
    color: "#7A284D",
  },
  tabLabelActive: {
    color: "#FFFFFF",
  },
  filterRow: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.86)",
  },
  filterPillActive: {
    backgroundColor: "#FCE7F3",
    borderWidth: 1,
    borderColor: "#F9A8D4",
  },
  filterLabel: {
    fontFamily: "Nunito_700Bold",
    color: "#7A284D",
    fontSize: 12,
  },
  filterLabelActive: {
    color: "#BE185D",
  },
  list: {
    marginTop: 12,
    gap: 12,
  },
  listCard: {
    gap: 10,
    padding: 14,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.88)",
    borderWidth: 1,
    borderColor: "rgba(244,114,182,0.2)",
  },
  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  listTitle: {
    flex: 1,
    fontFamily: "Nunito_800ExtraBold",
    fontSize: 15,
    color: "#4A3728",
  },
  description: {
    fontFamily: "Nunito_600SemiBold",
    fontSize: 13,
    color: "#6B7280",
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
  },
  assignmentCardMeta: {
    fontFamily: "Nunito_600SemiBold",
    fontSize: 12,
    color: "#9CA3AF",
  },
  typeRow: {
    flexDirection: "row",
    gap: 8,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderWidth: 1,
    borderColor: "rgba(244,114,182,0.18)",
    alignItems: "center",
  },
  typeButtonActive: {
    backgroundColor: "#FCE7F3",
    borderColor: "#F472B6",
  },
  typeButtonLabel: {
    fontFamily: "Nunito_800ExtraBold",
    color: "#7A284D",
    fontSize: 12,
  },
  typeButtonLabelActive: {
    color: "#BE185D",
  },
  inlineFields: {
    flexDirection: "row",
    gap: 10,
  },
  onceToggle: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(244,114,182,0.18)",
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.86)",
  },
  onceToggleActive: {
    backgroundColor: "#D1FAE5",
    borderColor: "#6EE7B7",
  },
  onceToggleText: {
    fontFamily: "Nunito_800ExtraBold",
    color: "#7A284D",
  },
  onceToggleTextActive: {
    color: "#065F46",
  },
  assignmentGroup: {
    gap: 10,
    borderRadius: 20,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.82)",
  },
  assignmentGroupTitle: {
    fontFamily: "Nunito_800ExtraBold",
    fontSize: 14,
    color: "#7A284D",
  },
  assignmentOption: {
    gap: 6,
    borderRadius: 16,
    padding: 12,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderWidth: 1,
    borderColor: "rgba(244,114,182,0.16)",
  },
  assignmentOptionActive: {
    borderColor: "#F472B6",
    backgroundColor: "#FDF2F8",
  },
});
