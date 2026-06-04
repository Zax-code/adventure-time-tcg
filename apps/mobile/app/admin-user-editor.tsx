import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  AdminBackground,
  AdminButton,
  AdminChip,
  AdminField,
  AdminHero,
  AdminNotice,
  AdminPanel,
  AdminStat,
  AdminTopBar,
} from "../src/components/admin/admin-ui";
import { withAlpha } from "../src/components/admin/admin-palette";
import {
  KEYBOARD_AWARE_SCROLL_PROPS,
  KeyboardScreenView,
} from "../src/components/keyboard-screen-view";
import { LoadingPanel } from "../src/components/loading-state";
import { ModalSheetRoute } from "../src/components/modal-sheet-route";
import { useTranslation } from "../src/i18n";
import { apiClient } from "../src/lib/api";
import { useSessionStore } from "../src/stores/session-store";
import { useThemeStore } from "../src/stores/theme-store";
import { THEME_COLORS, THEME_VARS } from "../src/theme/themes";

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

function UserEditorSection({
  title,
  subtitle,
  right,
  children,
}: {
  title: string;
  subtitle: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <View className="gap-4">
      <View className="flex-row items-start justify-between gap-4">
        <View className="flex-1 gap-1">
          <Text className="font-nunito-extrabold text-[20px] text-fg">
            {title}
          </Text>
          <Text className="font-nunito-semibold text-[13px] leading-[19px] text-fgMuted">
            {subtitle}
          </Text>
        </View>
        {right ? <View className="items-end">{right}</View> : null}
      </View>
      {children}
    </View>
  );
}

function UserEditorDivider() {
  const themeName = useThemeStore((state) => state.themeName);
  const tc = THEME_COLORS[themeName];

  return (
    <View
      className="h-px"
      style={{
        backgroundColor: withAlpha(
          tc.primaryBorder,
          themeName === "nightosphere" ? "40" : "2E",
        ),
      }}
    />
  );
}

function UserEditorInsetCard({
  children,
  tone = "default",
  rail = true,
}: {
  children: ReactNode;
  tone?: "default" | "info" | "warning" | "accent" | "success" | "danger";
  rail?: boolean;
}) {
  const themeName = useThemeStore((state) => state.themeName);
  const tc = THEME_COLORS[themeName];
  const palette = {
    default: {
      bg: withAlpha(tc.surface, themeName === "nightosphere" ? "D9" : "F7"),
      rail: withAlpha(tc.primaryBorder, themeName === "nightosphere" ? "66" : "52"),
    },
    info: {
      bg: withAlpha(tc.infoTint, "D9"),
      rail: tc.infoBorder,
    },
    warning: {
      bg: withAlpha(tc.secondaryTint, "E0"),
      rail: tc.secondaryBorder,
    },
    accent: {
      bg: withAlpha(tc.accentTint, "DC"),
      rail: tc.accentBorder,
    },
    success: {
      bg: withAlpha(tc.successTint, "D9"),
      rail: tc.successBorder,
    },
    danger: {
      bg: withAlpha(tc.dangerTint, "D9"),
      rail: tc.dangerBorder,
    },
  }[tone];

  return (
    <View
      className="overflow-hidden rounded-[22px]"
      style={{ backgroundColor: palette.bg }}
    >
      <View className="flex-row">
        {rail ? <View style={{ backgroundColor: palette.rail, width: 4 }} /> : null}
        <View className="flex-1 gap-3 px-4 py-4">{children}</View>
      </View>
    </View>
  );
}

