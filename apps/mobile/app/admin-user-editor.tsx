import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AdminButton, AdminChip, AdminField, AdminPanel, AdminSectionTitle } from "../src/components/admin/admin-ui";
import { LoadingPanel } from "../src/components/loading-state";
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
  const sessionHydrated = useSessionStore((state) => state.hydrated);
  const { userId } = useLocalSearchParams<{ userId?: string }>();
  const [coinDelta, setCoinDelta] = useState("100");
  const closeEditor = () => router.dismissTo("/admin/users" as any);

  if (!sessionHydrated) {
    return null;
  }

  if (!sessionUser?.isAdmin) {
    return <Redirect href="/(tabs)" />;
  }

  const detailQuery = useQuery({
    queryKey: ["admin-user", userId],
    queryFn: () => apiClient.adminUserDetail(userId!),
    enabled: Boolean(userId),
  });

  const invalidateAdminQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin-user", userId] }),
      queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-email-requests"] }),
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
      closeEditor();
    },
  });

  const detail = detailQuery.data;
  const isViewerSuperAdmin = sessionUser?.isSuperAdmin ?? false;
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
      t("admin.userEditor.resetAllTitle"),
      t("admin.userEditor.resetAllBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("admin.userEditor.resetAllConfirm"),
          style: "destructive",
          onPress: () => resetMutation.mutate({ mode: "all" }),
        },
      ],
    );
  };

  const confirmResetQuest = (questType: string, questLabel: string) => {
    Alert.alert(
      t("admin.userEditor.resetQuestTitle"),
      t("admin.userEditor.resetQuestBody", { quest: questLabel }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("admin.userEditor.resetQuestConfirm"),
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
      t("admin.userEditor.deleteTitle"),
      t("admin.userEditor.deleteBody", { email: detail.email }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("admin.userEditor.deleteConfirm"),
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
            {t("admin.userEditor.title")}
          </Text>
          <Pressable
            className="absolute right-4 top-1 rounded-full px-3 py-2"
            onPress={closeEditor}
          >
            <Text className="font-nunito-bold text-sm text-primaryStrong">{t("admin.common.close")}</Text>
          </Pressable>
        </View>

        {!userId ? (
          <View className="flex-1 items-center justify-center px-6">
            <Text className="font-nunito-bold text-[15px] text-dangerText text-center">
                {t("admin.userEditor.missingUserId")}
            </Text>
          </View>
        ) : detailQuery.isLoading ? (
          <View className="flex-1 items-center justify-center px-6">
            <LoadingPanel
              title={t("admin.userEditor.loadingUser")}
              message={t("common.loadingStates.adminBody")}
              icon="person"
            />
          </View>
        ) : detailQuery.error ? (
          <View className="flex-1 items-center justify-center px-6">
            <Text className="font-nunito-bold text-[15px] text-dangerText text-center">
              {detailQuery.error instanceof Error
                ? detailQuery.error.message
                : t("admin.userEditor.loadFailed")}
            </Text>
          </View>
        ) : !detail ? (
          <View className="flex-1 items-center justify-center px-6">
            <Text className="font-nunito-bold text-[15px] text-dangerText text-center">
               {t("admin.userEditor.notFound")}
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
                title={detail.displayName ?? t("admin.common.noDisplayName")}
                subtitle={detail.email}
              />
              <View className="mt-3 flex-row flex-wrap gap-2">
                <AdminChip label={t("admin.common.coinsCount", { count: detail.coins })} tone="warning" />
                {isSelf ? <AdminChip label={t("admin.common.you")} tone="info" /> : null}
                {detail.isSuperAdmin ? (
                  <AdminChip label={t("admin.common.superAdmin")} tone="success" />
                ) : null}
                {detail.isAdmin ? <AdminChip label={t("admin.common.admin")} tone="accent" /> : null}
                <AdminChip label={t("admin.common.joinedDate", { date: formatDate(detail.createdAt) })} tone="default" />
                <AdminChip label={t("admin.common.todayDate", { date: detail.todayDate })} tone="default" />
              </View>
            </AdminPanel>

            <AdminPanel>
              <AdminSectionTitle
                title={t("admin.userEditor.coinsTitle")}
                subtitle={t("admin.userEditor.coinsSubtitle")}
              />
              <View className="mt-3 gap-3">
                <View className="rounded-[20px] border border-primaryBorder/30 bg-surface p-4">
                  <Text className="font-nunito-bold text-xs text-fgMuted">
                    {t("admin.userEditor.currentBalance")}
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
                      label={t("admin.userEditor.customCoinDelta")}
                      value={coinDelta}
                      keyboardType="numeric"
                      onChangeText={setCoinDelta}
                      placeholder={t("admin.userEditor.customCoinPlaceholder")}
                    />
                    <AdminButton
                      label={adjustCoinsMutation.isPending ? t("admin.userEditor.updating") : t("admin.userEditor.applyCoinChange")}
                      disabled={busy}
                      onPress={() => void handleAdjustCoins(Number.parseInt(coinDelta || "0", 10))}
                    />
                  </>
                ) : (
                  <Text className="font-nunito-semibold text-[13px] text-fgMuted">
                    {t("admin.userEditor.onlySuperAdminCoins")}
                  </Text>
                )}
              </View>
            </AdminPanel>

            <AdminPanel>
              <AdminSectionTitle
                title={t("admin.userEditor.questsTitle")}
                subtitle={t("admin.userEditor.questsSubtitle")}
                right={
                  canResetQuests ? (
                    <AdminButton
                      label={resetMutation.isPending ? t("admin.userEditor.resetting") : t("admin.userEditor.resetAllConfirm")}
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
                              ? t("admin.userEditor.statusClaimed")
                              : quest.completed
                                ? t("admin.userEditor.statusCompleted")
                                : quest.failed
                                  ? t("admin.userEditor.statusFailed")
                                  : t("admin.userEditor.statusInProgress")
                          }
                          tone={getQuestTone(quest)}
                        />
                      </View>

                      <View className="flex-row flex-wrap gap-2">
                        <AdminChip label={`${quest.progress}/${quest.target}`} tone="info" />
                        <AdminChip label={t("admin.common.coinsCount", { count: quest.reward })} tone="warning" />
                        {quest.attemptsUsed !== undefined ? (
                          <AdminChip label={t("admin.userEditor.guessesCount", { count: quest.attemptsUsed })} tone="default" />
                        ) : null}
                        {quest.runsUsed !== undefined && quest.maxRuns !== undefined ? (
                          <AdminChip label={t("admin.userEditor.runsCount", { used: quest.runsUsed, max: quest.maxRuns })} tone="default" />
                        ) : null}
                        {quest.latestScore !== undefined ? (
                          <AdminChip label={t("admin.userEditor.scoreLabel", { score: quest.latestScore })} tone="default" />
                        ) : null}
                      </View>

                      {canResetQuests ? (
                        <AdminButton
                          label={t("admin.userEditor.resetQuestConfirm")}
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
                title={t("admin.userEditor.permissionsTitle")}
                subtitle={t("admin.userEditor.permissionsSubtitle")}
              />
              <View className="mt-3 gap-3">
                <View className="flex-row flex-wrap gap-2">
                  {detail.isSuperAdmin ? (
                    <AdminChip label={t("admin.common.superAdmin")} tone="success" />
                  ) : null}
                  {detail.isAdmin ? (
                    <AdminChip label={t("admin.userEditor.adminAccessEnabled")} tone="accent" />
                  ) : (
                    <AdminChip label={t("admin.userEditor.adminAccessDisabled")} tone="default" />
                  )}
                </View>

                {canManageRights ? (
                  <AdminButton
                    label={roleMutation.isPending ? t("admin.common.saving") : detail.isAdmin ? t("admin.userEditor.revokeAdminAccess") : t("admin.userEditor.grantAdminAccess")}
                    variant={detail.isAdmin ? "ghost" : "primary"}
                    disabled={busy || isSelf}
                    onPress={() => roleMutation.mutate(!detail.isAdmin)}
                  />
                ) : (
                  <Text className="font-nunito-semibold text-[13px] text-fgMuted">
                    {t("admin.userEditor.onlySuperAdminRights")}
                  </Text>
                )}

                {isSelf ? (
                  <Text className="font-nunito-semibold text-[13px] text-fgMuted">
                    {t("admin.userEditor.cannotRevokeSelf")}
                  </Text>
                ) : null}
              </View>
            </AdminPanel>

            {isViewerSuperAdmin ? (
              <AdminPanel>
                <AdminSectionTitle
                  title={t("admin.userEditor.dangerTitle")}
                  subtitle={t("admin.userEditor.dangerSubtitle")}
                />
                <View className="mt-3 gap-3">
                  <Text className="font-nunito-semibold text-[13px] text-dangerText">
                    {t("admin.userEditor.deletePrompt", { email: detail.email })}
                  </Text>
                  <AdminButton
                    label={deleteMutation.isPending ? t("admin.userEditor.deleting") : t("admin.userEditor.deleteConfirm")}
                    variant="danger"
                    disabled={!canDeleteUser || busy}
                    onPress={confirmDelete}
                  />
                  {!canDeleteUser ? (
                    <Text className="font-nunito-semibold text-[13px] text-fgMuted">
                      {t("admin.userEditor.deleteRestriction")}
                    </Text>
                  ) : null}
                </View>
              </AdminPanel>
            ) : null}
          </ScrollView>
        )}
      </View>
    </View>
  );
}
