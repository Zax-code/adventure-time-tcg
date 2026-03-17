import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { AdminAbilitiesResponse, AdminCardsResponse } from "@adventure-time/shared";

import { apiClient } from "../../src/lib/api";
import { prefetchCardImages } from "../../src/lib/card-images";
import { AdminCardTile } from "../../src/components/admin/admin-card-tile";
import {
  AbilityTypeChip,
  AdminButton,
  AdminChip,
  AdminField,
  AdminModal,
  AdminPanel,
  AdminSearchInput,
} from "../../src/components/admin/admin-ui";

const GRID_GAP = 12;
const SCREEN_SIDE_PADDING = 16;
const COLLECTION_SIDE_PADDING = 12;
const CONTENT_BOTTOM_PADDING = 128;

type AdminCard = AdminCardsResponse["cards"][number];

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

type CardRow = {
  id: string;
  left: AdminCard;
  right?: AdminCard;
};

type CardsListItem =
  | { id: string; type: "active-header" }
  | { id: string; type: "active-row"; row: CardRow }
  | { id: string; type: "archived-header" }
  | { id: string; type: "archived-row"; row: CardRow };

const keyExtractor = (item: CardsListItem) => item.id;

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

const FIELD_LABELS: Array<{
  key: keyof CardDraft;
  label: string;
  keyboardType?: "default" | "numeric";
}> = [
  { key: "name", label: "Name" },
  { key: "character", label: "Character" },
  { key: "description", label: "Description" },
  { key: "hp", label: "HP", keyboardType: "numeric" },
  { key: "attack", label: "Attack", keyboardType: "numeric" },
  { key: "defense", label: "Defense", keyboardType: "numeric" },
  { key: "speed", label: "Speed", keyboardType: "numeric" },
  { key: "type", label: "Type" },
];

function getTwoColumnWidth(screenWidth: number) {
  const availableWidth =
    screenWidth - SCREEN_SIDE_PADDING * 2 - COLLECTION_SIDE_PADDING * 2;
  return Math.floor((availableWidth - GRID_GAP) / 2);
}

