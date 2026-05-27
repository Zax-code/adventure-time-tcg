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
  AdminLoadingState,
  AdminModal,
  AdminPageScroll,
  AdminPanel,
  AdminSearchInput,
  AdminSectionTitle,
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
  const [activeTab, setActiveTab] = useState<"abilities" | "assignments">("abilities");
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "PASSIVE" | "SKILL" | "ULTIMATE">("all");
  const [assigningCardId, setAssigningCardId] = useState<string | null>(null);
  const [assignmentDraft, setAssignmentDraft] = useState({ passiveId: "", skillId: "", ultimateId: "" });

  const abilitiesQuery = useQuery({ queryKey: ["admin-abilities"], queryFn: () => apiClient.adminAbilities() });
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
          <AdminSectionTitle title={t("admin.abilities.title")} subtitle={t("admin.abilities.subtitle")} />
          <View className="h-3" />
          <View className="flex-row gap-2">
            <Pressable
              className={`flex-1 py-[10] rounded-[14] items-center ${activeTab === "abilities" ? "bg-primaryText" : "bg-surface/78"}`}
              onPress={() => setActiveTab("abilities")}
            >
                <Text className={`font-nunito-extrabold ${activeTab === "abilities" ? "text-white" : "text-primaryText"}`}>{t("admin.abilities.tabAbilities")}</Text>
            </Pressable>
            <Pressable
              className={`flex-1 py-[10] rounded-[14] items-center ${activeTab === "assignments" ? "bg-primaryText" : "bg-surface/78"}`}
              onPress={() => setActiveTab("assignments")}
            >
                <Text className={`font-nunito-extrabold ${activeTab === "assignments" ? "text-white" : "text-primaryText"}`}>{t("admin.abilities.tabAssignments")}</Text>
            </Pressable>
          </View>
          <View className="h-3" />
          <AdminSearchInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={activeTab === "abilities" ? t("admin.abilities.searchAbilities") : t("admin.abilities.searchCards")}
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
                      <Text className={`font-nunito-bold text-xs ${active ? "text-primaryStrong" : "text-primaryText"}`}>{type === "all" ? t("collection.all") : t(`admin.abilities.type.${type}`)}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
          {activeTab === "abilities" ? <AdminButton label={t("admin.abilities.createAbility")} icon="add" onPress={() => router.push({ pathname: "/admin-ability-editor", params: { mode: "create" } } as any)} /> : null}
        </AdminPanel>

        {activeTab === "abilities" ? (
          <AdminPanel>
            <AdminSectionTitle title={t("admin.abilities.libraryTitle", { count: filteredAbilities.length })} />
            <View className="mt-3 gap-3">
              {isAbilitiesLoading ? (
                <AdminLoadingState
                  title={t("admin.abilities.loadingAbilities")}
                  body={t("common.loadingStates.adminBody")}
                  icon="flash"
                />
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
                      <AdminChip label={t("admin.abilities.costLabel", { cost: ability.cost })} tone="info" />
                      {ability.cooldown ? <AdminChip label={t("admin.abilities.cooldownLabel", { count: ability.cooldown })} tone="warning" /> : null}
                      {ability.oncePerMatch ? <AdminChip label={t("admin.abilities.oncePerMatchShort")} tone="success" /> : null}
                    </View>
                    <Text className="font-nunito-semibold text-[13px] text-fgMuted">{ability.description}</Text>
                    <View className="flex-row gap-2">
                      <AdminButton label={t("admin.common.edit")} variant="ghost" onPress={() => router.push({ pathname: "/admin-ability-editor", params: { mode: "edit", abilityId: ability.id } } as any)} />
                      <AdminButton label={t("admin.common.delete")} variant="danger" onPress={() => deleteMutation.mutate(ability.id)} />
                    </View>
                  </Pressable>
                ))
              ) : (
                <AdminEmptyState icon="flash" title={t("admin.abilities.noAbilitiesTitle")} body={t("admin.abilities.noAbilitiesBody")} />
              )}
            </View>
          </AdminPanel>
        ) : (
          <AdminPanel>
            <AdminSectionTitle title={t("admin.abilities.assignmentsTitle", { count: filteredCards.length })} />
            <View className="mt-3 gap-3">
              {isAbilitiesLoading ? (
                <AdminLoadingState
                  title={t("admin.abilities.loadingAssignments")}
                  body={t("common.loadingStates.adminBody")}
                  icon="git-network"
                />
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
                        <AdminChip label={t("admin.abilities.passiveLabel", { name: passive?.name ?? t("admin.common.default") })} tone="success" />
                        <AdminChip label={t("admin.abilities.skillLabel", { name: skill?.name ?? t("admin.common.default") })} tone="info" />
                        <AdminChip label={t("admin.abilities.ultimateLabel", { name: ultimate?.name ?? t("admin.common.default") })} tone="warning" />
                      </View>
                      <AdminButton label={t("admin.common.manage")} variant="ghost" onPress={() => {
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
                <AdminEmptyState icon="people" title={t("admin.abilities.noCardsTitle")} body={t("admin.abilities.noCardsBody")} />
              )}
            </View>
          </AdminPanel>
        )}
      </AdminPageScroll>
      <AdminModal visible={assigningCardId !== null} title={t("admin.abilities.assignTitle")} onClose={() => setAssigningCardId(null)}>
        {(["passive", "skill", "ultimate"] as const).map((role) => {
          const selectedId = assignmentDraft[`${role}Id` as const];
          return (
            <View key={role} className="gap-[10] rounded-[20] p-[14] bg-surface/82">
               <Text className="font-nunito-extrabold text-sm text-primaryText">{t(`admin.abilities.type.${role.toUpperCase()}`)}</Text>
              <AdminButton
                 label={t("admin.common.useDefault")}
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
