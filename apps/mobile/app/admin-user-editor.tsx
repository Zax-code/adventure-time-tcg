import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AdminButton, AdminChip, AdminField, AdminPanel, AdminSectionTitle } from "../src/components/admin/admin-ui";
import { useTranslation } from "../src/i18n";
import { apiClient } from "../src/lib/api";
import { useSessionStore } from "../src/stores/session-store";
import { useThemeStore } from "../src/stores/theme-store";
import { THEME_VARS } from "../src/theme/themes";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

function getQuestTone(quest: {
  completed: boolean;
  claimed: boolean;
  failed: boolean;
}) {
  if (quest.claimed) {
    return "success" as const;
  }
  if (quest.completed) {
    return "accent" as const;
  }
  if (quest.failed) {
    return "danger" as const;
  }
  return "default" as const;
}

export default function AdminUserEditorScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const themeName = useThemeStore((state) => state.themeName);
  const sessionUser = useSessionStore((state) => state.user);
  const { userId } = useLocalSearchParams<{ userId?: string }>();
  const [coinDelta, setCoinDelta] = useState("100");

  const detailQuery = useQuery({
    queryKey: ["admin-user", userId],
    queryFn: () => apiClient.adminUserDetail(userId!),
    enabled: Boolean(userId),
  });

  const invalidateAdminQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin-user", userId] }),
      queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-emails"] }),
    ]);
  };

  const adjustCoinsMutation = useMutation({
    mutationFn: (delta: number) => apiClient.adjustAdminUserCoins(userId!, delta),
    onSuccess: async () => {
      setCoinDelta("100");
      await invalidateAdminQueries();
    },
  });

  const roleMutation = useMutation({
    mutationFn: (isAdmin: boolean) => apiClient.updateAdminUserRole(userId!, { isAdmin }),
    onSuccess: invalidateAdminQueries,
  });

  const resetMutation = useMutation({
    mutationFn: (input: { mode: "all" } | { mode: "single"; questType: string }) =>
      apiClient.resetAdminUserDailyQuests(userId!, input),
    onSuccess: invalidateAdminQueries,
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiClient.deleteAdminUser(userId!),
    onSuccess: async () => {
      await invalidateAdminQueries();
      router.back();
    },
  });

  const detail = detailQuery.data;
  const isSelf = detail?.id === sessionUser?.id;
  const canManageCoins = detail?.viewerPermissions.canManageCoins ?? false;
  const canManageRights = detail?.viewerPermissions.canManageAdminRights ?? false;
  const canResetQuests = detail?.viewerPermissions.canResetDailyQuests ?? false;
  const canDeleteUser = (detail?.viewerPermissions.canDeleteUser ?? false) && !isSelf;

  const busy = useMemo(
    () =>
      adjustCoinsMutation.isPending ||
      roleMutation.isPending ||
      resetMutation.isPending ||
      deleteMutation.isPending,
    [
      adjustCoinsMutation.isPending,
      deleteMutation.isPending,
      resetMutation.isPending,
      roleMutation.isPending,
    ],
  );

  const handleAdjustCoins = async (delta: number) => {
    if (!Number.isInteger(delta) || delta === 0) {
      return;
    }

    await adjustCoinsMutation.mutateAsync(delta);
  };

  const confirmResetAll = () => {
    Alert.alert(
      "Reset all quests?",
      "This will clear the user's progress for all of today's daily quests.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset all",
          style: "destructive",
          onPress: () => resetMutation.mutate({ mode: "all" }),
        },
      ],
    );
  };

  const confirmResetQuest = (questType: string, questLabel: string) => {
    Alert.alert(
      "Reset quest?",
      `This will clear today's progress for ${questLabel}.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset quest",
          style: "destructive",
          onPress: () => resetMutation.mutate({ mode: "single", questType }),
        },
      ],
    );
  };

  const confirmDelete = () => {
    if (!detail) {
      return;
    }

    Alert.alert(
      "Delete user?",
      `This permanently deletes ${detail.email} and removes their admin approval data.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete user",
          style: "destructive",
          onPress: () => deleteMutation.mutate(),
        },
      ],
    );
  };

  return (
    <View className="flex-1" style={THEME_VARS[themeName]}>
      <View className="flex-1 bg-primaryBg">
        <View className="w-9 h-1 rounded-full bg-[#D1D5DB] self-center mt-2 mb-[6]" />
        <View className="items-center px-5 pb-[14] border-b border-primaryBorder/16 pt-[6]">
          <Text className="self-center font-nunito-extrabold text-[24px] text-primaryStrong">
            Manage user
          </Text>
          <Pressable
            className="absolute right-4 top-1 rounded-full px-3 py-2"
            onPress={() => router.back()}
          >
            <Text className="font-nunito-bold text-sm text-primaryStrong">Close</Text>
          </Pressable>
        </View>

        {!userId ? (
          <View className="flex-1 items-center justify-center px-6">
            <Text className="font-nunito-bold text-[15px] text-dangerText text-center">
              Missing user id.
            </Text>
          </View>
        ) : detailQuery.isLoading ? (
          <View className="flex-1 items-center justify-center px-6">
            <Text className="font-nunito-bold text-[15px] text-primaryText text-center">
              Loading user...
            </Text>
          </View>
        ) : detailQuery.error ? (
          <View className="flex-1 items-center justify-center px-6">
            <Text className="font-nunito-bold text-[15px] text-dangerText text-center">
              {detailQuery.error instanceof Error
                ? detailQuery.error.message
                : "Failed to load this user."}
            </Text>
          </View>
        ) : !detail ? (
          <View className="flex-1 items-center justify-center px-6">
            <Text className="font-nunito-bold text-[15px] text-dangerText text-center">
              That user could not be found.
            </Text>
          </View>
        ) : (
          <ScrollView
            className="flex-1"
            contentContainerStyle={{
              gap: 14,
              paddingHorizontal: 16,
              paddingTop: 10,
              paddingBottom: insets.bottom + 24,
            }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <AdminPanel>
              <AdminSectionTitle
                title={detail.displayName ?? "No display name"}
                subtitle={detail.email}
              />
              <View className="mt-3 flex-row flex-wrap gap-2">
                <AdminChip label={`${detail.coins} coins`} tone="warning" />
                {isSelf ? <AdminChip label="You" tone="info" /> : null}
                {detail.isSuperAdmin ? (
                  <AdminChip label="Super Admin" tone="success" />
                ) : null}
                {detail.isAdmin ? <AdminChip label="Admin" tone="accent" /> : null}
                <AdminChip label={`Joined ${formatDate(detail.createdAt)}`} tone="default" />
                <AdminChip label={`Today ${detail.todayDate}`} tone="default" />
              </View>
            </AdminPanel>

            <AdminPanel>
              <AdminSectionTitle
                title="Coins"
                subtitle="Current balance is always visible. Coin controls are limited to the super admin."
              />
              <View className="mt-3 gap-3">
                <View className="rounded-[20px] border border-primaryBorder/30 bg-surface p-4">
                  <Text className="font-nunito-bold text-xs text-fgMuted">
                    Current balance
                  </Text>
                  <Text className="mt-1 font-nunito-extrabold text-[28px] text-primaryStrong">
                    {detail.coins.toLocaleString()}
                  </Text>
                </View>

                {canManageCoins ? (
                  <>
                    <View className="flex-row flex-wrap gap-2">
                      {[
                        { label: "+100", delta: 100 },
                        { label: "+500", delta: 500 },
                        { label: "-100", delta: -100 },
                        { label: "-500", delta: -500 },
                      ].map((action) => (
                        <Pressable
                          key={action.label}
                          className="rounded-full border border-primaryBorder/30 bg-surface px-4 py-2"
                          disabled={busy}
                          onPress={() => void handleAdjustCoins(action.delta)}
                        >
                          <Text className="font-nunito-extrabold text-xs text-primaryStrong">
                            {action.label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>

                    <AdminField
                      label="Custom coin delta"
                      value={coinDelta}
                      keyboardType="numeric"
                      onChangeText={setCoinDelta}
                      placeholder="Use a negative number to remove coins"
                    />
                    <AdminButton
                      label={adjustCoinsMutation.isPending ? "Updating..." : "Apply coin change"}
                      disabled={busy}
                      onPress={() => void handleAdjustCoins(Number.parseInt(coinDelta || "0", 10))}
                    />
                  </>
                ) : (
                  <Text className="font-nunito-semibold text-[13px] text-fgMuted">
                    Only the super admin can adjust coins.
                  </Text>
                )}
              </View>
            </AdminPanel>

            <AdminPanel>
              <AdminSectionTitle
                title="Today's daily quests"
                subtitle="See quest-by-quest progress. The super admin can reset one quest at a time or wipe the whole day."
                right={
                  canResetQuests ? (
                    <AdminButton
                      label={resetMutation.isPending ? "Resetting..." : "Reset all"}
                      variant="warning"
                      disabled={busy}
                      onPress={confirmResetAll}
                    />
                  ) : undefined
                }
              />
              <View className="mt-3 gap-3">
                {detail.dailyQuests.map((quest) => {
                  const questTitle = t(quest.title);
                  const questDescription = t(quest.description, {
                    amount: quest.reward,
                    reward: quest.reward,
                    score: quest.latestScore ?? 0,
                    used: quest.runsUsed ?? 0,
                    max: quest.maxRuns ?? 0,
                  });

                  return (
                    <View
                      key={quest.id}
                      className="gap-3 rounded-[20px] border border-primaryBorder/30 bg-surfaceMuted p-4"
                    >
                      <View className="flex-row items-start justify-between gap-3">
                        <View className="flex-1 gap-1">
                          <Text className="font-nunito-extrabold text-[15px] text-fg">
                            {questTitle}
                          </Text>
                          <Text className="font-nunito-semibold text-[13px] text-fgMuted">
                            {questDescription}
                          </Text>
                        </View>
                        <AdminChip
                          label={
                            quest.claimed
                              ? "Claimed"
                              : quest.completed
                                ? "Completed"
                                : quest.failed
                                  ? "Failed"
                                  : "In progress"
                          }
                          tone={getQuestTone(quest)}
                        />
                      </View>

                      <View className="flex-row flex-wrap gap-2">
                        <AdminChip label={`${quest.progress}/${quest.target}`} tone="info" />
                        <AdminChip label={`${quest.reward} coins`} tone="warning" />
                        {quest.attemptsUsed !== undefined ? (
                          <AdminChip label={`${quest.attemptsUsed} guesses`} tone="default" />
                        ) : null}
                        {quest.runsUsed !== undefined && quest.maxRuns !== undefined ? (
                          <AdminChip label={`${quest.runsUsed}/${quest.maxRuns} runs`} tone="default" />
                        ) : null}
                        {quest.latestScore !== undefined ? (
                          <AdminChip label={`Score ${quest.latestScore}`} tone="default" />
                        ) : null}
                      </View>

                      {canResetQuests ? (
                        <AdminButton
                          label="Reset quest"
                          variant="ghost"
                          disabled={busy}
                          onPress={() => confirmResetQuest(quest.type, questTitle)}
                        />
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </AdminPanel>

            <AdminPanel>
              <AdminSectionTitle
                title="Permissions"
                subtitle="Admin rights and super-admin visibility are controlled from this user's approval record. Only the super admin can change them."
              />
              <View className="mt-3 gap-3">
                <View className="flex-row flex-wrap gap-2">
                  {detail.isSuperAdmin ? (
                    <AdminChip label="Super Admin" tone="success" />
                  ) : null}
                  {detail.isAdmin ? (
                    <AdminChip label="Admin access enabled" tone="accent" />
                  ) : (
                    <AdminChip label="Admin access disabled" tone="default" />
                  )}
                </View>

                {canManageRights ? (
                  <AdminButton
                    label={roleMutation.isPending ? "Saving..." : detail.isAdmin ? "Revoke admin access" : "Grant admin access"}
                    variant={detail.isAdmin ? "ghost" : "primary"}
                    disabled={busy || isSelf}
                    onPress={() => roleMutation.mutate(!detail.isAdmin)}
                  />
                ) : (
                  <Text className="font-nunito-semibold text-[13px] text-fgMuted">
                    Only the super admin can change admin rights.
                  </Text>
                )}

                {isSelf ? (
                  <Text className="font-nunito-semibold text-[13px] text-fgMuted">
                    You cannot revoke your own admin access here.
                  </Text>
                ) : null}
              </View>
            </AdminPanel>

            <AdminPanel>
              <AdminSectionTitle
                title="Danger zone"
                subtitle="Permanent account deletion is limited to the super admin and cannot target the currently signed-in user."
              />
              <View className="mt-3 gap-3">
                <Text className="font-nunito-semibold text-[13px] text-dangerText">
                  Delete {detail.email} and remove their admin approval record.
                </Text>
                <AdminButton
                  label={deleteMutation.isPending ? "Deleting..." : "Delete user"}
                  variant="danger"
                  disabled={!canDeleteUser || busy}
                  onPress={confirmDelete}
                />
                {!canDeleteUser ? (
                  <Text className="font-nunito-semibold text-[13px] text-fgMuted">
                    Only the super admin can delete users, and self-delete is blocked.
                  </Text>
                ) : null}
              </View>
            </AdminPanel>
          </ScrollView>
        )}
      </View>
    </View>
  );
}
