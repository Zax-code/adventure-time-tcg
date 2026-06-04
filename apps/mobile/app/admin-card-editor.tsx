import { useEffect, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  BLANK_CARD_DRAFT,
  CardEditorSheet,
  type AssignmentDraft,
  type CardDraft,
  toCardDraft,
  toCardSavePayload,
} from "../src/components/admin/card-editor-sheet";
import {
  AdminBackground,
  AdminButton,
  AdminTopBar,
} from "../src/components/admin/admin-ui";
import {
  KEYBOARD_AWARE_SCROLL_PROPS,
  KeyboardScreenView,
} from "../src/components/keyboard-screen-view";
import { LoadingPanel } from "../src/components/loading-state";
import { ModalSheetRoute } from "../src/components/modal-sheet-route";
import { apiClient } from "../src/lib/api";
import { useTranslation } from "../src/i18n";
import { useSessionStore } from "../src/stores/session-store";
import { useThemeStore } from "../src/stores/theme-store";
import { THEME_COLORS, THEME_VARS } from "../src/theme/themes";

const EMPTY_ASSIGNMENT_DRAFT: AssignmentDraft = {
  passiveId: "",
  skillId: "",
  ultimateId: "",
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function AdminCardEditorScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const sessionHydrated = useSessionStore((state) => state.hydrated);
  const isAdmin = useSessionStore((state) => state.user?.isAdmin ?? false);
  const themeName = useThemeStore((state) => state.themeName);
  const tc = THEME_COLORS[themeName];
  const { t } = useTranslation();
  const { mode, cardId } = useLocalSearchParams<{
    mode?: string;
    cardId?: string;
  }>();
  const isCreateMode = mode !== "edit";
  const canAccessAdmin = sessionHydrated && isAdmin;
  const canLoadCard = canAccessAdmin && !isCreateMode && Boolean(cardId);

  const [draft, setDraft] = useState<CardDraft>(BLANK_CARD_DRAFT);
  const [assignmentDraft, setAssignmentDraft] = useState<AssignmentDraft>(
    EMPTY_ASSIGNMENT_DRAFT,
  );
  const initializedCardIdRef = useRef<string | null>(null);
  const initializedCreateRef = useRef(false);
  const closeEditor = () => router.dismissTo("/admin/cards" as any);

  const cardQuery = useQuery({
    queryKey: ["admin-card", cardId],
    queryFn: () => apiClient.adminCard(cardId!),
    enabled: canLoadCard,
  });
  const raritiesQuery = useQuery({
    queryKey: ["admin-rarities"],
    queryFn: () => apiClient.rarities(),
    enabled: canAccessAdmin,
  });
  const abilitiesQuery = useQuery({
    queryKey: ["admin-abilities"],
    queryFn: () => apiClient.adminAbilities(),
    enabled: canAccessAdmin,
  });

  useEffect(() => {
    if (isCreateMode) {
      if (initializedCreateRef.current) {
        return;
      }

      const defaultRarityId = raritiesQuery.data?.rarities[0]?.id;
      if (!defaultRarityId) {
        return;
      }

      initializedCreateRef.current = true;
      setDraft((current) => ({
        ...current,
        rarityId: current.rarityId || defaultRarityId,
      }));
      setAssignmentDraft(EMPTY_ASSIGNMENT_DRAFT);
      return;
    }

    if (!cardQuery.data) {
      return;
    }

    if (initializedCardIdRef.current === cardQuery.data.id) {
      return;
    }

    initializedCardIdRef.current = cardQuery.data.id;
    setDraft(toCardDraft(cardQuery.data));
    const currentAssignment = abilitiesQuery.data?.cardAbilities.find(
      (entry) => entry.cardId === cardQuery.data?.id,
    );
    setAssignmentDraft({
      passiveId: currentAssignment?.passiveId ?? "",
      skillId: currentAssignment?.skillId ?? "",
      ultimateId: currentAssignment?.ultimateId ?? "",
    });
  }, [
    abilitiesQuery.data?.cardAbilities,
    cardQuery.data,
    isCreateMode,
    raritiesQuery.data?.rarities,
  ]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = toCardSavePayload(draft);
      const savedCard = isCreateMode
        ? await apiClient.createAdminCard(payload)
        : await apiClient.saveAdminCard(cardId!, payload);

      const savedCardId = isCreateMode
        ? typeof savedCard.id === "string"
          ? savedCard.id
          : null
        : (cardId ?? null);

      if (!savedCardId) {
        throw new Error(t("admin.cardEditor.missingCardId"));
      }

      const shouldPersistAssignments =
        !isCreateMode ||
        Boolean(
          assignmentDraft.passiveId ||
          assignmentDraft.skillId ||
          assignmentDraft.ultimateId,
        );

      if (shouldPersistAssignments) {
        await apiClient.assignAdminCardAbility({
          cardId: savedCardId,
          passiveId: assignmentDraft.passiveId || null,
          skillId: assignmentDraft.skillId || null,
          ultimateId: assignmentDraft.ultimateId || null,
        });
      }
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-cards"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-card", cardId] }),
        queryClient.invalidateQueries({ queryKey: ["admin-abilities"] }),
      ]);
      closeEditor();
    },
    onError: (error) => {
      Alert.alert(
        t("admin.cardEditor.saveFailed"),
        getErrorMessage(error, t("admin.cardEditor.saveFailedBody")),
      );
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async () => {
      if (!cardQuery.data) {
        throw new Error(t("admin.cardEditor.cardNotLoaded"));
      }

      return apiClient.updateAdminCard(cardQuery.data.id, {
        isArchived: !cardQuery.data.isArchived,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-cards"] });
      closeEditor();
    },
    onError: (error) => {
      Alert.alert(
        t("admin.cardEditor.updateFailed"),
        getErrorMessage(error, t("admin.cardEditor.updateFailedBody")),
      );
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!cardId) {
        throw new Error(t("admin.cardEditor.saveBeforeUpload"));
      }

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
      formData.append("file", {
        uri: asset.uri,
        name: "card.jpg",
        type: asset.mimeType ?? "image/jpeg",
      } as never);

      await apiClient.uploadAdminCardImage(cardId, formData);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-cards"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-card", cardId] }),
      ]);
    },
    onError: (error) => {
      Alert.alert(
        t("admin.cardEditor.uploadFailed"),
        getErrorMessage(error, t("admin.cardEditor.uploadFailedBody")),
      );
    },
  });

  const loading =
    (!isCreateMode && cardQuery.isLoading) ||
    raritiesQuery.isLoading ||
    abilitiesQuery.isLoading;
  const error = cardQuery.error || raritiesQuery.error || abilitiesQuery.error;

  if (!sessionHydrated) {
    return null;
  }

  if (!isAdmin) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <ModalSheetRoute
      onClose={closeEditor}
      sheetBackgroundColor={tc.bg}
      handleColor={tc.primaryBorder}
      sheetStyle={THEME_VARS[themeName]}
    >
      <KeyboardScreenView>
        <AdminBackground>
          <View className="flex-1">
            <View className="items-center px-4 pt-2">
              <View className="h-1 w-9 rounded-full bg-primaryBorder" />
            </View>

            <View className="px-4">
              <AdminTopBar
                title={
                  isCreateMode
                    ? t("admin.cardEditor.createTitle")
                    : t("admin.cardEditor.editTitle")
                }
                subtitle={
                  isCreateMode
                    ? t("admin.cardEditor.createSubtitle")
                    : t("admin.cardEditor.editSubtitle")
                }
                right={
                  <Pressable
                    className="rounded-full px-3 py-2"
                    onPress={closeEditor}
                  >
                    <Text className="font-nunito-bold text-sm text-primaryStrong">
                      {t("admin.common.close")}
                    </Text>
                  </Pressable>
                }
              />
            </View>

            {loading ? (
              <View className="flex-1 items-center justify-center px-6">
                <LoadingPanel
                  title={t("admin.cardEditor.loading")}
                  message={t("common.loadingStates.adminBody")}
                  icon="albums"
                />
              </View>
            ) : error ? (
              <View className="flex-1 items-center justify-center px-6">
                <Text className="font-nunito-bold text-[15px] text-dangerText text-center">
                  {getErrorMessage(error, t("admin.cardEditor.loadFailed"))}
                </Text>
              </View>
            ) : !isCreateMode && !cardQuery.data ? (
              <View className="flex-1 items-center justify-center px-6">
                <Text className="font-nunito-bold text-[15px] text-dangerText text-center">
                  {t("admin.cardEditor.notFound")}
                </Text>
              </View>
            ) : (
              <View className="flex-1">
                <ScrollView
                  {...KEYBOARD_AWARE_SCROLL_PROPS}
                  className="flex-1"
                  contentContainerStyle={{
                    paddingHorizontal: 16,
                    paddingTop: 14,
                    paddingBottom: 24,
                    gap: 16,
                  }}
                  showsVerticalScrollIndicator={false}
                >
                  <CardEditorSheet
                    card={cardQuery.data ?? null}
                    draft={draft}
                    rarities={raritiesQuery.data?.rarities ?? []}
                    abilities={abilitiesQuery.data?.abilities ?? []}
                    assignmentDraft={assignmentDraft}
                    uploadPending={uploadMutation.isPending}
                    onUploadImage={() => uploadMutation.mutate()}
                    onDraftChange={(key, value) => {
                      setDraft((current) => ({ ...current, [key]: value }));
                    }}
                    onAssignmentChange={(role, value) => {
                      setAssignmentDraft(
                        (current) =>
                          ({
                            ...current,
                            [`${role}Id`]: value,
                          }) as AssignmentDraft,
                      );
                    }}
                    onAssignmentClear={() =>
                      setAssignmentDraft(EMPTY_ASSIGNMENT_DRAFT)
                    }
                  />
                </ScrollView>

                <View
                  className="border-t border-primaryBorder bg-surface px-4 pt-3"
                  style={{ paddingBottom: insets.bottom + 16 }}
                >
                  <View className="gap-3">
                    <AdminButton
                      label={
                        saveMutation.isPending
                          ? t("admin.common.saving")
                          : isCreateMode
                            ? t("admin.cards.createCard")
                            : t("admin.cardEditor.saveCard")
                      }
                      onPress={() => saveMutation.mutate()}
                      disabled={saveMutation.isPending || !draft.rarityId}
                      style={{ width: "100%" }}
                    />
                    {!isCreateMode && cardQuery.data ? (
                      <AdminButton
                        label={
                          archiveMutation.isPending
                            ? t("admin.common.saving")
                            : cardQuery.data.isArchived
                              ? t("admin.cardEditor.restoreCard")
                              : t("admin.cardEditor.archiveCard")
                        }
                        variant="danger"
                        onPress={() => archiveMutation.mutate()}
                        disabled={archiveMutation.isPending}
                        style={{ width: "100%" }}
                      />
                    ) : null}
                  </View>
                </View>
              </View>
            )}
          </View>
        </AdminBackground>
      </KeyboardScreenView>
    </ModalSheetRoute>
  );
}
