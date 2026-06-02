import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Pressable, Text, View } from "react-native";
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
  AdminPageScroll,
  AdminPanel,
  AdminSearchInput,
  AdminSectionTitle,
  AdminSegmentedControl,
  AdminFilterChip,
  AdminStat,
} from "../../src/components/admin/admin-ui";
import { useTranslation } from "../../src/i18n";

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
  const [showHeroAction, setShowHeroAction] = useState(true);
  const tabTransition = useRef(new Animated.Value(1)).current;
  const heroActionProgress = useRef(new Animated.Value(1)).current;
  const tabDirection = useRef(1);

  const abilitiesQuery = useQuery({
    queryKey: ["admin-abilities"],
    queryFn: () => apiClient.adminAbilities(),
  });
  const isAbilitiesLoading = abilitiesQuery.isLoading;
  const abilitiesError = formatAbilitiesError(
    abilitiesQuery.error,
    t("admin.abilities.invalidApiData", { details: "{details}" }),
  );

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

    return (abilitiesQuery.data?.abilities ?? []).filter((ability) => {
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
  }, [abilitiesQuery.data?.abilities, searchQuery, typeFilter]);

  const filteredCards = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return (abilitiesQuery.data?.cards ?? []).filter((card) => {
      if (!query) {
        return true;
      }

      return `${card.name} ${card.character} ${card.type}`
        .toLowerCase()
        .includes(query);
    });
  }, [abilitiesQuery.data?.cards, searchQuery]);

  const selectedAssignment = abilitiesQuery.data?.cardAbilities.find(
    (entry) => entry.cardId === assigningCardId,
  );
  const isAbilitiesTab = activeTab === "abilities";

  useEffect(() => {
    tabTransition.setValue(0);
    Animated.timing(tabTransition, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [activeTab, tabTransition]);

  useEffect(() => {
    heroActionProgress.stopAnimation();

    if (isAbilitiesTab) {
      setShowHeroAction(true);
      heroActionProgress.setValue(0);
      Animated.timing(heroActionProgress, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      return;
    }

    Animated.timing(heroActionProgress, {
      toValue: 0,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setShowHeroAction(false);
      }
    });
  }, [heroActionProgress, isAbilitiesTab]);

  const tabTransitionStyle = {
    opacity: tabTransition,
    transform: [
      {
        translateX: tabTransition.interpolate({
          inputRange: [0, 1],
          outputRange: [tabDirection.current * 28, 0],
        }),
      },
    ],
  };
  const heroActionStyle = {
    opacity: heroActionProgress,
    transform: [
      {
        translateX: heroActionProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [12, 0],
        }),
      },
      {
        scale: heroActionProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [0.98, 1],
        }),
      },
    ],
  };

  function handleTabChange(nextTab: "abilities" | "assignments") {
    if (nextTab === activeTab) {
      return;
    }

    tabDirection.current = nextTab === "assignments" ? 1 : -1;
    setActiveTab(nextTab);
  }

  return (
    <>
      <AdminPageScroll>
        <AdminHero
          title={t("admin.abilities.title")}
          subtitle={t("admin.abilities.subtitle")}
          actions={
            showHeroAction ? (
              <Animated.View style={heroActionStyle}>
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
            ) : undefined
          }
        >
          <View className="flex-row flex-wrap gap-3">
            <AdminStat
              label={t("admin.abilities.libraryLabel")}
              value={String(abilitiesQuery.data?.abilities.length ?? 0)}
              tone="accent"
            />
            <AdminStat
              label={t("admin.abilities.assignmentLabel")}
              value={String(abilitiesQuery.data?.cardAbilities.length ?? 0)}
              tone="info"
            />
          </View>
          <AdminSegmentedControl
            value={activeTab}
            options={[
              { label: t("admin.abilities.tabAbilities"), value: "abilities" },
              {
                label: t("admin.abilities.tabAssignments"),
                value: "assignments",
              },
            ]}
            onChange={handleTabChange}
          />
          <Animated.View style={tabTransitionStyle}>
            <View className="gap-3">
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
                <View className="flex-row flex-wrap gap-2">
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
                </View>
              ) : null}
            </View>
          </Animated.View>
        </AdminHero>

        <Animated.View style={tabTransitionStyle}>
          <View className="gap-4">
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

            {isAbilitiesTab ? (
              <AdminPanel>
                <AdminSectionTitle
                  title={t("admin.abilities.libraryTitle", {
                    count: filteredAbilities.length,
                  })}
                  subtitle={t("admin.abilities.librarySubtitle")}
                />
                <View className="mt-3 gap-3">
                  {abilitiesError ||
                  isAbilitiesLoading ? null : filteredAbilities.length ? (
                    filteredAbilities.map((ability) => (
                      <Pressable
                        key={ability.id}
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
                      </Pressable>
                    ))
                  ) : (
                    <AdminEmptyState
                      icon="flash"
                      title={t("admin.abilities.noAbilitiesTitle")}
                      body={t("admin.abilities.noAbilitiesBody")}
                    />
                  )}
                </View>
              </AdminPanel>
            ) : (
              <AdminPanel>
                <AdminSectionTitle
                  title={t("admin.abilities.assignmentsTitle", {
                    count: filteredCards.length,
                  })}
                  subtitle={t("admin.abilities.assignmentsSubtitle")}
                />
                <View className="mt-3 gap-3">
                  {abilitiesError ||
                  isAbilitiesLoading ? null : filteredCards.length ? (
                    filteredCards.map((card) => {
                      const assignment =
                        abilitiesQuery.data?.cardAbilities.find(
                          (entry) => entry.cardId === card.id,
                        );
                      const passive = abilitiesQuery.data?.abilities.find(
                        (ability) => ability.id === assignment?.passiveId,
                      );
                      const skill = abilitiesQuery.data?.abilities.find(
                        (ability) => ability.id === assignment?.skillId,
                      );
                      const ultimate = abilitiesQuery.data?.abilities.find(
                        (ability) => ability.id === assignment?.ultimateId,
                      );

                      return (
                        <Pressable
                          key={card.id}
                          className="gap-[10] rounded-[22] border border-primaryBorder/20 bg-surfaceMuted p-[14]"
                          onPress={() => {
                            setAssigningCardId(card.id);
                            setAssignmentDraft({
                              passiveId: assignment?.passiveId ?? "",
                              skillId: assignment?.skillId ?? "",
                              ultimateId: assignment?.ultimateId ?? "",
                            });
                          }}
                        >
                          <Text className="flex-1 font-nunito-extrabold text-[15px] text-fg">
                            {card.name}
                          </Text>
                          <Text className="font-nunito-semibold text-xs text-muted">
                            {card.character} - {card.type}
                          </Text>
                          <View className="flex-row flex-wrap gap-2">
                            <AdminChip
                              label={t("admin.abilities.passiveLabel", {
                                name:
                                  passive?.name ?? t("admin.common.default"),
                              })}
                              tone="success"
                            />
                            <AdminChip
                              label={t("admin.abilities.skillLabel", {
                                name: skill?.name ?? t("admin.common.default"),
                              })}
                              tone="info"
                            />
                            <AdminChip
                              label={t("admin.abilities.ultimateLabel", {
                                name:
                                  ultimate?.name ?? t("admin.common.default"),
                              })}
                              tone="warning"
                            />
                          </View>
                          <AdminButton
                            label={t("admin.common.manage")}
                            variant="ghost"
                            onPress={() => {
                              setAssigningCardId(card.id);
                              setAssignmentDraft({
                                passiveId: assignment?.passiveId ?? "",
                                skillId: assignment?.skillId ?? "",
                                ultimateId: assignment?.ultimateId ?? "",
                              });
                            }}
                          />
                        </Pressable>
                      );
                    })
                  ) : (
                    <AdminEmptyState
                      icon="people"
                      title={t("admin.abilities.noCardsTitle")}
                      body={t("admin.abilities.noCardsBody")}
                    />
                  )}
                </View>
              </AdminPanel>
            )}
          </View>
        </Animated.View>
      </AdminPageScroll>

      <AdminModal
        visible={assigningCardId !== null}
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

          return (
            <View
              key={role}
              className="gap-[10] rounded-[20] bg-surface/82 p-[14]"
            >
              <Text className="font-nunito-extrabold text-sm text-primaryText">
                {t(`admin.abilities.type.${role.toUpperCase()}`)}
              </Text>
              <AdminButton
                label={t("admin.common.useDefault")}
                variant="ghost"
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
              {(abilitiesQuery.data?.abilities ?? [])
                .filter((ability) => ability.type === role.toUpperCase())
                .map((ability) => (
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
