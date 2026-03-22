import { ScrollView, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ZodError } from "zod";

import { AbilityEditorForm } from "../src/components/admin/ability-editor-sheet";
import { apiClient } from "../src/lib/api";
import { useThemeStore } from "../src/stores/theme-store";
import { THEME_VARS } from "../src/theme/themes";

function formatAbilitiesError(error: unknown) {
  if (error instanceof ZodError) {
    const details = error.issues
      .slice(0, 3)
      .map((issue) => {
        const path = issue.path.length ? issue.path.join(".") : "response";
        return `${path}: ${issue.message}`;
      })
      .join("; ");

    return `Ability data from the API is invalid. ${details}`;
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
  const { mode, abilityId } = useLocalSearchParams<{ mode?: string; abilityId?: string }>();
  const themeName = useThemeStore((state) => state.themeName);

  const isCreateMode = mode !== "edit";

  const abilitiesQuery = useQuery({
    queryKey: ["admin-abilities"],
    queryFn: () => apiClient.adminAbilities(),
  });

  const createMutation = useMutation({
    mutationFn: (input: Record<string, unknown>) => apiClient.createAdminAbility(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-abilities"] });
      router.back();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Record<string, unknown> }) =>
      apiClient.updateAdminAbility(id, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-abilities"] });
      router.back();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.deleteAdminAbility(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-abilities"] });
      router.back();
    },
  });

  const selectedAbility = isCreateMode
    ? null
    : (() => {
        const match = (abilitiesQuery.data?.abilities ?? []).find((ability) => ability.id === abilityId);

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

  const queryError = formatAbilitiesError(abilitiesQuery.error);

  return (
    <View className="flex-1" style={THEME_VARS[themeName]}>
      <View className="flex-1 bg-primaryBg">
        <View className="w-9 h-1 rounded-full bg-[#D1D5DB] self-center mt-2 mb-[6]" />
        <View className="items-center px-5 pb-[14] border-b border-primaryBorder/16" style={{ paddingTop: 6 }}>
          <Text className="self-center font-nunito-extrabold text-[24px] text-primaryStrong">
            {isCreateMode ? "Create ability" : "Edit ability"}
          </Text>
        </View>

        {abilitiesQuery.isLoading && !isCreateMode ? (
          <View className="flex-1 items-center justify-center px-6">
            <Text className="font-nunito-bold text-[15px] text-primaryText text-center">Loading ability...</Text>
          </View>
        ) : queryError ? (
          <View className="flex-1 items-center justify-center px-6">
            <Text className="font-nunito-bold text-[15px] text-dangerText text-center">{queryError}</Text>
          </View>
        ) : !isCreateMode && !selectedAbility ? (
          <View className="flex-1 items-center justify-center px-6">
            <Text className="font-nunito-bold text-[15px] text-dangerText text-center">That ability could not be found.</Text>
          </View>
        ) : (
          <ScrollView
            className="flex-1"
            contentContainerStyle={{
              gap: 14,
              paddingHorizontal: 16,
              paddingTop: 8,
              paddingBottom: insets.bottom + 20,
            }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <AbilityEditorForm
              ability={selectedAbility}
              saving={
                createMutation.isPending || updateMutation.isPending || deleteMutation.isPending
              }
              onDelete={async (id) => {
                await deleteMutation.mutateAsync(id);
              }}
              onSubmit={async (input) => {
                if (selectedAbility) {
                  await updateMutation.mutateAsync({ id: selectedAbility.id, input });
                  return;
                }

                await createMutation.mutateAsync(input);
              }}
            />
          </ScrollView>
        )}
      </View>
    </View>
  );
}
