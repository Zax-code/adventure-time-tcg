import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { AdminPacksResponse } from "@adventure-time/api-client";

import { apiClient } from "../../src/lib/api";
import {
  AdminButton,
  AdminChip,
  AdminEmptyState,
  AdminField,
  AdminHero,
  AdminLoadingState,
  AdminModal,
  AdminNotice,
  AdminPageScroll,
  AdminPanel,
  AdminSearchInput,
  AdminSectionTitle,
  AdminSegmentedControl,
  AdminStat,
} from "../../src/components/admin/admin-ui";
import { useTranslation } from "../../src/i18n";

type AdminPack = AdminPacksResponse["packs"][number];

type PackDraft = {
  name: string;
  description: string;
  cardCount: string;
  cost: string;
  color: string;
  guaranteedRarity: string;
  isActive: boolean;
};

const BLANK_DRAFT: PackDraft = {
  name: "",
  description: "",
  cardCount: "5",
  cost: "100",
  color: "#F59E0B",
  guaranteedRarity: "",
  isActive: true,
};

function toDraft(pack: AdminPack): PackDraft {
  return {
    name: pack.name,
    description: pack.description,
    cardCount: String(pack.cardCount),
    cost: String(pack.cost),
    color: pack.color,
    guaranteedRarity: pack.guaranteedRarity ?? "",
    isActive: pack.isActive,
  };
}

