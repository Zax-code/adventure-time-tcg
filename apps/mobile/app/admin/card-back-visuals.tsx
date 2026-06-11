import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  AdminCardBackVisual,
  AdminImageAssetsResponse,
} from "@adventure-time/api-client";

import { apiClient } from "../../src/lib/api";
import { getCatalogImageUrl } from "../../src/lib/catalog-images";
import {
  AdminButton,
  AdminEmptyState,
  AdminField,
  AdminHero,
  AdminLoadingState,
  AdminModal,
  AdminNotice,
  AdminPageScroll,
  AdminPanel,
  AdminSectionTitle,
  AdminStat,
} from "../../src/components/admin/admin-ui";
import { useTranslation } from "../../src/i18n";

const THEME_ORDER = ["candy", "ice", "nightosphere"] as const;
const RARITY_ORDER = ["Common", "Uncommon", "Rare", "Epic", "Legendary"] as const;
const EMPTY_VISUALS: AdminCardBackVisual[] = [];
const EMPTY_IMAGE_ASSETS: AdminImageAssetsResponse["imageAssets"] = [];

type ThemeName = (typeof THEME_ORDER)[number];
type RarityName = (typeof RARITY_ORDER)[number];

type Draft = {
  themeName: ThemeName;
  rarityName: RarityName;
  imageAssetId: string;
};

function parseError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function toDraft(visual: AdminCardBackVisual): Draft {
  return {
    themeName: visual.themeName,
    rarityName: visual.rarityName,
    imageAssetId: visual.imageAssetId ?? "",
  };
}

