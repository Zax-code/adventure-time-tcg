import { useMemo } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { AdminImageAssetsResponse } from "@adventure-time/shared";

import { apiClient, API_BASE_URL } from "../../src/lib/api";
import {
  AdminButton,
  AdminChip,
  AdminEmptyState,
  AdminPageScroll,
  AdminPanel,
  AdminSectionTitle,
} from "../../src/components/admin/admin-ui";
import { useTranslation } from "../../src/i18n";

type AdminImageAsset = AdminImageAssetsResponse["imageAssets"][number];

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function resolvePreviewUrl(previewUrl: string) {
  if (previewUrl.startsWith("http://") || previewUrl.startsWith("https://")) {
    return previewUrl;
  }

  return `${API_BASE_URL}${previewUrl.startsWith("/") ? previewUrl : `/${previewUrl}`}`;
}

function formatUploadedAt(insertedAt: string) {
  const parsed = new Date(insertedAt);

  if (Number.isNaN(parsed.getTime())) {
    return insertedAt;
  }

  return parsed.toLocaleString();
}

export default function AdminImageAssetsScreen() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const imageAssetsQuery = useQuery({
    queryKey: ["admin-image-assets"],
    queryFn: () => apiClient.adminImageAssets(),
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.9,
      });

      if (result.canceled || !result.assets[0]) {
        return null;
      }

      const asset = result.assets[0];
      const filename = asset.fileName ?? `catalog-${Date.now()}.jpg`;
      const formData = new FormData();
      formData.append(
        "file",
        {
          uri: asset.uri,
          name: filename,
          type: asset.mimeType ?? "image/jpeg",
        } as never,
      );

      return apiClient.uploadAdminImageAsset(formData);
    },
    onSuccess: async (created) => {
      if (!created) {
        return;
      }

      await queryClient.invalidateQueries({ queryKey: ["admin-image-assets"] });
    },
    onError: (error) => {
      Alert.alert(
        t("admin.imageAssets.uploadFailed"),
        getErrorMessage(error, t("admin.imageAssets.uploadFailedBody")),
      );
    },
  });

  const imageAssets = imageAssetsQuery.data?.imageAssets ?? [];
  const imageAssetsError =
    imageAssetsQuery.error instanceof Error ? imageAssetsQuery.error.message : null;

  const recentAssets = useMemo(() => imageAssets.slice(0, 24), [imageAssets]);

  function renderAssetCard(asset: AdminImageAsset) {
    return (
      <View
        key={asset.id}
        className="gap-3 rounded-[22] border border-primaryBorder/20 bg-surfaceMuted p-[14]"
      >
        <View className="overflow-hidden rounded-[18] border border-primaryBorder/20 bg-primaryTint/35">
          <Image
            source={{ uri: resolvePreviewUrl(asset.previewUrl) }}
            style={{ width: "100%", aspectRatio: 1.2 }}
            contentFit="cover"
          />
        </View>
        <View className="gap-2">
          <View className="flex-row flex-wrap gap-2">
            <AdminChip label={t("admin.imageAssets.catalog")} tone="accent" />
            <AdminChip label={asset.mimeType} tone="info" />
          </View>
          <Text className="font-nunito-bold text-[12px] text-fgMuted">
            {t("admin.imageAssets.uploadedAt", {
              date: formatUploadedAt(asset.insertedAt),
            })}
          </Text>
          <Pressable onPress={() => Alert.alert(t("admin.imageAssets.assetIdTitle"), asset.id)}>
            <Text className="font-nunito-extrabold text-[12px] text-primaryStrong">
              {asset.id}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <AdminPageScroll>
      <AdminPanel>
        <AdminSectionTitle
          title={t("admin.imageAssets.title")}
          subtitle={t("admin.imageAssets.subtitle")}
          right={
            <AdminButton
              label={uploadMutation.isPending ? t("admin.common.uploading") : t("admin.common.upload")}
              icon="cloud-upload"
              onPress={() => uploadMutation.mutate()}
              disabled={uploadMutation.isPending}
            />
          }
        />
      </AdminPanel>

      <AdminPanel>
        <AdminSectionTitle title={t("admin.imageAssets.recentUploads", { count: imageAssets.length })} />
        <View className="mt-3 gap-3">
          {imageAssetsQuery.isLoading ? (
            <Text className="font-nunito-bold text-[13px] text-primaryText">{t("admin.imageAssets.loading")}</Text>
          ) : imageAssetsError ? (
            <Text className="font-nunito-bold text-[13px] text-dangerText">{imageAssetsError}</Text>
          ) : recentAssets.length ? (
            recentAssets.map(renderAssetCard)
          ) : (
            <AdminEmptyState
              icon="images"
              title={t("admin.imageAssets.emptyTitle")}
              body={t("admin.imageAssets.emptyBody")}
            />
          )}
        </View>
      </AdminPanel>
    </AdminPageScroll>
  );
}