export default function AdminUserEditorScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const themeName = useThemeStore((state) => state.themeName);
  const tc = THEME_COLORS[themeName];
  const sessionUser = useSessionStore((state) => state.user);
  const sessionHydrated = useSessionStore((state) => state.hydrated);
  const { userId } = useLocalSearchParams<{ userId?: string }>();
  const [coinDelta, setCoinDelta] = useState("100");
  const closeEditor = () => router.dismissTo("/admin/users" as any);
  const canAccessAdmin = sessionHydrated && Boolean(sessionUser?.isAdmin);

  const detailQuery = useQuery({
    queryKey: ["admin-user", userId],
    queryFn: () => apiClient.adminUserDetail(userId!),
    enabled: canAccessAdmin && Boolean(userId),
  });

  const adjustCoinsMutation = useMutation({
    mutationFn: (delta: number) =>
      apiClient.adjustAdminUserCoins(userId!, delta),
    onSuccess: async () => {
      setCoinDelta("100");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-user", userId] }),
        queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-email-requests"] }),
      ]);
    },
  });

  const roleMutation = useMutation({
    mutationFn: (isAdmin: boolean) =>
      apiClient.updateAdminUserRole(userId!, { isAdmin }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-user", userId] }),
        queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-email-requests"] }),
      ]);
    },
  });

  const resetMutation = useMutation({
    mutationFn: (
      input: { mode: "all" } | { mode: "single"; questType: string },
    ) => apiClient.resetAdminUserDailyQuests(userId!, input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-user", userId] }),
        queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-email-requests"] }),
      ]);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiClient.deleteAdminUser(userId!),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-user", userId] }),
        queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-email-requests"] }),
      ]);
      closeEditor();
    },
  });

  const detail = detailQuery.data;
  const isViewerSuperAdmin = sessionUser?.isSuperAdmin ?? false;
  const isSelf = detail?.id === sessionUser?.id;
  const canManageCoins = detail?.viewerPermissions.canManageCoins ?? false;
  const canManageRights =
    detail?.viewerPermissions.canManageAdminRights ?? false;
  const canResetQuests = detail?.viewerPermissions.canResetDailyQuests ?? false;
  const canDeleteUser =
    (detail?.viewerPermissions.canDeleteUser ?? false) && !isSelf;
  const completedQuestCount =
    detail?.dailyQuests.filter((quest) => quest.claimed || quest.completed)
      .length ?? 0;

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

  if (!sessionHydrated) {
    return null;
  }

  if (!sessionUser?.isAdmin) {
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
            <View className="px-4 pt-2">
              <AdminTopBar
                title={t("admin.userEditor.title")}
                subtitle={t("admin.users.subtitle")}
                chrome="soft"
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
                {...KEYBOARD_AWARE_SCROLL_PROPS}
                className="flex-1"
                contentInset={{ bottom: insets.bottom + 24 }}
                scrollIndicatorInsets={{ bottom: insets.bottom + 24 }}
                contentContainerStyle={{
                  gap: 16,
                  paddingHorizontal: 16,
                  paddingTop: 10,
                  paddingBottom: 24,
                }}
                showsVerticalScrollIndicator={false}
              >
                <AdminHero
                  title={detail.displayName ?? t("admin.common.noDisplayName")}
                  subtitle={detail.email}
                  chrome="soft"
                >
                  <View className="flex-row flex-wrap gap-2">
                    <AdminChip
                      label={t("admin.common.coinsCount", {
                        count: detail.coins,
                      })}
                      tone="warning"
                    />
                    {isSelf ? (
                      <AdminChip label={t("admin.common.you")} tone="info" />
                    ) : null}
                    {detail.isSuperAdmin ? (
                      <AdminChip
                        label={t("admin.common.superAdmin")}
                        tone="success"
                      />
                    ) : detail.isAdmin ? (
                      <AdminChip
                        label={t("admin.common.admin")}
                        tone="accent"
                      />
                    ) : null}
                    <AdminChip
                      label={t("admin.common.joinedDate", {
                        date: formatDate(detail.createdAt),
                      })}
                      tone="default"
                    />
                    <AdminChip
                      label={t("admin.common.todayDate", {
                        date: detail.todayDate,
                      })}
                      tone="default"
                    />
                  </View>
                  <View className="flex-row flex-wrap gap-3">
                    <AdminStat
                      label={t("admin.userEditor.coinsTitle")}
                      value={detail.coins.toLocaleString()}
                      helper={t("admin.userEditor.currentBalance")}
                      tone="warning"
                    />
                    <AdminStat
                      label={t("admin.userEditor.questsTitle")}
                      value={`${completedQuestCount}/${detail.dailyQuests.length}`}
                      helper={t("admin.userEditor.statusCompleted")}
                      tone="info"
                    />
                  </View>
                </AdminHero>

                <AdminPanel chrome="soft">
                  <View className="gap-6">
                    <UserEditorSection
                      title={t("admin.userEditor.coinsTitle")}
                      subtitle={t("admin.userEditor.coinsSubtitle")}
                    >
                      <UserEditorInsetCard rail={false} tone="warning">
                        <Text className="font-nunito-bold text-xs uppercase tracking-[0.7px] text-secondaryText">
                          {t("admin.userEditor.currentBalance")}
                        </Text>
                        <Text className="font-nunito-extrabold text-[30px] text-primaryStrong">
                          {detail.coins.toLocaleString()}
                        </Text>
                      </UserEditorInsetCard>

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
                                className="rounded-full px-4 py-3"
                                disabled={busy}
                                onPress={() =>
                                  void handleAdjustCoins(action.delta)
                                }
                                style={{
                                  backgroundColor:
                                    action.delta > 0
                                      ? withAlpha(tc.secondaryTint, "E8")
                                      : withAlpha(tc.dangerTint, "CC"),
                                }}
                              >
                                <Text
                                  className="font-nunito-extrabold text-[13px]"
                                  style={{
                                    color:
                                      action.delta > 0
                                        ? tc.secondaryText
                                        : tc.dangerText,
                                  }}
                                >
                                  {action.label}
                                </Text>
                              </Pressable>
                            ))}
                          </View>

                          <View className="gap-3">
                            <AdminField
                              label={t("admin.userEditor.customCoinDelta")}
                              value={coinDelta}
                              keyboardType="numeric"
                              onChangeText={setCoinDelta}
                              placeholder={t(
                                "admin.userEditor.customCoinPlaceholder",
                              )}
                            />
                            <AdminButton
                              label={
                                adjustCoinsMutation.isPending
                                  ? t("admin.userEditor.updating")
                                  : t("admin.userEditor.applyCoinChange")
                              }
                              disabled={busy}
                              onPress={() =>
                                void handleAdjustCoins(
                                  Number.parseInt(coinDelta || "0", 10),
                                )
                              }
                            />
                          </View>
                        </>
                      ) : (
                        <AdminNotice
                          title={t("admin.userEditor.coinsTitle")}
                          body={t("admin.userEditor.onlySuperAdminCoins")}
                          tone="info"
                          icon="lock-closed-outline"
                        />
                      )}
                    </UserEditorSection>

                    <UserEditorDivider />

                    <UserEditorSection
                      title={t("admin.userEditor.permissionsTitle")}
                      subtitle={t("admin.userEditor.permissionsSubtitle")}
                    >
                      <UserEditorInsetCard
                        rail={false}
                        tone={detail.isAdmin ? "accent" : "default"}
                      >
                        <View className="flex-row flex-wrap gap-2">
                          {detail.isSuperAdmin ? (
                            <AdminChip
                              label={t("admin.common.superAdmin")}
                              tone="success"
                            />
                          ) : null}
                          {detail.isAdmin ? (
                            <AdminChip
                              label={t("admin.userEditor.adminAccessEnabled")}
                              tone="accent"
                            />
                          ) : (
                            <AdminChip
                              label={t("admin.userEditor.adminAccessDisabled")}
                              tone="default"
                            />
                          )}
                        </View>

                        {canManageRights ? (
                          <AdminButton
                            label={
                              roleMutation.isPending
                                ? t("admin.common.saving")
                                : detail.isAdmin
                                  ? t("admin.userEditor.revokeAdminAccess")
                                  : t("admin.userEditor.grantAdminAccess")
                            }
                            variant={detail.isAdmin ? "ghost" : "primary"}
                            disabled={busy || isSelf}
                            onPress={() => roleMutation.mutate(!detail.isAdmin)}
                          />
                        ) : (
                          <AdminNotice
                            title={t("admin.userEditor.permissionsTitle")}
                            body={t("admin.userEditor.onlySuperAdminRights")}
                            tone="warning"
                            icon="shield-half-outline"
                          />
                        )}

                        {isSelf ? (
                          <AdminNotice
                            title={t("admin.common.you")}
                            body={t("admin.userEditor.cannotRevokeSelf")}
                            tone="info"
                            icon="person-circle-outline"
                          />
                        ) : null}
                      </UserEditorInsetCard>
                    </UserEditorSection>

                    {isViewerSuperAdmin ? (
                      <>
                        <UserEditorDivider />

                        <UserEditorSection
                          title={t("admin.userEditor.dangerTitle")}
                          subtitle={t("admin.userEditor.dangerSubtitle")}
                        >
                          <UserEditorInsetCard tone="danger">
                            <Text className="font-nunito-semibold text-[13px] leading-[19px] text-dangerText">
                              {t("admin.userEditor.deletePrompt", {
                                email: detail.email,
                              })}
                            </Text>
                            <AdminButton
                              label={
                                deleteMutation.isPending
                                  ? t("admin.userEditor.deleting")
                                  : t("admin.userEditor.deleteConfirm")
                              }
                              variant="danger"
                              disabled={!canDeleteUser || busy}
                              onPress={confirmDelete}
                            />
                            {!canDeleteUser ? (
                              <AdminNotice
                                title={t("admin.userEditor.dangerTitle")}
                                body={t("admin.userEditor.deleteRestriction")}
                                tone="warning"
                                icon="warning-outline"
                              />
                            ) : null}
                          </UserEditorInsetCard>
                        </UserEditorSection>
                      </>
                    ) : null}
                  </View>
                </AdminPanel>

                <AdminPanel chrome="soft" tint="info">
                  <UserEditorSection
                    title={t("admin.userEditor.questsTitle")}
                    subtitle={t("admin.userEditor.questsSubtitle")}
                    right={
                      canResetQuests ? (
                        <AdminButton
                          label={
                            resetMutation.isPending
                              ? t("admin.userEditor.resetting")
                              : t("admin.userEditor.resetAllConfirm")
                          }
                          variant="warning"
                          disabled={busy}
                          onPress={confirmResetAll}
                        />
                      ) : undefined
                    }
                  >
                    <View className="gap-3">
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
                          <UserEditorInsetCard
                            key={quest.id}
                            rail={false}
                            tone="default"
                          >
                            <View className="flex-row items-start justify-between gap-3">
                              <View className="flex-1 gap-1">
                                <Text className="font-nunito-extrabold text-[15px] text-fg">
                                  {questTitle}
                                </Text>
                                <Text className="font-nunito-semibold text-[13px] leading-[19px] text-fgMuted">
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
                              <AdminChip
                                label={`${quest.progress}/${quest.target}`}
                                tone="info"
                              />
                              <AdminChip
                                label={t("admin.common.coinsCount", {
                                  count: quest.reward,
                                })}
                                tone="warning"
                              />
                              {quest.attemptsUsed !== undefined ? (
                                <AdminChip
                                  label={t("admin.userEditor.guessesCount", {
                                    count: quest.attemptsUsed,
                                  })}
                                  tone="default"
                                />
                              ) : null}
                              {quest.runsUsed !== undefined &&
                              quest.maxRuns !== undefined ? (
                                <AdminChip
                                  label={t("admin.userEditor.runsCount", {
                                    used: quest.runsUsed,
                                    max: quest.maxRuns,
                                  })}
                                  tone="default"
                                />
                              ) : null}
                              {quest.latestScore !== undefined ? (
                                <AdminChip
                                  label={t("admin.userEditor.scoreLabel", {
                                    score: quest.latestScore,
                                  })}
                                  tone="default"
                                />
                              ) : null}
                            </View>

                            {canResetQuests ? (
                              <AdminButton
                                label={t("admin.userEditor.resetQuestConfirm")}
                                variant="ghost"
                                disabled={busy}
                                onPress={() =>
                                  confirmResetQuest(quest.type, questTitle)
                                }
                              />
                            ) : null}
                          </UserEditorInsetCard>
                        );
                      })}
                    </View>
                  </UserEditorSection>
                </AdminPanel>
              </ScrollView>
            )}
          </View>
        </AdminBackground>
      </KeyboardScreenView>
    </ModalSheetRoute>
  );
}
