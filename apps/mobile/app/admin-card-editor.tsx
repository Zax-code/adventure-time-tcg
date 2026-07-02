import { useEffect, useRef, useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  CardEditorSheet,
} from "../src/components/admin/card-editor-sheet";
import {
  BLANK_CARD_DRAFT,
  type AssignmentDraft,
  type CardDraft,
  toCardDraft,
  toCardSavePayload,
} from "../src/components/admin/card-editor-draft";
import {
  AdminBackground,
  AdminButton,
} from "../src/components/admin/admin-ui";
import { KEYBOARD_AWARE_SCROLL_PROPS } from "../src/components/keyboard-aware-scroll-props";
import { KeyboardScreenView } from "../src/components/keyboard-screen-view";
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

function rarityAllowsPassiveSlot(
  rarities: Array<{ id: string; name: string }>,
  rarityId: string,
) {
  return (
    rarities.find((rarity) => rarity.id === rarityId)?.name === "Legendary"
  );
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
  const footerBottomPadding = insets.bottom + 16;
  const scrollBottomPadding = footerBottomPadding + (isCreateMode ? 84 : 140);
  const footerButtonRadius = 12;

  const [draft, setDraft] = useState<CardDraft>(BLANK_CARD_DRAFT);
  const [assignmentDraft, setAssignmentDraft] = useState<AssignmentDraft>(
    EMPTY_ASSIGNMENT_DRAFT,
  );
  const initializedCardIdRef = useRef<string | null>(null);
  const initializedCreateRef = useRef(false);
  const closeEditor = () => router.dismissTo("/admin/cards" as any);

  const { data: cardQueryData, error: cardQueryError, isLoading: cardQueryIsLoading } = useQuery({
    queryKey: ["admin-card", cardId],
    queryFn: () => apiClient.adminCard(cardId!),
    enabled: canLoadCard,
  });
  const { data: raritiesQueryData, error: raritiesQueryError, isLoading: raritiesQueryIsLoading } = useQuery({
    queryKey: ["admin-rarities"],
    queryFn: () => apiClient.rarities(),
    enabled: canAccessAdmin,
  });
  const { data: abilitiesQueryData, error: abilitiesQueryError, isLoading: abilitiesQueryIsLoading } = useQuery({
    queryKey: ["admin-abilities"],
    queryFn: () => apiClient.adminAbilities(),
    enabled: canAccessAdmin,
  });
  const selectedRarity = raritiesQueryData?.rarities.find(
    (rarity) => rarity.id === draft.rarityId,
  );
  const allowsPassiveSlot = selectedRarity?.name === "Legendary";

  useEffect(() => {
    if (isCreateMode) {
      if (initializedCreateRef.current) {
        return;
      }

      const defaultRarityId = raritiesQueryData?.rarities[0]?.id;
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

    if (!cardQueryData) {
      return;
    }

    if (initializedCardIdRef.current === cardQueryData.id) {
      return;
    }

    initializedCardIdRef.current = cardQueryData.id;
    setDraft(toCardDraft(cardQueryData));
    const currentAssignment = abilitiesQueryData?.cardAbilities.find(
      (entry) => entry.cardId === cardQueryData?.id,
    );
    const cardAllowsPassiveSlot = cardQueryData.rarityName === "Legendary";
    setAssignmentDraft({
      passiveId: cardAllowsPassiveSlot
        ? (currentAssignment?.passiveId ?? "")
        : "",
      skillId: currentAssignment?.skillId ?? "",
      ultimateId: currentAssignment?.ultimateId ?? "",
    });
  }, [
    abilitiesQueryData?.cardAbilities,
    cardQueryData,
    isCreateMode,
    raritiesQueryData?.rarities,
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
          passiveId: allowsPassiveSlot
            ? assignmentDraft.passiveId || null
            : null,
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
      if (!cardQueryData) {
        throw new Error(t("admin.cardEditor.cardNotLoaded"));
      }

      return apiClient.updateAdminCard(cardQueryData.id, {
        isArchived: !cardQueryData.isArchived,
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
    (!isCreateMode && cardQueryIsLoading) ||
    raritiesQueryIsLoading ||
    abilitiesQueryIsLoading;
  const error = cardQueryError || raritiesQueryError || abilitiesQueryError;

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
    >
      <KeyboardScreenView>
        <AdminBackground>
          <View className="flex-1">
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
            ) : !isCreateMode && !cardQueryData ? (
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
                    paddingBottom: scrollBottomPadding,
                    gap: 16,
                  }}
                  showsVerticalScrollIndicator={false}
                >
                  <CardEditorSheet
                    card={cardQueryData ?? null}
                    draft={draft}
                    rarities={raritiesQueryData?.rarities ?? []}
                    abilities={abilitiesQueryData?.abilities ?? []}
                    assignmentDraft={assignmentDraft}
                    uploadPending={uploadMutation.isPending}
                    onUploadImage={() => uploadMutation.mutate()}
                    onDraftChange={(key, value) => {
                      setDraft((current) => ({ ...current, [key]: value }));
                      if (
                        key === "rarityId" &&
                        !rarityAllowsPassiveSlot(
                          raritiesQueryData?.rarities ?? [],
                          value,
                        )
                      ) {
                        setAssignmentDraft((current) => ({
                          ...current,
                          passiveId: "",
                        }));
                      }
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
                  className="absolute inset-x-0 bottom-0 px-4 pt-3"
                  style={{ paddingBottom: footerBottomPadding }}
                >
                  <View className={isCreateMode ? "gap-3" : "flex-row gap-3"}>
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
                      borderRadius={footerButtonRadius}
                      style={isCreateMode ? { width: "100%" } : { flex: 1 }}
                    />
                    {!isCreateMode && cardQueryData ? (
                      <AdminButton
                        label={
                          archiveMutation.isPending
                            ? t("admin.common.saving")
                            : cardQueryData.isArchived
                              ? t("admin.cardEditor.restoreCard")
                              : t("admin.cardEditor.archiveCard")
                        }
                        variant="danger"
                        onPress={() => archiveMutation.mutate()}
                        disabled={archiveMutation.isPending}
                        borderRadius={footerButtonRadius}
                        style={{ flex: 1 }}
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