export default function AdminCardBackVisualsScreen() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [editingVisual, setEditingVisual] = useState<AdminCardBackVisual | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { data: visualsData, isLoading: isLoadingVisuals } = useQuery({
    queryKey: ["admin-card-back-visuals"],
    queryFn: () => apiClient.adminCardBackVisuals(),
  });

  const { data: imageAssetsData } = useQuery({
    queryKey: ["admin-image-assets"],
    queryFn: () => apiClient.adminImageAssets(),
  });

  const visuals = visualsData?.cardBackVisuals ?? EMPTY_VISUALS;
  const imageAssets = imageAssetsData?.imageAssets ?? EMPTY_IMAGE_ASSETS;
  const recentAssets = imageAssets.slice(0, 15);
  const assignedCount = visuals.filter((visual) => visual.imageAssetId).length;

  const visualsByTheme = useMemo(
    () =>
      THEME_ORDER.map((themeName) => ({
        themeName,
        visuals: RARITY_ORDER.map(
          (rarityName) =>
            visuals.find(
              (visual) =>
                visual.themeName === themeName && visual.rarityName === rarityName,
            ) ?? {
              themeName,
              rarityName,
              imageAssetId: null,
            },
        ),
      })),
    [visuals],
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!draft) {
        throw new Error("Missing draft");
      }

      return apiClient.upsertAdminCardBackVisual({
        themeName: draft.themeName,
        rarityName: draft.rarityName,
        imageAssetId: draft.imageAssetId.trim() || null,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-card-back-visuals"] });
      closeModal();
    },
    onError: (error) => {
      setSubmitError(parseError(error, t("admin.cardBackVisuals.couldNotSave")));
    },
  });

  function closeModal() {
    setEditingVisual(null);
    setDraft(null);
    setSubmitError(null);
  }

  function openModal(visual: AdminCardBackVisual) {
    setEditingVisual(visual);
    setDraft(toDraft(visual));
    setSubmitError(null);
  }

  return (
    <>
      <AdminPageScroll>
        <AdminHero
          title={t("admin.cardBackVisuals.title")}
          subtitle={t("admin.cardBackVisuals.subtitle")}
        >
          <View className="flex-row flex-wrap gap-3">
            <AdminStat
              label={t("admin.cardBackVisuals.mappedLabel")}
              value={String(assignedCount)}
              tone="accent"
            />
            <AdminStat
              label={t("admin.cardBackVisuals.totalLabel")}
              value={String(visuals.length)}
              tone="info"
            />
          </View>
        </AdminHero>

        {!isLoadingVisuals ? (
          <AdminNotice
            title={t("admin.cardBackVisuals.guidanceTitle")}
            body={t("admin.cardBackVisuals.guidanceBody")}
            tone="info"
            icon="copy-outline"
          />
        ) : null}

        {isLoadingVisuals ? (
          <AdminPanel>
            <AdminLoadingState
              title={t("admin.cardBackVisuals.loading")}
              body={t("common.loadingStates.adminBody")}
              icon="copy"
            />
          </AdminPanel>
        ) : visuals.length === 0 ? (
          <AdminPanel>
            <AdminEmptyState
              icon="copy"
              title={t("admin.cardBackVisuals.emptyTitle")}
              body={t("admin.cardBackVisuals.emptyBody")}
            />
          </AdminPanel>
        ) : (
          visualsByTheme.map((themeSection) => (
            <AdminPanel key={themeSection.themeName} tint="accent">
              <AdminSectionTitle
                title={t(`settings.themeNames.${themeSection.themeName}`)}
                subtitle={t("admin.cardBackVisuals.sectionSubtitle")}
              />
              <View className="mt-3 gap-3">
                {themeSection.visuals.map((visual) => (
                  <Pressable
                    key={`${visual.themeName}-${visual.rarityName}`}
                    className="gap-3 rounded-[24] border border-primaryBorder/20 bg-surfaceMuted p-[14]"
                    onPress={() => openModal(visual)}
                  >
                    {visual.imageAssetId ? (
                      <View className="overflow-hidden rounded-[18] border border-primaryBorder/20 bg-primaryTint/25">
                        <Image
                          source={{ uri: getCatalogImageUrl(visual.imageAssetId) }}
                          style={{ width: "100%", aspectRatio: 1024 / 1536 }}
                          contentFit="cover"
                        />
                      </View>
                    ) : null}
                    <View className="flex-row items-center justify-between gap-3">
                      <View className="gap-1">
                        <Text className="font-nunito-extrabold text-[15px] text-fg">
                          {visual.rarityName}
                        </Text>
                        <Text className="font-nunito-semibold text-[12px] text-fgMuted">
                          {visual.imageAssetId
                            ? t("admin.cardBackVisuals.assigned")
                            : t("admin.cardBackVisuals.usingDefault")}
                        </Text>
                      </View>
                      <AdminButton
                        label={t("admin.common.manage")}
                        variant="ghost"
                        onPress={() => openModal(visual)}
                      />
                    </View>
                  </Pressable>
                ))}
              </View>
            </AdminPanel>
          ))
        )}
      </AdminPageScroll>

      <AdminModal
        visible={draft !== null && editingVisual !== null}
        title={
          draft
            ? t("admin.cardBackVisuals.modalTitle", {
                theme: t(`settings.themeNames.${draft.themeName}`),
                rarity: draft.rarityName,
              })
            : t("admin.cardBackVisuals.title")
        }
        onClose={closeModal}
      >
        {draft ? (
          <>
            <AdminField
              label={t("admin.cardBackVisuals.assetId")}
              value={draft.imageAssetId}
              onChangeText={(value) =>
                setDraft((current) =>
                  current ? { ...current, imageAssetId: value } : current,
                )
              }
              placeholder={t("admin.cardBackVisuals.assetPlaceholder")}
            />
            <View className="gap-3 rounded-[24] border border-primaryBorder/20 bg-surfaceMuted p-[14]">
              <Text className="font-nunito-bold text-xs text-primaryText">
                {draft.imageAssetId
                  ? t("admin.cardBackVisuals.assigned")
                  : t("admin.cardBackVisuals.usingDefault")}
              </Text>
              {draft.imageAssetId ? (
                <View className="overflow-hidden rounded-[18] border border-primaryBorder/20 bg-primaryTint/25">
                  <Image
                    source={{ uri: getCatalogImageUrl(draft.imageAssetId) }}
                    style={{ width: "100%", aspectRatio: 1024 / 1536 }}
                    contentFit="cover"
                  />
                </View>
              ) : null}
              <AdminButton
                label={t("admin.common.useDefault")}
                variant="ghost"
                onPress={() =>
                  setDraft((current) =>
                    current ? { ...current, imageAssetId: "" } : current,
                  )
                }
              />
            </View>
            <View className="gap-3 rounded-[24] border border-primaryBorder/20 bg-surfaceMuted p-[14]">
              <View className="gap-1">
                <Text className="font-nunito-bold text-xs text-primaryText">
                  {t("admin.cardBackVisuals.recentArtShelf")}
                </Text>
                <Text className="font-nunito-semibold text-[12px] leading-[18px] text-fgMuted">
                  {t("admin.cardBackVisuals.recentArtSubtitle")}
                </Text>
              </View>
              <View className="flex-row flex-wrap gap-3">
                {recentAssets.map((asset: AdminImageAssetsResponse["imageAssets"][number]) => (
                  <Pressable
                    key={asset.id}
                    className="w-[88px] gap-2"
                    onPress={() =>
                      setDraft((current) =>
                        current ? { ...current, imageAssetId: asset.id } : current,
                      )
                    }
                  >
                    <View className="overflow-hidden rounded-[16] border border-primaryBorder/20 bg-primaryTint/25">
                      <Image
                        source={{ uri: getCatalogImageUrl(asset.id) }}
                        style={{ width: "100%", aspectRatio: 1024 / 1536 }}
                        contentFit="cover"
                      />
                    </View>
                    <Text
                      className="font-nunito-bold text-[10px] text-primaryStrong"
                      numberOfLines={2}
                    >
                      {asset.id}
                    </Text>
                  </Pressable>
                ))}
              </View>
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
                      : t("admin.cardBackVisuals.save")
                  }
                  icon="save"
                  onPress={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending}
                />
              </View>
            </View>
          </>
        ) : null}
      </AdminModal>
    </>
  );
}
