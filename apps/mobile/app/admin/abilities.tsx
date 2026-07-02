import { useCallback, useMemo, useState, type ReactElement } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import Animated, {
  FadeInLeft,
  FadeInRight,
  FadeInUp,
  FadeOutLeft,
  FadeOutRight,
  FadeOutUp,
  LinearTransition,
} from "react-native-reanimated";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ZodError } from "zod";

import { apiClient } from "../../src/lib/api";
import {
  AbilityTypeChip,
  AdminButton,
  AdminChip,
  AdminEmptyState,
  AdminHero,
  AdminLoadingState,
  AdminModal,
  AdminNotice,
  AdminPanel,
  AdminSearchInput,
  AdminSectionTitle,
  AdminSegmentedControl,
  AdminFilterChip,
  AdminStat,
} from "../../src/components/admin/admin-ui";
import { KEYBOARD_AWARE_SCROLL_PROPS } from "../../src/components/keyboard-aware-scroll-props";
import { useTranslation } from "../../src/i18n";

type AdminAbilityData = Awaited<ReturnType<typeof apiClient.adminAbilities>>;
type AdminAbility = AdminAbilityData["abilities"][number];
type AdminAbilityCard = AdminAbilityData["cards"][number];
type AdminCardAbility = AdminAbilityData["cardAbilities"][number];
type AbilityRole = "passive" | "skill" | "ultimate";

type AbilityListItem =
  | { id: string; type: "section" }
  | { id: string; type: "ability"; ability: AdminAbility }
  | { id: string; type: "assignment"; card: AdminAbilityCard }
  | { id: string; type: "empty" };

const keyExtractor = (item: AbilityListItem) => item.id;
const CONTENT_BOTTOM_PADDING = 132;
const EMPTY_ABILITIES: AdminAbility[] = [];
const EMPTY_ABILITY_CARDS: AdminAbilityCard[] = [];
const EMPTY_CARD_ABILITIES: AdminCardAbility[] = [];
const HEADER_LAYOUT_TRANSITION = LinearTransition.duration(260);
const FILTER_ENTERING = FadeInUp.duration(240);
const FILTER_EXITING = FadeOutUp.duration(200);
const CREATE_ACTION_ENTERING = FadeInLeft.duration(240);
const CREATE_ACTION_EXITING = FadeOutLeft.duration(200);

function allowsPassiveSlot(card: AdminAbilityCard | undefined) {
  return card?.rarityName === "Legendary";
}

function formatAbilitiesError(error: unknown, invalidDataLabel: string) {
  if (error instanceof ZodError) {
    const details = error.issues
      .slice(0, 3)
      .map((issue) => {
        const path = issue.path.length ? issue.path.join(".") : "response";
        return `${path}: ${issue.message}`;
      })
      .join("; ");

    return invalidDataLabel.replace("{details}", details);
  }

  if (error instanceof Error) {
    return error.message;
  }

  return null;
}