function parseError(error: unknown, fallback: string) {
  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

function toPayload(draft: PackDraft) {
  return {
    name: draft.name.trim(),
    description: draft.description.trim(),
    cardCount: Number(draft.cardCount),
    cost: Number(draft.cost),
    color: draft.color.trim(),
    guaranteedRarity: draft.guaranteedRarity.trim() || null,
    isActive: draft.isActive,
  };
}

export default function AdminPacksScreen() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [editingPackId, setEditingPackId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PackDraft>(BLANK_DRAFT);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const packsQuery = useQuery({
    queryKey: ["admin-packs"],
    queryFn: () => apiClient.adminPacks(),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = toPayload(draft);

      if (modalMode === "edit" && editingPackId) {
        return apiClient.updateAdminPack(editingPackId, payload);
      }

      return apiClient.createAdminPack(payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-packs"] });
      closeModal();
    },
    onError: (error) => {
      setSubmitError(parseError(error, t("admin.packs.couldNotSave")));
    },
  });

  const packs = packsQuery.data?.packs ?? [];
  const packsError =
    packsQuery.error instanceof Error ? packsQuery.error.message : null;

  const filteredPacks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return packs.filter((pack) => {
      if (!query) {
        return true;
      }

      return `${pack.name} ${pack.description} ${pack.guaranteedRarity ?? ""}`
        .toLowerCase()
        .includes(query);
    });
  }, [packs, searchQuery]);

  const activePacks = filteredPacks.filter((pack) => pack.isActive);
  const inactivePacks = filteredPacks.filter((pack) => !pack.isActive);

  function closeModal() {
    setModalMode(null);
    setEditingPackId(null);
    setDraft(BLANK_DRAFT);
    setSubmitError(null);
  }

  function openCreateModal() {
    setModalMode("create");
    setEditingPackId(null);
    setDraft(BLANK_DRAFT);
    setSubmitError(null);
  }

  function openEditModal(pack: AdminPack) {
    setModalMode("edit");
    setEditingPackId(pack.id);
    setDraft(toDraft(pack));
    setSubmitError(null);
  }

  function renderPackCard(pack: AdminPack) {
    return (
      <Pressable
        key={pack.id}
        className="gap-3 rounded-[24] border border-primaryBorder/20 bg-surfaceMuted p-[16]"
        onPress={() => openEditModal(pack)}
      >
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1 gap-1">
            <Text className="font-nunito-extrabold text-[16px] text-fg">
              {pack.name}
            </Text>
            <Text className="font-nunito-semibold text-[13px] leading-[19px] text-fgMuted">
              {pack.description}
            </Text>
          </View>
          <View
            className="h-12 w-12 rounded-[18] border border-white/50"
            style={{ backgroundColor: pack.color }}
          />
        </View>
        <View className="flex-row flex-wrap gap-2">
          <AdminChip
            label={t("admin.common.cardsCount", { count: pack.cardCount })}
            tone="success"
          />
          <AdminChip
            label={t("admin.common.coinsCount", { count: pack.cost })}
            tone="warning"
          />
          <AdminChip
            label={
              pack.isActive
                ? t("admin.common.active")
                : t("admin.common.inactive")
            }
            tone={pack.isActive ? "info" : "default"}
          />
          {pack.guaranteedRarity ? (
            <AdminChip
              label={t("admin.packs.guaranteed", {
                rarity: pack.guaranteedRarity,
              })}
              tone="accent"
            />
          ) : null}
        </View>
        <AdminButton
          label={t("admin.packs.editPack")}
          variant="ghost"
          onPress={() => openEditModal(pack)}
        />
      </Pressable>
    );
  }

  return (
    <>
      <AdminPageScroll>
        <AdminHero
          badge={t("admin.shell.nav.packs")}
          title={t("admin.packs.title")}
          subtitle={t("admin.packs.subtitle")}
          actions={
            <AdminButton
              label={t("admin.packs.create")}
              icon="add"
              onPress={openCreateModal}
            />
          }
        >
          <View className="flex-row flex-wrap gap-3">
            <AdminStat
              label={t("admin.packs.activeLabel")}
              value={String(activePacks.length)}
              tone="success"
            />
            <AdminStat
              label={t("admin.packs.inactiveLabel")}
              value={String(inactivePacks.length)}
              tone="warning"
            />
          </View>
          <AdminSearchInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t("admin.packs.searchPlaceholder")}
          />
        </AdminHero>

        {!packsError && !packsQuery.isLoading ? (
          <AdminNotice
            title={t("admin.packs.guidanceTitle")}
            body={t("admin.packs.guidanceBody")}
            tone="info"
            icon="pricetag-outline"
          />
        ) : null}

        <AdminPanel tint="accent">
          <AdminSectionTitle
            title={t("admin.packs.activeTitle", { count: activePacks.length })}
            subtitle={t("admin.packs.activeSubtitle")}
          />
          <View className="mt-3 gap-3">
            {packsQuery.isLoading ? (
              <AdminLoadingState
                title={t("admin.packs.loading")}
                body={t("common.loadingStates.adminBody")}
                icon="cube"
              />
            ) : packsError ? (
              <Text className="font-nunito-bold text-[13px] text-dangerText">
                {packsError}
              </Text>
            ) : activePacks.length ? (
              activePacks.map(renderPackCard)
            ) : (
              <AdminEmptyState
                icon="cube"
                title={t("admin.packs.noActiveTitle")}
                body={t("admin.packs.noActiveBody")}
              />
            )}
          </View>
        </AdminPanel>

        <AdminPanel tint="secondary">
          <AdminSectionTitle
            title={t("admin.packs.inactiveTitle", {
              count: inactivePacks.length,
            })}
            subtitle={t("admin.packs.inactiveSubtitle")}
          />
          <View className="mt-3 gap-3">
            {packsQuery.isLoading ? (
              <AdminLoadingState
                title={t("admin.packs.loading")}
                body={t("common.loadingStates.adminBody")}
                icon="cube-outline"
              />
            ) : packsError ? (
              <Text className="font-nunito-bold text-[13px] text-dangerText">
                {packsError}
              </Text>
            ) : inactivePacks.length ? (
              inactivePacks.map(renderPackCard)
            ) : (
              <AdminEmptyState
                icon="archive"
                title={t("admin.packs.noInactiveTitle")}
                body={t("admin.packs.noInactiveBody")}
              />
            )}
          </View>
        </AdminPanel>
      </AdminPageScroll>

      <AdminModal
        visible={modalMode !== null}
        title={
          modalMode === "edit"
            ? t("admin.packs.modalTitleEdit")
            : t("admin.packs.modalTitleCreate")
        }
        onClose={closeModal}
      >
        <AdminField
          label={t("admin.packs.name")}
          value={draft.name}
          onChangeText={(value) =>
            setDraft((current) => ({ ...current, name: value }))
          }
          placeholder={t("admin.packs.namePlaceholder")}
        />
        <AdminField
          label={t("admin.packs.description")}
          value={draft.description}
          onChangeText={(value) =>
            setDraft((current) => ({ ...current, description: value }))
          }
          placeholder={t("admin.packs.descriptionPlaceholder")}
          multiline
        />
        <View className="flex-row gap-3">
          <View className="flex-1">
            <AdminField
              label={t("admin.packs.cardCount")}
              value={draft.cardCount}
              onChangeText={(value) =>
                setDraft((current) => ({ ...current, cardCount: value }))
              }
              keyboardType="numeric"
            />
          </View>
          <View className="flex-1">
            <AdminField
              label={t("admin.packs.cost")}
              value={draft.cost}
              onChangeText={(value) =>
                setDraft((current) => ({ ...current, cost: value }))
              }
              keyboardType="numeric"
            />
          </View>
        </View>
        <AdminField
          label={t("admin.packs.accentColor")}
          value={draft.color}
          onChangeText={(value) =>
            setDraft((current) => ({ ...current, color: value }))
          }
          placeholder="#F59E0B"
        />
        <AdminField
          label={t("admin.packs.guaranteedRarity")}
          value={draft.guaranteedRarity}
          onChangeText={(value) =>
            setDraft((current) => ({ ...current, guaranteedRarity: value }))
          }
          placeholder={t("admin.packs.blankRarity")}
        />
        <View className="gap-[6]">
          <Text className="font-nunito-bold text-xs text-primaryText">
            {t("admin.packs.availability")}
          </Text>
          <AdminSegmentedControl
            value={draft.isActive ? "active" : "inactive"}
            options={[
              { label: t("admin.common.active"), value: "active" },
              { label: t("admin.common.inactive"), value: "inactive" },
            ]}
            onChange={(value) =>
              setDraft((current) => ({
                ...current,
                isActive: value === "active",
              }))
            }
          />
        </View>
        {submitError ? (
          <Text className="font-nunito-bold text-[13px] text-dangerText">
            {submitError}
          </Text>
        ) : null}
        <View className="flex-row gap-3">
          <View className="flex-1">
            <AdminButton
              label={t("common.cancel")}
              variant="ghost"
              onPress={closeModal}
            />
          </View>
          <View className="flex-1">
            <AdminButton
              label={
                saveMutation.isPending
                  ? t("admin.common.saving")
                  : modalMode === "edit"
                    ? t("admin.packs.savePack")
                    : t("admin.packs.createPack")
              }
              icon={modalMode === "edit" ? "save" : "add"}
              onPress={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            />
          </View>
        </View>
      </AdminModal>
    </>
  );
}
