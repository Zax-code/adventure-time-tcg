import { ScrollView, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ZodError } from "zod";

import { AbilityEditorForm } from "../src/components/admin/ability-editor-sheet";
import { AdminBackground } from "../src/components/admin/admin-ui";
import { KEYBOARD_AWARE_SCROLL_PROPS } from "../src/components/keyboard-aware-scroll-props";
import { KeyboardScreenView } from "../src/components/keyboard-screen-view";
import { LoadingPanel } from "../src/components/loading-state";
import { ModalSheetRoute } from "../src/components/modal-sheet-route";
import { useTranslation } from "../src/i18n";
import { apiClient } from "../src/lib/api";
import { useSessionStore } from "../src/stores/session-store";
import { useThemeStore } from "../src/stores/theme-store";
import { THEME_COLORS, THEME_VARS } from "../src/theme/themes";

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

export default function AdminAbilityEditorScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { mode, abilityId } = useLocalSearchParams<{
    mode?: string;
    abilityId?: string;
  }>();
  const sessionHydrated = useSessionStore((state) => state.hydrated);
  const isAdmin = useSessionStore((state) => state.user?.isAdmin ?? false);
  const themeName = useThemeStore((state) => state.themeName);
  const tc = THEME_COLORS[themeName];
  const { t } = useTranslation();

  const isCreateMode = mode !== "edit";
  const closeEditor = () => router.dismissTo("/admin/abilities" as any);
  const canAccessAdmin = sessionHydrated && isAdmin;

  const { data: abilitiesQueryData, error: abilitiesQueryError, isLoading: abilitiesQueryIsLoading } = useQuery({
    queryKey: ["admin-abilities"],
    queryFn: () => apiClient.adminAbilities(),
    enabled: canAccessAdmin,
  });

  const createMutation = useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      apiClient.createAdminAbility(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-abilities"] });
      closeEditor();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: Record<string, unknown>;
    }) => apiClient.updateAdminAbility(id, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-abilities"] });
      closeEditor();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.deleteAdminAbility(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-abilities"] });
      closeEditor();
    },
  });

  const selectedAbility = isCreateMode
    ? null
    : (() => {
        const match = (abilitiesQueryData?.abilities ?? []).find(
          (ability) => ability.id === abilityId,
        );

        return match
          ? {
              id: match.id,
              key: match.key,
              name: match.name,
              description: match.description,
              type: match.type,
              cost: match.cost,
              cooldown: match.cooldown,
              oncePerMatch: match.oncePerMatch,
              payload: (match.payload ?? {}) as Record<string, unknown>,
            }
          : null;
      })();

  const queryError = formatAbilitiesError(
    abilitiesQueryError,
    t("admin.abilityEditor.invalidApiData", { details: "{details}" }),
  );

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
          ? t("admin.abilityEditor.createTitle")
          : t("admin.abilityEditor.editTitle")
      }
      subtitle={
        isCreateMode
          ? t("admin.abilityEditor.createSubtitle")
          : t("admin.abilityEditor.editSubtitle")
      }
    >
      <KeyboardScreenView>
        <AdminBackground>
          <View className="flex-1">
            {abilitiesQueryIsLoading && !isCreateMode ? (
              <View className="flex-1 items-center justify-center px-6">
                <LoadingPanel
                  title={t("admin.abilityEditor.loading")}
                  message={t("common.loadingStates.adminBody")}
                  icon="flash"
                />
              </View>
            ) : queryError ? (
              <View className="flex-1 items-center justify-center px-6">
                <Text className="font-nunito-bold text-[15px] text-dangerText text-center">
                  {queryError}
                </Text>
              </View>
            ) : !isCreateMode && !selectedAbility ? (
              <View className="flex-1 items-center justify-center px-6">
                <Text className="font-nunito-bold text-[15px] text-dangerText text-center">
                  {t("admin.abilityEditor.notFound")}
                </Text>
              </View>
            ) : (
              <ScrollView
                {...KEYBOARD_AWARE_SCROLL_PROPS}
                className="flex-1"
                contentInset={{ bottom: insets.bottom + 20 }}
                scrollIndicatorInsets={{ bottom: insets.bottom + 20 }}
                contentContainerStyle={{
                  gap: 14,
                  paddingHorizontal: 16,
                  paddingTop: 8,
                  paddingBottom: 20,
                }}
                showsVerticalScrollIndicator={false}
              >
                <AbilityEditorForm
                  key={selectedAbility?.id ?? "create"}
                  ability={selectedAbility}
                  saving={
                    createMutation.isPending ||
                    updateMutation.isPending ||
                    deleteMutation.isPending
                  }
                  onDelete={async (id) => {
                    await deleteMutation.mutateAsync(id);
                  }}
                  onSubmit={async (input) => {
                    if (selectedAbility) {
                      await updateMutation.mutateAsync({
                        id: selectedAbility.id,
                        input,
                      });
                      return;
                    }

                    await createMutation.mutateAsync(input);
                  }}
                />
              </ScrollView>
            )}
          </View>
        </AdminBackground>
      </KeyboardScreenView>
    </ModalSheetRoute>
  );
}
