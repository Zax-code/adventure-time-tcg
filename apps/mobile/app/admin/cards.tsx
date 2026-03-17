import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { AdminAbilitiesResponse, AdminCardDetail } from "@adventure-time/shared";

import { apiClient } from "../../src/lib/api";
import { AdminCardTile } from "../../src/components/admin/admin-card-tile";
import {
  AbilityTypeChip,
  AdminButton,
  AdminField,
  AdminModal,
  AdminPageScroll,
  AdminPanel,
  AdminSearchInput,
} from "../../src/components/admin/admin-ui";

const GRID_GAP = 12;
const SCREEN_SIDE_PADDING = 16;
const COLLECTION_SIDE_PADDING = 12;

function getTwoColumnWidth(screenWidth: number) {
  const availableWidth = screenWidth - SCREEN_SIDE_PADDING * 2 - COLLECTION_SIDE_PADDING * 2;
  return Math.floor((availableWidth - GRID_GAP) / 2);
}

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

const BLANK_CARD_DRAFT: CardDraft = {
  name: "",
  character: "",
  description: "",
  hp: "100",
  attack: "30",
  defense: "20",
  speed: "40",
  type: "Hero",
  rarityId: "",
};

const FIELD_LABELS: Array<{ key: keyof CardDraft; label: string; keyboardType?: "default" | "numeric" }> = [
  { key: "name", label: "Name" },
  { key: "character", label: "Character" },
  { key: "description", label: "Description" },
  { key: "hp", label: "HP", keyboardType: "numeric" },
  { key: "attack", label: "Attack", keyboardType: "numeric" },
  { key: "defense", label: "Defense", keyboardType: "numeric" },
  { key: "speed", label: "Speed", keyboardType: "numeric" },
  { key: "type", label: "Type" },
];

function toDraft(card: AdminCardDetail): CardDraft {
  return {
    name: card.name,
    character: card.character,
    description: card.description,
    hp: String(card.hp),
    attack: String(card.attack),
    defense: String(card.defense),
    speed: String(card.speed),
    type: card.type,
    rarityId: card.rarityId,
  };
}

function savePayload(draft: CardDraft) {
  return {
    name: draft.name,
    character: draft.character,
    description: draft.description,
    hp: Number(draft.hp),
    attack: Number(draft.attack),
    defense: Number(draft.defense),
    speed: Number(draft.speed),
    type: draft.type,
    rarityId: draft.rarityId,
  };
}