function toDraft(card: AdminCard): CardDraft {
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

function chunkCards(cards: AdminCard[]) {
  const rows: CardRow[] = [];

  for (let index = 0; index < cards.length; index += 2) {
    rows.push({
      id: `row-${cards[index].id}-${cards[index + 1]?.id ?? "empty"}`,
      left: cards[index],
      right: cards[index + 1],
    });
  }

  return rows;
}

export default function AdminCardsScreen() {
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();
  const [searchQuery, setSearchQuery] = useState("");
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [selectedArchivedCardId, setSelectedArchivedCardId] = useState<string | null>(
    null,
  );
  const [isActiveCardsOpen, setIsActiveCardsOpen] = useState(true);
  const [isArchivedCardsOpen, setIsArchivedCardsOpen] = useState(true);
  const [draft, setDraft] = useState<CardDraft>(BLANK_CARD_DRAFT);
  const [pickerRole, setPickerRole] = useState<
    "passive" | "skill" | "ultimate" | null
  >(null);
  const [assignmentDraft, setAssignmentDraft] = useState({
    passiveId: "",
    skillId: "",
    ultimateId: "",
  });

  const cardsQuery = useQuery({
    queryKey: ["admin-cards"],
    queryFn: () => apiClient.adminCards(),
  });
  const raritiesQuery = useQuery({
    queryKey: ["admin-rarities"],
    queryFn: () => apiClient.rarities(),
  });
  const abilitiesQuery = useQuery({
    queryKey: ["admin-abilities"],
    queryFn: () => apiClient.adminAbilities(),
  });

  const saveCardMutation = useMutation({
    mutationFn: async () => {
      if (!editingCardId) {
        return apiClient.createAdminCard(savePayload(draft));
      }
      return apiClient.saveAdminCard(editingCardId, savePayload(draft));
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-cards"] });
      setEditingCardId(null);
      setDraft(BLANK_CARD_DRAFT);
    },
  });
  const featureMutation = useMutation({
    mutationFn: ({
      cardId,
      isFeatured,
      isArchived,
    }: {
      cardId: string;
      isFeatured?: boolean;
      isArchived?: boolean;
    }) => apiClient.updateAdminCard(cardId, { isFeatured, isArchived }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-cards"] });
    },
  });
  const assignMutation = useMutation({
    mutationFn: (payload: {
      cardId: string;
      passiveId?: string | null;
      skillId?: string | null;
      ultimateId?: string | null;
    }) => apiClient.assignAdminCardAbility(payload),
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
      await queryClient.invalidateQueries({ queryKey: ["admin-cards"] });
    },
  });

  const tileWidth = getTwoColumnWidth(width);
  const cards = cardsQuery.data?.cards ?? [];
  const isCardsLoading = cardsQuery.isLoading;
  const cardsError = cardsQuery.error instanceof Error ? cardsQuery.error.message : null;

  const derived = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const active: AdminCard[] = [];
    const archived: AdminCard[] = [];
    const rarityCounts = new Map<string, number>();
    const cardById = new Map<string, AdminCard>();

    for (const card of cards) {
      cardById.set(card.id, card);
      rarityCounts.set(card.rarityId, (rarityCounts.get(card.rarityId) ?? 0) + 1);

      const matchesSearch =
        !query || `${card.name} ${card.character}`.toLowerCase().includes(query);

      if (!matchesSearch) {
        continue;
      }

      if (card.isArchived) {
        archived.push(card);
      } else {
        active.push(card);
      }
    }

    const cardAbilityByCardId = new Map(
      (abilitiesQuery.data?.cardAbilities ?? []).map((entry) => [entry.cardId, entry]),
    );
    const abilityById = new Map(
      (abilitiesQuery.data?.abilities ?? []).map((ability) => [ability.id, ability]),
    );

    return {
      activeCards: active,
      archivedCards: archived,
      allActiveCount: cards.filter((card) => !card.isArchived).length,
      allArchivedCount: cards.filter((card) => card.isArchived).length,
      rarityCounts,
      cardById,
      cardAbilityByCardId,
      abilityById,
    };
  }, [abilitiesQuery.data?.abilities, abilitiesQuery.data?.cardAbilities, cards, searchQuery]);

  const selectedEditingCard = editingCardId ? derived.cardById.get(editingCardId) ?? null : null;
  const selectedArchivedCard = selectedArchivedCardId
    ? derived.cardById.get(selectedArchivedCardId) ?? null
    : null;

  // Stabilize prefetch — key on a joined string of asset IDs, not the array reference
  const prefetchKey = useMemo(
    () => cards.slice(0, 48).map((c) => c.imageAssetId).filter(Boolean).join(","),
    [cards],
  );
  useEffect(() => {
    if (prefetchKey) {
      void prefetchCardImages(prefetchKey.split(","));
    }
  }, [prefetchKey]);

  useEffect(() => {
    if (!editingCardId || !selectedEditingCard) {
      return;
    }

    setDraft(toDraft(selectedEditingCard));
    const currentAssignment = derived.cardAbilityByCardId.get(selectedEditingCard.id);
    setAssignmentDraft({
      passiveId: currentAssignment?.passiveId ?? "",
      skillId: currentAssignment?.skillId ?? "",
      ultimateId: currentAssignment?.ultimateId ?? "",
    });
  }, [derived.cardAbilityByCardId, editingCardId, selectedEditingCard]);

  const previewCard = useMemo(() => {
    if (editingCardId === null) {
      return null;
    }

    return {
      id: selectedEditingCard?.id ?? "preview",
      ...savePayload(draft),
      rarityId: draft.rarityId || raritiesQuery.data?.rarities[0]?.id || "",
      rarityName:
        raritiesQuery.data?.rarities.find((rarity) => rarity.id === draft.rarityId)?.name ??
        selectedEditingCard?.rarityName ??
        raritiesQuery.data?.rarities[0]?.name ??
        "Common",
      isArchived: selectedEditingCard?.isArchived ?? false,
      isFeatured: selectedEditingCard?.isFeatured ?? false,
      imageAssetId: selectedEditingCard?.imageAssetId ?? null,
    };
  }, [draft, editingCardId, raritiesQuery.data?.rarities, selectedEditingCard]);

  const pickerOptions = useMemo(() => {
    if (!pickerRole) {
      return [] as AdminAbilitiesResponse["abilities"];
    }
    const type = pickerRole.toUpperCase();
    return (abilitiesQuery.data?.abilities ?? []).filter((ability) => ability.type === type);
  }, [abilitiesQuery.data?.abilities, pickerRole]);

  const listData = useMemo(() => {
    const items: CardsListItem[] = [{ id: "active-header", type: "active-header" }];

    if (isActiveCardsOpen) {
      chunkCards(derived.activeCards).forEach((row) => {
        items.push({ id: `active-${row.id}`, type: "active-row", row });
      });
    }

    items.push({ id: "archived-header", type: "archived-header" });

    if (isArchivedCardsOpen) {
      chunkCards(derived.archivedCards).forEach((row) => {
        items.push({ id: `archived-${row.id}`, type: "archived-row", row });
      });
    }

    return items;
  }, [derived.activeCards, derived.archivedCards, isActiveCardsOpen, isArchivedCardsOpen]);

  const openCreateModal = useCallback(() => {
    setEditingCardId("");
    setDraft({
      ...BLANK_CARD_DRAFT,
      rarityId: raritiesQuery.data?.rarities[0]?.id ?? "",
    });
    setAssignmentDraft({ passiveId: "", skillId: "", ultimateId: "" });
  }, [raritiesQuery.data?.rarities]);

  const renderCardRow = useCallback(
    (row: CardRow, archived: boolean) => (
      <View style={styles.rowWrap}>
        <Pressable
          style={[styles.tileWrap, { width: tileWidth }, archived ? styles.archivedTile : null]}
          onPress={() =>
            archived ? setSelectedArchivedCardId(row.left.id) : setEditingCardId(row.left.id)
          }
        >
          <AdminCardTile card={row.left} fitContainer />
        </Pressable>
        {row.right ? (
          <Pressable
            style={[styles.tileWrap, { width: tileWidth }, archived ? styles.archivedTile : null]}
            onPress={() =>
              archived ? setSelectedArchivedCardId(row.right!.id) : setEditingCardId(row.right!.id)
            }
          >
            <AdminCardTile card={row.right} fitContainer />
          </Pressable>
        ) : (
          <View style={{ width: tileWidth }} />
        )}
      </View>
    ),
    [tileWidth],
  );

  const renderItem = useCallback(
    ({ item }: { item: CardsListItem }) => {
      if (item.type === "active-header") {
        const activeCountLabel = isCardsLoading ? "..." : String(derived.activeCards.length);
        const activeTotalLabel = isCardsLoading ? "..." : String(derived.allActiveCount);

        return (
          <View style={styles.collectionSection}>
            <Pressable
              style={styles.collectionToggle}
              onPress={() => setIsActiveCardsOpen((current) => !current)}
            >
              <Text style={styles.collectionTitle}>
                All Cards ({activeCountLabel})
                {searchQuery ? ` / ${activeTotalLabel}` : ""}
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
                ) : derived.activeCards.length ? (
                  <Text style={styles.helperText}>Tap a card to edit it.</Text>
                ) : (
                  <Text style={styles.emptyCopy}>No cards match your search.</Text>
                )}
              </View>
            ) : null}
          </View>
        );
      }

      if (item.type === "archived-header") {
        const archivedCountLabel = isCardsLoading ? "..." : String(derived.archivedCards.length);
        const archivedTotalLabel = isCardsLoading ? "..." : String(derived.allArchivedCount);

        return (
          <View style={styles.collectionSection}>
            <Pressable
              style={styles.archivedToggle}
              onPress={() => setIsArchivedCardsOpen((current) => !current)}
            >
              <Text style={styles.archivedTitle}>
                Archived Cards ({archivedCountLabel})
                {searchQuery ? ` / ${archivedTotalLabel}` : ""}
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
                ) : derived.archivedCards.length ? (
                  <Text style={styles.helperText}>Tap a card to manage it.</Text>
                ) : (
                  <Text style={styles.emptyCopy}>
                    {searchQuery
                      ? "No archived cards match your search."
                      : "No archived cards."}
                  </Text>
                )}
              </View>
            ) : null}
          </View>
        );
      }

      if (item.type === "active-row") {
        return renderCardRow(item.row, false);
      }

      return renderCardRow(item.row, true);
    },
    [
      cardsError,
      derived.activeCards.length,
      derived.allActiveCount,
      derived.allArchivedCount,
      derived.archivedCards.length,
      isActiveCardsOpen,
      isArchivedCardsOpen,
      isCardsLoading,
      renderCardRow,
      searchQuery,
    ],
  );

  const listHeader = useMemo(
    () => (
      <>
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>Card Admin</Text>
        </View>

        <View style={styles.ctaRow}>
          <AdminButton label="Add card" icon="add" onPress={openCreateModal} />
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
                    {derived.rarityCounts.get(rarity.id) ?? 0}
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
      </>
    ),
    [searchQuery, isCardsLoading, cardsError, raritiesQuery.data?.rarities, derived.rarityCounts, openCreateModal],
  );

  return (
    <>
      <FlatList
        data={listData}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.pageContent}
        ListHeaderComponent={listHeader}
        removeClippedSubviews
        windowSize={5}
        maxToRenderPerBatch={6}
        initialNumToRender={8}
      />

      {editingCardId !== null ? (
        <AdminModal
          visible
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
                onChangeText={(value) =>
                  setDraft((current) => ({ ...current, [field.key]: value }))
                }
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
                    onPress={() =>
                      setDraft((current) => ({ ...current, rarityId: rarity.id }))
                    }
                    style={[styles.rarityPill, active ? styles.rarityPillActive : null]}
                  >
                    <Text style={[styles.rarityText, active ? styles.rarityTextActive : null]}>
                      {rarity.name}
                    </Text>
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
                const selected = selectedId ? derived.abilityById.get(selectedId) : undefined;
                return (
                  <Pressable
                    key={role}
                    onPress={() => setPickerRole(role)}
                    style={styles.assignmentCard}
                  >
                    <View style={{ flex: 1, gap: 6 }}>
                      <Text style={styles.assignmentLabel}>{label}</Text>
                      <Text style={styles.assignmentTitle}>
                        {selected?.name ?? `Choose ${label.toLowerCase()} ability`}
                      </Text>
                      {selected ? (
                        <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                          <AbilityTypeChip type={selected.type} />
                          <AdminChip label={`Cost ${selected.cost}`} tone="info" />
                          {selected.cooldown ? (
                            <AdminChip label={`CD ${selected.cooldown}`} tone="accent" />
                          ) : null}
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
                  onPress={() =>
                    setAssignmentDraft({ passiveId: "", skillId: "", ultimateId: "" })
                  }
                />
              </View>
            ) : null}
          </View>

          {editingCardId ? (
            <View style={styles.tileActionRow}>
              <AdminButton
                label="Upload image"
                variant="secondary"
                onPress={() => uploadMutation.mutate(editingCardId)}
              />
              <AdminButton
                label={selectedEditingCard?.isArchived ? "Restore" : "Archive"}
                variant="danger"
                onPress={() =>
                  featureMutation.mutate({
                    cardId: editingCardId,
                    isArchived: !(selectedEditingCard?.isArchived ?? false),
                  })
                }
              />
            </View>
          ) : null}

          <AdminButton
            label={
              saveCardMutation.isPending
                ? "Saving..."
                : editingCardId
                  ? "Save card"
                  : "Create card"
            }
            onPress={() => saveCardMutation.mutate()}
            disabled={saveCardMutation.isPending || !draft.rarityId}
          />
        </AdminModal>
      ) : null}

      {pickerRole !== null ? (
        <AdminModal visible title="Choose ability" onClose={() => setPickerRole(null)}>
          <AdminButton
            label="Use default / none"
            variant="ghost"
            onPress={() => {
              setAssignmentDraft(
                (current) => ({ ...current, [`${pickerRole}Id`]: "" }) as typeof current,
              );
              setPickerRole(null);
            }}
          />
          {pickerOptions.map((ability) => (
            <Pressable
              key={ability.id}
              onPress={() => {
                setAssignmentDraft(
                  (current) => ({ ...current, [`${pickerRole}Id`]: ability.id }) as typeof current,
                );
                setPickerRole(null);
              }}
              style={styles.abilityOption}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Text style={styles.assignmentTitle}>{ability.name}</Text>
                <AbilityTypeChip type={ability.type} />
              </View>
              <Text style={styles.optionDescription}>{ability.description}</Text>
              <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                <AdminChip label={ability.key} tone="accent" />
                <AdminChip label={`Cost ${ability.cost}`} tone="info" />
                {ability.cooldown ? (
                  <AdminChip label={`Cooldown ${ability.cooldown}`} tone="warning" />
                ) : null}
              </View>
            </Pressable>
          ))}
        </AdminModal>
      ) : null}

      {selectedArchivedCard ? (
        <AdminModal
          visible
          title="Archived Card"
          onClose={() => setSelectedArchivedCardId(null)}
        >
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
            <AdminButton
              label="Cancel"
              variant="ghost"
              onPress={() => setSelectedArchivedCardId(null)}
            />
          </View>
        </AdminModal>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  pageContent: {
    paddingHorizontal: SCREEN_SIDE_PADDING,
    paddingTop: 8,
    paddingBottom: CONTENT_BOTTOM_PADDING,
    gap: 16,
  },
  pageHeader: {
    alignItems: "center",
    paddingTop: 4,
  },
  pageTitle: {
    fontFamily: "Nunito_800ExtraBold",
    fontSize: 28,
    color: "#BE185D",
  },
  ctaRow: {
    marginTop: 16,
  },
  statsPanel: {
    marginTop: 16,
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
    marginTop: 16,
  },
  collectionSection: {
    marginTop: 8,
  },
  collectionToggle: {
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
  rowWrap: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: GRID_GAP,
    paddingHorizontal: COLLECTION_SIDE_PADDING,
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