export default function AdminAbilitiesScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<"abilities" | "assignments">(
    "abilities",
  );
  const [tabSlideDirection, setTabSlideDirection] = useState<1 | -1>(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<
    "all" | "PASSIVE" | "SKILL" | "ULTIMATE"
  >("all");
  const [assigningCardId, setAssigningCardId] = useState<string | null>(null);
  const [assignmentDraft, setAssignmentDraft] = useState({
    passiveId: "",
    skillId: "",
    ultimateId: "",
  });
  const { data: abilitiesQueryData, error: abilitiesQueryError, isLoading: abilitiesQueryIsLoading } = useQuery({
    queryKey: ["admin-abilities"],
    queryFn: () => apiClient.adminAbilities(),
  });
  const isAbilitiesLoading = abilitiesQueryIsLoading;
  const abilitiesError = formatAbilitiesError(
    abilitiesQueryError,
    t("admin.abilities.invalidApiData", { details: "{details}" }),
  );
  const abilities = abilitiesQueryData?.abilities ?? EMPTY_ABILITIES;
  const cards = abilitiesQueryData?.cards ?? EMPTY_ABILITY_CARDS;
  const cardAbilities =
    abilitiesQueryData?.cardAbilities ?? EMPTY_CARD_ABILITIES;

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.deleteAdminAbility(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-abilities"] });
    },
  });
  const assignmentMutation = useMutation({
    mutationFn: (input: {
      cardId: string;
      passiveId?: string | null;
      skillId?: string | null;
      ultimateId?: string | null;
    }) => apiClient.assignAdminCardAbility(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-abilities"] });
      setAssigningCardId(null);
    },
  });

  const filteredAbilities = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return abilities.filter((ability) => {
      if (typeFilter !== "all" && ability.type !== typeFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      return `${ability.name} ${ability.key} ${ability.description}`
        .toLowerCase()
        .includes(query);
    });
  }, [abilities, searchQuery, typeFilter]);

  const filteredCards = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return cards.filter((card) => {
      if (!query) {
        return true;
      }

      return `${card.name} ${card.character} ${card.type}`
        .toLowerCase()
        .includes(query);
    });
  }, [cards, searchQuery]);

  const abilityById = useMemo(() => {
    const map = new Map<string, AdminAbility>();

    for (const ability of abilities) {
      map.set(ability.id, ability);
    }

    return map;
  }, [abilities]);

  const assignmentsByCardId = useMemo(() => {
    const map = new Map<string, AdminCardAbility>();

    for (const assignment of cardAbilities) {
      map.set(assignment.cardId, assignment);
    }

    return map;
  }, [cardAbilities]);

  const abilitiesByRole = useMemo(() => {
    const grouped: Record<AbilityRole, AdminAbility[]> = {
      passive: [],
      skill: [],
      ultimate: [],
    };

    for (const ability of abilities) {
      const role = ability.type.toLowerCase() as AbilityRole;
      grouped[role]?.push(ability);
    }

    return grouped;
  }, [abilities]);

  const selectedAssignment = assigningCardId
    ? assignmentsByCardId.get(assigningCardId)
    : undefined;
  const selectedAssignmentCard = assigningCardId
    ? cards.find((card) => card.id === assigningCardId)
    : undefined;
  const selectedCardAllowsPassive = allowsPassiveSlot(selectedAssignmentCard);
  const isAbilitiesTab = activeTab === "abilities";

  const handleTabChange = useCallback(
    (nextTab: "abilities" | "assignments") => {
      if (activeTab === nextTab) {
        return;
      }

      setTabSlideDirection(nextTab === "assignments" ? 1 : -1);
      setActiveTab(nextTab);
    },
    [activeTab],
  );

  const openAssignment = useCallback(
    (card: AdminAbilityCard, assignment?: AdminCardAbility) => {
      const cardAllowsPassive = allowsPassiveSlot(card);

      setAssigningCardId(card.id);
      setAssignmentDraft({
        passiveId: cardAllowsPassive ? (assignment?.passiveId ?? "") : "",
        skillId: assignment?.skillId ?? "",
        ultimateId: assignment?.ultimateId ?? "",
      });
    },
    [],
  );

  const listData = useMemo<AbilityListItem[]>(() => {
    if (abilitiesError || isAbilitiesLoading) {
      return [];
    }

    const items: AbilityListItem[] = [
      { id: `section-${activeTab}`, type: "section" },
    ];

    if (isAbilitiesTab) {
      if (filteredAbilities.length) {
        filteredAbilities.forEach((ability) => {
          items.push({
            id: `ability-${ability.id}`,
            type: "ability",
            ability,
          });
        });
      } else {
        items.push({ id: "empty-abilities", type: "empty" });
      }

      return items;
    }

    if (filteredCards.length) {
      filteredCards.forEach((card) => {
        items.push({
          id: `assignment-${card.id}`,
          type: "assignment",
          card,
        });
      });
    } else {
      items.push({ id: "empty-cards", type: "empty" });
    }

    return items;
  }, [
    abilitiesError,
    activeTab,
    filteredAbilities,
    filteredCards,
    isAbilitiesLoading,
    isAbilitiesTab,
  ]);

  const tabContentEntering = useMemo(
    () =>
      tabSlideDirection === 1
        ? FadeInRight.duration(260)
        : FadeInLeft.duration(260),
    [tabSlideDirection],
  );
  const tabContentExiting = useMemo(
    () =>
      tabSlideDirection === 1
        ? FadeOutLeft.duration(200)
        : FadeOutRight.duration(200),
    [tabSlideDirection],
  );

  const listHeader = useMemo(
    () => (
      <View className="gap-4">
        <Animated.View layout={HEADER_LAYOUT_TRANSITION}>
          <AdminHero
            title={t("admin.abilities.title")}
            subtitle={t("admin.abilities.subtitle")}
            actions={
              <>
                {isAbilitiesTab ? (
                  <Animated.View
                    entering={CREATE_ACTION_ENTERING}
                    exiting={CREATE_ACTION_EXITING}
                  >
                    <AdminButton
                      label={t("admin.abilities.createAbility")}
                      icon="add"
                      onPress={() =>
                        router.push({
                          pathname: "/admin-ability-editor",
                          params: { mode: "create" },
                        } as any)
                      }
                    />
                  </Animated.View>
                ) : null}
              </>
            }
          >
            <View className="flex-row flex-wrap gap-3">
              <AdminStat
                label={t("admin.abilities.libraryLabel")}
                value={String(abilities.length)}
                tone="accent"
              />
              <AdminStat
                label={t("admin.abilities.assignmentLabel")}
                value={String(cardAbilities.length)}
                tone="info"
              />
            </View>
            <AdminSegmentedControl
              value={activeTab}
              options={[
                {
                  label: t("admin.abilities.tabAbilities"),
                  value: "abilities",
                },
                {
                  label: t("admin.abilities.tabAssignments"),
                  value: "assignments",
                },
              ]}
              onChange={handleTabChange}
            />
            <View>
              <Animated.View
                className="gap-3"
                layout={HEADER_LAYOUT_TRANSITION}
              >
                <AdminSearchInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder={
                    isAbilitiesTab
                      ? t("admin.abilities.searchAbilities")
                      : t("admin.abilities.searchCards")
                  }
                />
                {isAbilitiesTab ? (
                  <Animated.View
                    className="overflow-hidden"
                    layout={HEADER_LAYOUT_TRANSITION}
                  >
                    <Animated.View
                      className="flex-row flex-wrap gap-2"
                      entering={FILTER_ENTERING}
                      exiting={FILTER_EXITING}
                      layout={HEADER_LAYOUT_TRANSITION}
                    >
                      {(["all", "PASSIVE", "SKILL", "ULTIMATE"] as const).map(
                        (type) => (
                          <AdminFilterChip
                            key={type}
                            label={
                              type === "all"
                                ? t("collection.all")
                                : t(`admin.abilities.type.${type}`)
                            }
                            selected={typeFilter === type}
                            onPress={() => setTypeFilter(type)}
                          />
                        ),
                      )}
                    </Animated.View>
                  </Animated.View>
                ) : null}
              </Animated.View>
            </View>
          </AdminHero>
        </Animated.View>

        <Animated.View
          key={`guidance-${activeTab}`}
          entering={tabContentEntering}
          exiting={tabContentExiting}
        >
          {abilitiesError ? (
            <AdminPanel>
              <Text className="font-nunito-bold text-[13px] text-dangerText">
                {abilitiesError}
              </Text>
            </AdminPanel>
          ) : isAbilitiesLoading ? (
            <AdminPanel>
              <AdminLoadingState
                title={
                  isAbilitiesTab
                    ? t("admin.abilities.loadingAbilities")
                    : t("admin.abilities.loadingAssignments")
                }
                body={t("common.loadingStates.adminBody")}
                icon={isAbilitiesTab ? "flash" : "git-network"}
              />
            </AdminPanel>
          ) : (
            <AdminNotice
              title={
                isAbilitiesTab
                  ? t("admin.abilities.libraryGuidanceTitle")
                  : t("admin.abilities.assignmentGuidanceTitle")
              }
              body={
                isAbilitiesTab
                  ? t("admin.abilities.libraryGuidanceBody")
                  : t("admin.abilities.assignmentGuidanceBody")
              }
              tone="info"
              icon={isAbilitiesTab ? "flash-outline" : "git-network-outline"}
            />
          )}
        </Animated.View>
      </View>
    ),
    [
      abilities.length,
      activeTab,
      cardAbilities.length,
      abilitiesError,
      handleTabChange,
      isAbilitiesLoading,
      isAbilitiesTab,
      router,
      searchQuery,
      tabContentEntering,
      tabContentExiting,
      t,
      typeFilter,
    ],
  );

  const renderItem = useCallback(
    ({ item }: { item: AbilityListItem }) => {
      const wrapListItem = (children: ReactElement) => (
        <Animated.View
          entering={tabContentEntering}
          exiting={tabContentExiting}
        >
          {children}
        </Animated.View>
      );

      if (item.type === "section") {
        return wrapListItem(
          <AdminPanel>
            <AdminSectionTitle
              title={
                isAbilitiesTab
                  ? t("admin.abilities.libraryTitle", {
                      count: filteredAbilities.length,
                    })
                  : t("admin.abilities.assignmentsTitle", {
                      count: filteredCards.length,
                    })
              }
              subtitle={
                isAbilitiesTab
                  ? t("admin.abilities.librarySubtitle")
                  : t("admin.abilities.assignmentsSubtitle")
              }
            />
          </AdminPanel>,
        );
      }

      if (item.type === "empty") {
        return wrapListItem(
          <AdminPanel>
            <AdminEmptyState
              icon={isAbilitiesTab ? "flash" : "people"}
              title={
                isAbilitiesTab
                  ? t("admin.abilities.noAbilitiesTitle")
                  : t("admin.abilities.noCardsTitle")
              }
              body={
                isAbilitiesTab
                  ? t("admin.abilities.noAbilitiesBody")
                  : t("admin.abilities.noCardsBody")
              }
            />
          </AdminPanel>,
        );
      }

      if (item.type === "ability") {
        const { ability } = item;

        return wrapListItem(
          <Pressable
            className="gap-[10] rounded-[22] border border-primaryBorder/20 bg-surfaceMuted p-[14]"
            onPress={() =>
              router.push({
                pathname: "/admin-ability-editor",
                params: { mode: "edit", abilityId: ability.id },
              } as any)
            }
          >
            <View className="flex-row items-center justify-between gap-2">
              <Text className="flex-1 font-nunito-extrabold text-[15px] text-fg">
                {ability.name}
              </Text>
              <AbilityTypeChip type={ability.type} />
            </View>
            <View className="flex-row flex-wrap gap-2">
              <AdminChip label={ability.key} tone="accent" />
              <AdminChip
                label={t("admin.abilities.costLabel", {
                  cost: ability.cost,
                })}
                tone="info"
              />
              {ability.cooldown ? (
                <AdminChip
                  label={t("admin.abilities.cooldownLabel", {
                    count: ability.cooldown,
                  })}
                  tone="warning"
                />
              ) : null}
              {ability.oncePerMatch ? (
                <AdminChip
                  label={t("admin.abilities.oncePerMatchShort")}
                  tone="success"
                />
              ) : null}
            </View>
            <Text className="font-nunito-semibold text-[13px] leading-[19px] text-fgMuted">
              {ability.description}
            </Text>
            <View className="flex-row gap-2">
              <AdminButton
                label={t("admin.common.edit")}
                variant="ghost"
                onPress={() =>
                  router.push({
                    pathname: "/admin-ability-editor",
                    params: { mode: "edit", abilityId: ability.id },
                  } as any)
                }
              />
              <AdminButton
                label={t("admin.common.delete")}
                variant="danger"
                onPress={() => deleteMutation.mutate(ability.id)}
              />
            </View>
          </Pressable>,
        );
      }

      const { card } = item;
      const assignment = assignmentsByCardId.get(card.id);
      const passive = abilityById.get(assignment?.passiveId ?? "");
      const skill = abilityById.get(assignment?.skillId ?? "");
      const ultimate = abilityById.get(assignment?.ultimateId ?? "");
      const cardAllowsPassive = allowsPassiveSlot(card);

      return wrapListItem(
        <Pressable
          className="gap-[10] rounded-[22] border border-primaryBorder/20 bg-surfaceMuted p-[14]"
          onPress={() => openAssignment(card, assignment)}
        >
          <Text
            className="font-nunito-extrabold text-[15px] text-fg"
            numberOfLines={2}
          >
            {card.name}
          </Text>
          <Text className="font-nunito-semibold text-xs text-muted">
            {card.character} - {card.type} -{" "}
            {card.rarityName ?? t("admin.common.default")}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            <AdminChip
              label={t("admin.abilities.passiveLabel", {
                name: cardAllowsPassive
                  ? (passive?.name ?? t("admin.common.default"))
                  : t("admin.abilities.passiveUnavailable"),
              })}
              tone={cardAllowsPassive ? "success" : "warning"}
            />
            <AdminChip
              label={t("admin.abilities.skillLabel", {
                name: skill?.name ?? t("admin.common.default"),
              })}
              tone="info"
            />
            <AdminChip
              label={t("admin.abilities.ultimateLabel", {
                name: ultimate?.name ?? t("admin.common.default"),
              })}
              tone="warning"
            />
          </View>
          <AdminButton
            label={t("admin.common.manage")}
            variant="ghost"
            onPress={() => openAssignment(card, assignment)}
          />
        </Pressable>,
      );
    },
    [
      abilityById,
      assignmentsByCardId,
      deleteMutation.mutate,
      filteredAbilities.length,
      filteredCards.length,
      isAbilitiesTab,
      openAssignment,
      router,
      tabContentEntering,
      tabContentExiting,
      t,
    ],
  );

  return (
    <>
      <FlatList
        {...KEYBOARD_AWARE_SCROLL_PROPS}
        data={listData}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: 132,
          gap: 16,
        }}
        ListHeaderComponent={listHeader}
        removeClippedSubviews={false}
        windowSize={5}
        maxToRenderPerBatch={8}
        initialNumToRender={8}
      />

      {assigningCardId !== null ? (
        <AdminModal
          visible
          title={t("admin.abilities.assignTitle")}
          onClose={() => setAssigningCardId(null)}
        >
          <View className="rounded-[20] border border-primaryBorder/16 bg-primaryTint/30 p-4">
            <Text className="font-nunito-bold text-[13px] leading-[19px] text-fgMuted">
              {selectedAssignment
                ? t("admin.abilities.assignmentModalExisting")
                : t("admin.abilities.assignmentModalNew")}
            </Text>
          </View>
          {(["passive", "skill", "ultimate"] as const).map((role) => {
            const selectedId = assignmentDraft[`${role}Id` as const];
            const passiveDisabled =
              role === "passive" && !selectedCardAllowsPassive;
            const roleAbilities = passiveDisabled ? [] : abilitiesByRole[role];

            return (
              <View
                key={role}
                className={`gap-[10] rounded-[20] p-[14] ${
                  passiveDisabled ? "bg-surfaceMuted/80" : "bg-surface/82"
                }`}
              >
                <View className="flex-row items-center justify-between gap-3">
                  <Text className="font-nunito-extrabold text-sm text-primaryText">
                    {t(`admin.abilities.type.${role.toUpperCase()}`)}
                  </Text>
                  {passiveDisabled ? (
                    <AdminChip
                      label={t("admin.abilities.passiveLegendaryOnly")}
                      tone="warning"
                    />
                  ) : null}
                </View>
                {passiveDisabled ? (
                  <Text className="font-nunito-semibold text-[13px] leading-[19px] text-fgMuted">
                    {t("admin.abilities.passiveUnavailable")}
                  </Text>
                ) : null}
                <AdminButton
                  label={t("admin.common.useDefault")}
                  variant="ghost"
                  disabled={passiveDisabled}
                  onPress={() =>
                    setAssignmentDraft(
                      (current) =>
                        ({
                          ...current,
                          [`${role}Id`]: "",
                        }) as typeof current,
                    )
                  }
                />
                {roleAbilities.map((ability) => (
                  <Pressable
                    key={ability.id}
                    className={`gap-[6] rounded-2xl border p-3 ${
                      selectedId === ability.id
                        ? "border-primary bg-primaryBg"
                        : "border-primaryBorder/16 bg-surface/90"
                    }`}
                    onPress={() =>
                      setAssignmentDraft(
                        (current) =>
                          ({
                            ...current,
                            [`${role}Id`]: ability.id,
                          }) as typeof current,
                      )
                    }
                  >
                    <Text className="flex-1 font-nunito-extrabold text-[15px] text-fg">
                      {ability.name}
                    </Text>
                    <Text className="font-nunito-semibold text-[13px] text-fgMuted">
                      {ability.description}
                    </Text>
                  </Pressable>
                ))}
              </View>
            );
          })}
          <AdminButton
            label={t("admin.abilities.saveAssignments")}
            onPress={() =>
              assignmentMutation.mutate({
                cardId: assigningCardId,
                passiveId: selectedCardAllowsPassive
                  ? assignmentDraft.passiveId || null
                  : null,
                skillId: assignmentDraft.skillId || null,
                ultimateId: assignmentDraft.ultimateId || null,
              })
            }
          />
        </AdminModal>
      ) : null}
    </>
  );
}