export default function AdminCardsScreen() {
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();
  const [searchQuery, setSearchQuery] = useState("");
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [selectedArchivedCardId, setSelectedArchivedCardId] = useState<string | null>(null);
  const [isActiveCardsOpen, setIsActiveCardsOpen] = useState(true);
  const [isArchivedCardsOpen, setIsArchivedCardsOpen] = useState(true);
  const [draft, setDraft] = useState<CardDraft>(BLANK_CARD_DRAFT);
  const [pickerRole, setPickerRole] = useState<"passive" | "skill" | "ultimate" | null>(null);
  const [assignmentDraft, setAssignmentDraft] = useState({ passiveId: "", skillId: "", ultimateId: "" });

  const cardsQuery = useQuery({ queryKey: ["admin-cards"], queryFn: () => apiClient.adminCards() });
  const raritiesQuery = useQuery({ queryKey: ["admin-rarities"], queryFn: () => apiClient.rarities() });
  const abilitiesQuery = useQuery({ queryKey: ["admin-abilities"], queryFn: () => apiClient.adminAbilities() });
  const detailQuery = useQuery({
    queryKey: ["admin-card", editingCardId],
    queryFn: () => apiClient.adminCard(editingCardId as string),
    enabled: Boolean(editingCardId),
  });

  useEffect(() => {
    if (detailQuery.data) {
      setDraft(toDraft(detailQuery.data));
      const currentAssignment = abilitiesQuery.data?.cardAbilities.find(
        (entry) => entry.cardId === detailQuery.data?.id,
      );
      setAssignmentDraft({
        passiveId: currentAssignment?.passiveId ?? "",
        skillId: currentAssignment?.skillId ?? "",
        ultimateId: currentAssignment?.ultimateId ?? "",
      });
    } else if (!editingCardId) {
      setDraft(BLANK_CARD_DRAFT);
      setAssignmentDraft({ passiveId: "", skillId: "", ultimateId: "" });
    }
  }, [abilitiesQuery.data?.cardAbilities, detailQuery.data, editingCardId]);

  const saveCardMutation = useMutation({
    mutationFn: async () => {
      if (!editingCardId) {
        return apiClient.createAdminCard(savePayload(draft));
      }
      return apiClient.saveAdminCard(editingCardId, savePayload(draft));
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-cards"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-card", editingCardId] }),
      ]);
      setEditingCardId(null);
      setDraft(BLANK_CARD_DRAFT);
    },
  });
  const featureMutation = useMutation({
    mutationFn: ({ cardId, isFeatured, isArchived }: { cardId: string; isFeatured?: boolean; isArchived?: boolean }) =>
      apiClient.updateAdminCard(cardId, { isFeatured, isArchived }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-cards"] });
    },
  });
  const assignMutation = useMutation({
    mutationFn: (payload: { cardId: string; passiveId?: string | null; skillId?: string | null; ultimateId?: string | null }) =>
      apiClient.assignAdminCardAbility(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-abilities"] });
    },
  });
  const uploadMutation = useMutation({
    mutationFn: async (cardId: string) => {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.85,
      });
      if (result.canceled || !result.assets[0]) {
        return;
      }
      const asset = result.assets[0];
      const formData = new FormData();
      formData.append(
        "file",
        { uri: asset.uri, name: "card.jpg", type: asset.mimeType ?? "image/jpeg" } as never,
      );
      await apiClient.uploadAdminCardImage(cardId, formData);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-cards"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-card", editingCardId] }),
      ]);
    },
  });

  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return (cardsQuery.data?.cards ?? []).filter((card) => {
      if (!query) return true;
      return [card.name, card.character]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [cardsQuery.data?.cards, searchQuery]);

  const cards = cardsQuery.data?.cards ?? [];
  const allActiveCards = cards.filter((card) => !card.isArchived);
  const allArchivedCards = cards.filter((card) => card.isArchived);
  const activeCards = filtered.filter((card) => !card.isArchived);
  const archivedCards = filtered.filter((card) => card.isArchived);
  const selectedArchivedCard = archivedCards.find((card) => card.id === selectedArchivedCardId) ?? allArchivedCards.find((card) => card.id === selectedArchivedCardId) ?? null;
  const previewCard = detailQuery.data ?? (editingCardId ? null : {
    id: "preview",
    ...savePayload(draft),
    rarityId: draft.rarityId || raritiesQuery.data?.rarities[0]?.id || "",
    rarityName:
      raritiesQuery.data?.rarities.find((rarity) => rarity.id === draft.rarityId)?.name ??
      raritiesQuery.data?.rarities[0]?.name ??
      "Common",
    isArchived: false,
    isFeatured: false,
    imageAssetId: null,
  });

  const pickerOptions = useMemo(() => {
    if (!pickerRole) return [] as AdminAbilitiesResponse["abilities"];
    const type = pickerRole.toUpperCase();
    return (abilitiesQuery.data?.abilities ?? []).filter((ability) => ability.type === type);
  }, [abilitiesQuery.data?.abilities, pickerRole]);

  const tileWidth = getTwoColumnWidth(width);
  const isCardsLoading = cardsQuery.isLoading;
  const cardsError = cardsQuery.error instanceof Error ? cardsQuery.error.message : null;
  const activeCountLabel = isCardsLoading ? "..." : String(activeCards.length);
  const activeTotalLabel = isCardsLoading ? "..." : String(allActiveCards.length);
  const archivedCountLabel = isCardsLoading ? "..." : String(archivedCards.length);
  const archivedTotalLabel = isCardsLoading ? "..." : String(allArchivedCards.length);

  return (
    <>
      <AdminPageScroll>
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>Card Admin</Text>
        </View>

        <View style={styles.ctaRow}>
          <AdminButton
            label="Add card"
            icon="add"
            onPress={() => {
              setEditingCardId("");
              setDraft({
                ...BLANK_CARD_DRAFT,
                rarityId: raritiesQuery.data?.rarities[0]?.id ?? "",
              });
            }}
          />
        </View>

        <AdminPanel style={styles.statsPanel}>
          <Text style={styles.statsTitle}>Card Stats</Text>
          {isCardsLoading ? (
            <Text style={styles.helperText}>Loading cards...</Text>
          ) : cardsError ? (
            <Text style={styles.errorCopy}>{cardsError}</Text>
          ) : (
            <View style={styles.statsGrid}>
              {raritiesQuery.data?.rarities.map((rarity) => (
                <View key={rarity.id} style={styles.statTile}>
                  <Text style={[styles.statCount, { color: rarity.color || "#DB2777" }]}>
                    {cards.filter((card) => card.rarityId === rarity.id).length}
                  </Text>
                  <Text style={styles.statLabel}>{rarity.name}</Text>
                </View>
              ))}
            </View>
          )}
        </AdminPanel>

        <View style={styles.searchSection}>
          <AdminSearchInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search cards by name or character..."
          />
        </View>

        <View style={styles.collectionSection}>
          <Pressable style={styles.collectionToggle} onPress={() => setIsActiveCardsOpen((current) => !current)}>
            <Text style={styles.collectionTitle}>
              All Cards ({activeCountLabel}){searchQuery ? ` / ${activeTotalLabel}` : ""}
            </Text>
            <Ionicons
              name="chevron-down"
              size={20}
              color="#BE185D"
              style={[styles.chevron, isActiveCardsOpen ? styles.chevronOpen : null]}
            />
          </Pressable>
          {isActiveCardsOpen ? (
            <View style={styles.collectionBody}>
              {isCardsLoading ? (
                <Text style={styles.helperText}>Loading cards...</Text>
              ) : cardsError ? (
                <Text style={styles.errorCopy}>{cardsError}</Text>
              ) : activeCards.length ? (
                <>
                  <Text style={styles.helperText}>Tap a card to edit it.</Text>
                <View style={styles.grid}>
                  {activeCards.map((card) => (
                    <Pressable key={card.id} style={[styles.tileWrap, { width: tileWidth }]} onPress={() => setEditingCardId(card.id)}>
                      <AdminCardTile card={card} fitContainer />
                    </Pressable>
                  ))}
                </View>
                </>
              ) : (
                <Text style={styles.emptyCopy}>No cards match your search.</Text>
              )}
            </View>
          ) : null}
        </View>

        <View style={styles.collectionSection}>
          <Pressable style={styles.archivedToggle} onPress={() => setIsArchivedCardsOpen((current) => !current)}>
            <Text style={styles.archivedTitle}>
              Archived Cards ({archivedCountLabel}){searchQuery ? ` / ${archivedTotalLabel}` : ""}
            </Text>
            <Ionicons
              name="chevron-down"
              size={20}
              color="#BE123C"
              style={[styles.chevron, isArchivedCardsOpen ? styles.chevronOpen : null]}
            />
          </Pressable>
          {isArchivedCardsOpen ? (
            <View style={styles.collectionBody}>
              {isCardsLoading ? (
                <Text style={styles.helperText}>Loading cards...</Text>
              ) : cardsError ? (
                <Text style={styles.errorCopy}>{cardsError}</Text>
              ) : archivedCards.length ? (
                <>
                  <Text style={styles.helperText}>Tap a card to manage it.</Text>
                <View style={styles.grid}>
                  {archivedCards.map((card) => (
                    <Pressable key={card.id} style={[styles.tileWrap, styles.archivedTile, { width: tileWidth }]} onPress={() => setSelectedArchivedCardId(card.id)}>
                      <AdminCardTile card={card} fitContainer />
                    </Pressable>
                  ))}
                </View>
                </>
              ) : (
                <Text style={styles.emptyCopy}>
                  {searchQuery ? "No archived cards match your search." : "No archived cards."}
                </Text>
              )}
            </View>
          ) : null}
        </View>
      </AdminPageScroll>

      <AdminModal
        visible={editingCardId !== null}
        title={editingCardId ? "Edit card" : "Create new card"}
        onClose={() => {
          setEditingCardId(null);
          setDraft(BLANK_CARD_DRAFT);
        }}
      >
        {previewCard ? (
          <View style={{ alignItems: "center" }}>
            <Text style={styles.previewLabel}>Live preview</Text>
            <AdminCardTile card={previewCard} size="large" />
          </View>
        ) : null}

        <View style={styles.modalBlock}>
          <Text style={styles.modalBlockTitle}>Card basics</Text>
          {FIELD_LABELS.map((field) => (
            <AdminField
              key={field.key}
              label={field.label}
              value={draft[field.key]}
              onChangeText={(value) => setDraft((current) => ({ ...current, [field.key]: value }))}
              multiline={field.key === "description"}
              keyboardType={field.keyboardType}
            />
          ))}
        </View>

        <View style={styles.modalBlock}>
          <Text style={styles.modalBlockTitle}>Rarity</Text>
          <View style={styles.pillRow}>
            {raritiesQuery.data?.rarities.map((rarity) => {
              const active = draft.rarityId === rarity.id;
              return (
                <Pressable
                  key={rarity.id}
                  onPress={() => setDraft((current) => ({ ...current, rarityId: rarity.id }))}
                  style={[styles.rarityPill, active ? styles.rarityPillActive : null]}
                >
                  <Text style={[styles.rarityText, active ? styles.rarityTextActive : null]}>{rarity.name}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.modalBlock}>
          <Text style={styles.modalBlockTitle}>Ability assignment</Text>
          <View style={{ gap: 10 }}>
            {([
              ["passive", "Passive", assignmentDraft.passiveId],
              ["skill", "Skill", assignmentDraft.skillId],
              ["ultimate", "Ultimate", assignmentDraft.ultimateId],
            ] as const).map(([role, label, selectedId]) => {
              const selected = abilitiesQuery.data?.abilities.find((ability) => ability.id === selectedId);
              return (
                <Pressable key={role} onPress={() => setPickerRole(role)} style={styles.assignmentCard}>
                  <View style={{ flex: 1, gap: 6 }}>
                    <Text style={styles.assignmentLabel}>{label}</Text>
                    <Text style={styles.assignmentTitle}>{selected?.name ?? `Choose ${label.toLowerCase()} ability`}</Text>
                    {selected ? (
                      <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                        <AbilityTypeChip type={selected.type} />
                        <AdminChip label={`Cost ${selected.cost}`} tone="info" />
                        {selected.cooldown ? <AdminChip label={`CD ${selected.cooldown}`} tone="accent" /> : null}
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.changeText}>Change</Text>
                </Pressable>
              );
            })}
          </View>
          {editingCardId ? (
            <View style={styles.tileActionRow}>
              <AdminButton
                label="Save assignment"
                onPress={() =>
                  assignMutation.mutate({
                    cardId: editingCardId,
                    passiveId: assignmentDraft.passiveId || null,
                    skillId: assignmentDraft.skillId || null,
                    ultimateId: assignmentDraft.ultimateId || null,
                  })
                }
              />
              <AdminButton
                label="Clear"
                variant="ghost"
                onPress={() => setAssignmentDraft({ passiveId: "", skillId: "", ultimateId: "" })}
              />
            </View>
          ) : null}
        </View>

        {editingCardId ? (
          <View style={styles.tileActionRow}>
            <AdminButton label="Upload image" variant="secondary" onPress={() => uploadMutation.mutate(editingCardId)} />
            <AdminButton
              label={detailQuery.data?.isArchived ? "Restore" : "Archive"}
              variant="danger"
              onPress={() =>
                featureMutation.mutate({
                  cardId: editingCardId,
                  isArchived: !(detailQuery.data?.isArchived ?? false),
                })
              }
            />
          </View>
        ) : null}

        <AdminButton
          label={saveCardMutation.isPending ? "Saving..." : editingCardId ? "Save card" : "Create card"}
          onPress={() => saveCardMutation.mutate()}
          disabled={saveCardMutation.isPending || !draft.rarityId}
        />
      </AdminModal>

      <AdminModal visible={pickerRole !== null} title="Choose ability" onClose={() => setPickerRole(null)}>
        {pickerRole ? (
          <>
            <AdminButton
              label="Use default / none"
              variant="ghost"
              onPress={() => {
                setAssignmentDraft((current) => ({ ...current, [`${pickerRole}Id`]: "" } as typeof current));
                setPickerRole(null);
              }}
            />
            {pickerOptions.map((ability) => (
              <Pressable
                key={ability.id}
                onPress={() => {
                  setAssignmentDraft((current) => ({ ...current, [`${pickerRole}Id`]: ability.id } as typeof current));
                  setPickerRole(null);
                }}
                style={styles.abilityOption}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <Text style={styles.assignmentTitle}>{ability.name}</Text>
                  <AbilityTypeChip type={ability.type} />
                </View>
                <Text style={styles.optionDescription}>{ability.description}</Text>
                <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                  <AdminChip label={ability.key} tone="accent" />
                  <AdminChip label={`Cost ${ability.cost}`} tone="info" />
                  {ability.cooldown ? <AdminChip label={`Cooldown ${ability.cooldown}`} tone="warning" /> : null}
                </View>
              </Pressable>
            ))}
          </>
        ) : null}
      </AdminModal>

      <AdminModal visible={selectedArchivedCard !== null} title="Archived Card" onClose={() => setSelectedArchivedCardId(null)}>
        {selectedArchivedCard ? (
          <>
            <View style={styles.archivedModalPreview}>
              <AdminCardTile card={selectedArchivedCard} size="large" />
            </View>
            <Text style={styles.archivedModalTitle}>{selectedArchivedCard.name}</Text>
            <View style={styles.archivedModalActions}>
              <AdminButton
                label="Restore card"
                variant="secondary"
                onPress={() => {
                  featureMutation.mutate({ cardId: selectedArchivedCard.id, isArchived: false });
                  setSelectedArchivedCardId(null);
                }}
              />
              <AdminButton label="Cancel" variant="ghost" onPress={() => setSelectedArchivedCardId(null)} />
            </View>
          </>
        ) : null}
      </AdminModal>
    </>
  );
}

const styles = StyleSheet.create({
  pageHeader: {
    alignItems: "center",
    paddingTop: 4,
    paddingHorizontal: 16,
  },
  pageTitle: {
    fontFamily: "Nunito_800ExtraBold",
    fontSize: 28,
    color: "#BE185D",
  },
  ctaRow: {
    paddingHorizontal: 16,
  },
  statsPanel: {
    marginHorizontal: 16,
    paddingBottom: 18,
  },
  statsTitle: {
    fontFamily: "Nunito_800ExtraBold",
    fontSize: 20,
    color: "#7A284D",
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10,
  },
  statTile: {
    width: "48%",
    backgroundColor: "rgba(255,255,255,0.6)",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: "center",
  },
  statCount: {
    fontFamily: "Nunito_800ExtraBold",
    fontSize: 26,
  },
  statLabel: {
    marginTop: 3,
    fontFamily: "Nunito_700Bold",
    fontSize: 13,
    color: "#6B7280",
  },
  searchSection: {
    paddingHorizontal: 16,
  },
  collectionSection: {
    marginBottom: 8,
  },
  collectionToggle: {
    marginHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: "#FCE7F3",
  },
  collectionTitle: {
    fontFamily: "Nunito_800ExtraBold",
    fontSize: 18,
    color: "#7A284D",
  },
  archivedToggle: {
    marginHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: "#FFE4E6",
  },
  archivedTitle: {
    fontFamily: "Nunito_800ExtraBold",
    fontSize: 18,
    color: "#BE123C",
  },
  chevron: {
    transform: [{ rotate: "0deg" }],
  },
  chevronOpen: {
    transform: [{ rotate: "180deg" }],
  },
  collectionBody: {
    alignItems: "center",
    paddingHorizontal: COLLECTION_SIDE_PADDING,
    paddingTop: 14,
    paddingBottom: 4,
  },
  helperText: {
    marginBottom: 12,
    fontFamily: "Nunito_600SemiBold",
    fontSize: 12,
    color: "#6B7280",
  },
  emptyCopy: {
    fontFamily: "Nunito_600SemiBold",
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
  },
  errorCopy: {
    fontFamily: "Nunito_700Bold",
    fontSize: 13,
    color: "#BE123C",
    textAlign: "center",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: GRID_GAP,
  },
  tileWrap: {
    alignItems: "center",
  },
  archivedTile: {
    opacity: 0.6,
  },
  tileActionRow: {
    width: "100%",
    flexDirection: "row",
    gap: 8,
  },
  previewLabel: {
    marginBottom: 10,
    fontFamily: "Nunito_800ExtraBold",
    fontSize: 16,
    color: "#BE185D",
  },
  modalBlock: {
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.76)",
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(244,114,182,0.18)",
  },
  modalBlockTitle: {
    fontFamily: "Nunito_800ExtraBold",
    fontSize: 15,
    color: "#7A284D",
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  rarityPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.8)",
    borderWidth: 1,
    borderColor: "rgba(244,114,182,0.25)",
  },
  rarityPillActive: {
    backgroundColor: "#DB2777",
  },
  rarityText: {
    fontFamily: "Nunito_800ExtraBold",
    fontSize: 12,
    color: "#7A284D",
  },
  rarityTextActive: {
    color: "#FFFFFF",
  },
  assignmentCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderWidth: 1,
    borderColor: "rgba(244,114,182,0.2)",
  },
  assignmentLabel: {
    fontFamily: "Nunito_700Bold",
    fontSize: 11,
    color: "#9CA3AF",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  assignmentTitle: {
    fontFamily: "Nunito_800ExtraBold",
    fontSize: 14,
    color: "#4A3728",
  },
  changeText: {
    fontFamily: "Nunito_800ExtraBold",
    fontSize: 12,
    color: "#DB2777",
  },
  abilityOption: {
    gap: 10,
    borderRadius: 18,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.88)",
    borderWidth: 1,
    borderColor: "rgba(244,114,182,0.18)",
  },
  optionDescription: {
    fontFamily: "Nunito_600SemiBold",
    fontSize: 13,
    color: "#6B7280",
  },
  archivedModalPreview: {
    alignItems: "center",
    marginBottom: 16,
  },
  archivedModalTitle: {
    textAlign: "center",
    fontFamily: "Nunito_700Bold",
    fontSize: 16,
    color: "#7A284D",
    marginBottom: 18,
  },
  archivedModalActions: {
    gap: 10,
  },
});
