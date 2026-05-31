import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import type { QuestsResponse } from "@adventure-time/api-client";

import {
  CheckCircleIcon,
  ClaimedIcon,
  CoinIcon,
  HelpCircleIcon,
  SparklesIcon,
  WalkingIcon,
  XCircleIcon,
} from "../../src/components/icons";
import { PageLoadingState } from "../../src/components/loading-state";
import { ToastBanner } from "../../src/components/toast-banner";
import { useTranslation } from "../../src/i18n";
import { apiClient } from "../../src/lib/api";
import {
  openDeviceHealthSetup,
  syncDeviceStepsNow,
} from "../../src/lib/step-sync";
import { useQuestResetStore } from "../../src/stores/quest-reset-store";
import { useSessionStore } from "../../src/stores/session-store";
import { useStepSyncStore } from "../../src/stores/step-sync-store";
import { useThemeStore } from "../../src/stores/theme-store";
import { useBottomTabBarContentPadding } from "../../src/theme/layout";
import { THEME_COLORS } from "../../src/theme/themes";

type QuestStatus = "active" | "completed" | "claimed" | "failed";
type Quest = QuestsResponse["quests"][number];

function formatProgress(progress: number, target: number) {
  if (target >= 10000) {
    return `${(progress / 1000).toFixed(1)}k / ${(target / 1000).toFixed(0)}k`;
  }

  return `${progress.toLocaleString()} / ${target.toLocaleString()}`;
}

function getQuestStatus(quest: {
  claimed: boolean;
  completed: boolean;
  failed: boolean;
}): QuestStatus {
  if (quest.claimed) return "claimed";
  if (quest.completed) return "completed";
  if (quest.failed) return "failed";
  return "active";
}

function getQuestTitle(
  titleKey: string,
  t: (key: string, params?: Record<string, string | number>) => string,
) {
  const translated = t(`quests.${titleKey}`);
  return translated.startsWith("quests.") ? titleKey : translated;
}

function getQuestDesc(
  descKey: string,
  t: (key: string, params?: Record<string, string | number>) => string,
) {
  const translated = t(`quests.${descKey}`);
  return translated.startsWith("quests.") ? descKey : translated;
}

function getProgressColor(
  status: QuestStatus,
  tc: (typeof THEME_COLORS)[keyof typeof THEME_COLORS],
) {
  if (status === "claimed") return tc.muted;
  if (status === "completed") return tc.successDark;
  if (status === "failed") return tc.dangerDark;
  return tc.accentStrong;
}

function getMetaColor(
  status: QuestStatus,
  tc: (typeof THEME_COLORS)[keyof typeof THEME_COLORS],
) {
  if (status === "claimed") return tc.muted;
  if (status === "completed") return tc.successDark;
  return tc.primaryStrong;
}

function isWordleQuest(questType: string) {
  return questType === "wordle_daily";
}

function isSpeedCalculusQuest(questType: string) {
  return questType === "speed_calculus_daily";
}

function isStepQuest(questType: string) {
  return questType === "steps_10k";
}

function getQuestProgressDisplay(quest: Quest) {
  if (isWordleQuest(quest.type)) {
    const used = quest.attemptsUsed ?? 0;
    return {
      progress: used,
      target: 6,
      progressPct: Math.min(100, (used / 6) * 100),
    };
  }

  return {
    progress: quest.progress,
    target: quest.target,
    progressPct: quest.completed
      ? 100
      : Math.min(100, (quest.progress / quest.target) * 100),
  };
}

export default function QuestsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const patchUser = useSessionStore((state) => state.patchUser);
  const user = useSessionStore((state) => state.user);
  const stepSync = useStepSyncStore();
  const { t } = useTranslation();
  const bottomTabPadding = useBottomTabBarContentPadding();
  const lastQuestResetAt = useQuestResetStore((state) => state.lastResetAt);
  const lastQuestResetPayload = useQuestResetStore(
    (state) => state.lastPayload,
  );

  const [showDescriptionFor, setShowDescriptionFor] = useState<Quest | null>(
    null,
  );
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const [isForceRefreshingStepQuest, setIsForceRefreshingStepQuest] =
    useState(false);
  const toastAnim = useRef(new Animated.Value(-60)).current;
  const lastImmediateResetAtRef = useRef(0);

  useEffect(() => {
    if (!toast) {
      return;
    }

    toastAnim.setValue(-60);
    Animated.timing(toastAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast, toastAnim]);

  const tc = THEME_COLORS[useThemeStore((s) => s.themeName)];

  const STATUS_COLORS: Record<
    QuestStatus,
    {
      border: string;
      iconBg: string;
      iconColor: string;
      gradStart: string;
      gradEnd: string;
    }
  > = {
    active: {
      border: tc.primaryBorder,
      iconBg: tc.primaryTint,
      iconColor: tc.primaryText,
      gradStart: tc.primary,
      gradEnd: tc.primaryDark,
    },
    completed: {
      border: tc.successBorder,
      iconBg: tc.successTint,
      iconColor: tc.successDark,
      gradStart: tc.success,
      gradEnd: tc.successDark,
    },
    claimed: {
      border: tc.muted,
      iconBg: tc.surfaceMuted,
      iconColor: tc.muted,
      gradStart: tc.muted,
      gradEnd: tc.muted,
    },
    failed: {
      border: tc.dangerBorder,
      iconBg: tc.dangerTint,
      iconColor: tc.dangerDark,
      gradStart: tc.danger,
      gradEnd: tc.dangerDark,
    },
  };

  const questsQuery = useQuery({
    queryKey: ["quests"],
    queryFn: () => apiClient.quests(),
    refetchInterval: 30_000,
  });

  const showStepQuestActivationPrompt =
    user?.preferredStepSource === "device_health" &&
    (stepSync.availability === "setup_required" ||
      stepSync.healthPermissionStatus !== "granted");
  const showStepQuestSyncControls =
    user?.preferredStepSource === "device_health";
  const stepActionLabel =
    stepSync.availability === "setup_required"
      ? t("settings.openHealthConnect")
      : stepSync.healthPermissionStatus === "granted"
        ? t("settings.syncNow")
        : t("settings.enableStepSync");

  const handleStepAction = useCallback(async () => {
    if (stepSync.availability === "setup_required") {
      await openDeviceHealthSetup();
      return;
    }

    await syncDeviceStepsNow({
      interactive: true,
      source: "manual",
    });
  }, [stepSync.availability]);

  const handleForceRefresh = useCallback(async () => {
    setIsForceRefreshingStepQuest(true);

    try {
      await syncDeviceStepsNow({
        interactive: false,
        source: "manual",
      });
      await questsQuery.refetch();
    } finally {
      setIsForceRefreshingStepQuest(false);
    }
  }, [questsQuery]);

  useFocusEffect(
    useCallback(() => {
      void questsQuery.refetch();
    }, [questsQuery]),
  );

  const claimQuestMutation = useMutation({
    mutationFn: (questId: string) => apiClient.claimQuest({ questId }),
    onSuccess: async (data, questId) => {
      const quest = questsQuery.data?.quests.find(
        (entry) => entry.id === questId,
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["quests"] }),
        queryClient.invalidateQueries({ queryKey: ["home"] }),
      ]);
      await patchUser({ coins: data.newBalance });

      setToast({
        message: t("quests.claimSuccess", {
          amount: quest?.reward ?? 0,
        }),
        type: "success",
      });
    },
    onError: () => {
      setToast({ message: t("quests.claimFailed"), type: "error" });
    },
  });

  const previousQuestMapRef = useRef<Record<string, Quest>>({});

  useEffect(() => {
    if (!lastQuestResetAt || !lastQuestResetPayload) return;

    const resetQuest = questsQuery.data?.quests.find((quest) => {
      return (
        !lastQuestResetPayload.questType ||
        quest.type === lastQuestResetPayload.questType
      );
    });

    const questTitle = resetQuest
      ? getQuestTitle(resetQuest.title, t)
      : t("quests.title");

    setToast({
      type: "success",
      message: lastQuestResetPayload.resetByName
        ? t("quests.questResetByAdmin", {
            quest: questTitle,
            name: lastQuestResetPayload.resetByName,
          })
        : t("quests.questReset", { quest: questTitle }),
    });
    lastImmediateResetAtRef.current = lastQuestResetAt;
  }, [lastQuestResetAt, lastQuestResetPayload, questsQuery.data, t]);

  useEffect(() => {
    const nextQuests = questsQuery.data?.quests;
    if (!nextQuests) return;

    if (Date.now() - lastImmediateResetAtRef.current < 2_000) {
      previousQuestMapRef.current = Object.fromEntries(
        nextQuests.map((quest) => [quest.type, quest]),
      );
      return;
    }

    const previousQuestMap = previousQuestMapRef.current;

    const resetQuest = nextQuests.find((quest) => {
      const previousQuest = previousQuestMap[quest.type];

      if (!previousQuest) {
        return false;
      }

      if (previousQuest.version === quest.version) {
        return false;
      }

      return (
        previousQuest.progress > 0 ||
        previousQuest.completed ||
        previousQuest.claimed ||
        previousQuest.failed ||
        (previousQuest.attemptsUsed ?? 0) > 0 ||
        (previousQuest.runsUsed ?? 0) > 0
      );
    });

    previousQuestMapRef.current = Object.fromEntries(
      nextQuests.map((quest) => [quest.type, quest]),
    );

    if (!resetQuest) {
      return;
    }

    const questTitle = getQuestTitle(resetQuest.title, t);

    setToast({
      type: "success",
      message: resetQuest.resetByName
        ? t("quests.questResetByAdmin", {
            quest: questTitle,
            name: resetQuest.resetByName,
          })
        : t("quests.questReset", { quest: questTitle }),
    });
  }, [questsQuery.data, t]);

  const openQuest = useCallback(
    (quest: Quest) => {
      if (!quest.actionPath) return;

      router.push(quest.actionPath as never);
    },
    [router],
  );

  if (questsQuery.isLoading) {
    return (
      <PageLoadingState
        title={t("nav.quests")}
        message={t("common.loadingStates.pageBody")}
        icon="trophy"
      />
    );
  }

  if (questsQuery.isError || !questsQuery.data) {
    return (
      <View className="flex-1 bg-bg p-6">
        <Text className="font-nunito text-danger">
          {questsQuery.error?.message ?? t("quests.unavailable")}
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-bg">
      {toast ? (
        <ToastBanner
          message={toast.message}
          type={toast.type}
          translateY={toastAnim}
          successColor={tc.successDark}
          errorColor={tc.dangerDark}
        />
      ) : null}

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: 16,
          paddingBottom: bottomTabPadding,
          paddingHorizontal: 16,
        }}
      >
        <View className="items-center mb-6" style={{ gap: 8 }}>
          <Text
            className="font-nunito-extrabold text-3xl text-primaryDark"
            style={{
              textShadowColor: "rgba(0,0,0,0.15)",
              textShadowOffset: { width: 0, height: 2 },
              textShadowRadius: 4,
            }}
          >
            {t("quests.title")}
          </Text>
          <Text
            className="font-nunito-medium text-sm px-4"
            style={{
              color: tc.primaryDark,
              textAlign: "center",
            }}
          >
            {t("quests.subtitle")}
          </Text>
        </View>

        {!questsQuery.data.fitbitConnected ? (
          <View
            className="bg-successTint border border-successBorder"
            style={{
              borderRadius: 16,
              padding: 16,
              marginTop: 16,
              marginBottom: 16,
              shadowColor: "#000",
              shadowOpacity: 0.08,
              shadowRadius: 4,
              shadowOffset: { width: 0, height: 2 },
              elevation: 2,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                gap: 12,
              }}
            >
              <WalkingIcon size={32} color={tc.successDark} />
              <View style={{ flex: 1 }}>
                <Text className="font-nunito-bold text-base text-successDark">
                  {t("settings.connectFitbit")}
                </Text>
                <Text className="font-nunito text-sm mt-1 text-successDark">
                  {t("quests.connectFitbitDesc")}
                </Text>
                <View
                  style={{
                    marginTop: 12,
                    alignSelf: "flex-start",
                    shadowColor: "#000",
                    shadowOpacity: 0.15,
                    shadowRadius: 6,
                    shadowOffset: { width: 0, height: 3 },
                    elevation: 4,
                    borderRadius: 8,
                  }}
                >
                  <TouchableOpacity
                    onPress={() => router.push("/settings")}
                    style={{ borderRadius: 8, overflow: "hidden" }}
                  >
                    <LinearGradient
                      colors={[tc.success, tc.successDark]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={{ paddingHorizontal: 16, paddingVertical: 8 }}
                    >
                      <Text className="font-nunito text-white text-sm">
                        {t("quests.connectInSettings")}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        ) : null}

        {questsQuery.data.quests.length === 0 ? (
          <View
            className="bg-surfaceMuted border border-primaryBorder"
            style={{
              borderRadius: 16,
              padding: 32,
              alignItems: "center",
            }}
          >
            {questsQuery.data.fitbitConnected ? (
              <>
                <SparklesIcon size={48} color={tc.primaryBorder} />
                <Text className="font-nunito-bold text-base text-fgMuted mt-4">
                  {t("quests.noQuests")}
                </Text>
                <Text className="font-nunito text-sm text-fgMuted mt-2 text-center">
                  {t("quests.checkBackLater")}
                </Text>
              </>
            ) : (
              <>
                <WalkingIcon size={48} color={tc.primaryBorder} />
                <Text className="font-nunito-bold text-base text-fgMuted mt-4">
                  {t("settings.connectFitbit")}
                </Text>
                <Text className="font-nunito text-sm text-fgMuted mt-2 text-center">
                  {t("quests.connectFitbitDesc")}
                </Text>
              </>
            )}
          </View>
        ) : (
          questsQuery.data.quests.map((quest, index) => {
            const status = getQuestStatus(quest);
            const colors = STATUS_COLORS[status];
            const progressDisplay = getQuestProgressDisplay(quest);
            const isClaimLoading =
              claimQuestMutation.isPending &&
              claimQuestMutation.variables === quest.id;
            const QuestIcon =
              quest.icon === "walking" ? WalkingIcon : SparklesIcon;
            const title = getQuestTitle(quest.title, t);
            const actionLabel =
              status === "active"
                ? t("quests.playQuest")
                : t("quests.seeResults");
            const shouldShowActivationPrompt =
              isStepQuest(quest.type) &&
              status === "active" &&
              showStepQuestActivationPrompt;
            const shouldShowStepSyncControls =
              isStepQuest(quest.type) &&
              status === "active" &&
              showStepQuestSyncControls;

            let statusIcon;
            if (status === "completed") {
              statusIcon = (
                <CheckCircleIcon size={28} color={colors.iconColor} />
              );
            } else if (status === "claimed") {
              statusIcon = <ClaimedIcon size={28} color={colors.iconColor} />;
            } else if (status === "failed") {
              statusIcon = <XCircleIcon size={28} color={colors.iconColor} />;
            } else {
              statusIcon = <QuestIcon size={28} color={colors.iconColor} />;
            }

            return (
              <View
                key={quest.id}
                className="rounded-2xl p-4"
                style={{
                  backgroundColor: tc.surface,
                  borderWidth: 2,
                  borderColor: colors.border,
                  opacity: status === "claimed" ? 0.6 : 1,
                  shadowColor: "#000",
                  shadowOpacity: 0.1,
                  shadowRadius: 8,
                  shadowOffset: { width: 0, height: 2 },
                  elevation: 2,
                  marginBottom:
                    index === questsQuery.data.quests.length - 1 ? 0 : 12,
                }}
              >
                <TouchableOpacity
                  style={{
                    position: "absolute",
                    top: -8,
                    right: -8,
                    zIndex: 1,
                  }}
                  onPress={() => setShowDescriptionFor(quest)}
                  hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                >
                  <View
                    style={{
                      backgroundColor: tc.surface,
                      borderRadius: 999,
                      borderWidth: 2,
                      borderColor: colors.border,
                      shadowColor: "#000",
                      shadowOpacity: 0.15,
                      shadowRadius: 4,
                      shadowOffset: { width: 0, height: 2 },
                      elevation: 2,
                    }}
                  >
                    <HelpCircleIcon size={20} color={colors.border} noCircle />
                  </View>
                </TouchableOpacity>

                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "flex-start",
                    gap: 16,
                    paddingRight: 24,
                  }}
                >
                  <View
                    style={{
                      backgroundColor: colors.iconBg,
                      padding: 12,
                      borderRadius: 12,
                    }}
                  >
                    {statusIcon}
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text className="font-nunito-bold text-base text-fg">
                      {title}
                    </Text>
                  </View>

                  <View className="flex-row items-center gap-1">
                    <CoinIcon size={18} />
                    <Text
                      style={{ color: tc.secondaryDark }}
                      className="font-nunito-bold text-base"
                    >
                      {quest.reward}
                    </Text>
                  </View>
                </View>

                <View style={{ marginTop: 16 }}>
                  {shouldShowStepSyncControls ? (
                    <View
                      className="rounded-2xl border border-primaryBorder bg-primaryTint p-3"
                      style={{ marginBottom: 16 }}
                    >
                      <Text className="font-nunito-bold text-sm text-primaryStrong">
                        {shouldShowActivationPrompt
                          ? t("quests.stepSyncPromptTitle")
                          : t("quests.stepSyncRefreshTitle")}
                      </Text>
                      <Text className="font-nunito text-sm text-primaryStrong mt-1">
                        {shouldShowActivationPrompt
                          ? stepSync.availability === "setup_required"
                            ? t("quests.stepSyncPromptSetupBody")
                            : t("quests.stepSyncPromptBody")
                          : t("quests.stepSyncRefreshBody")}
                      </Text>
                      {stepSync.lastError ? (
                        <Text className="font-nunito text-sm text-dangerDark mt-2">
                          {stepSync.lastError}
                        </Text>
                      ) : null}
                      <View className="flex-row flex-wrap items-center gap-3 mt-3">
                        <TouchableOpacity
                          onPress={() => {
                            void handleStepAction();
                          }}
                          disabled={stepSync.isSyncing}
                          style={{ borderRadius: 10, overflow: "hidden" }}
                        >
                          <LinearGradient
                            colors={[colors.gradStart, colors.gradEnd]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={{
                              minHeight: 40,
                              paddingHorizontal: 14,
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Text className="font-nunito-bold text-white">
                              {stepSync.isSyncing
                                ? t("settings.syncing")
                                : stepActionLabel}
                            </Text>
                          </LinearGradient>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => {
                            void handleForceRefresh();
                          }}
                          disabled={stepSync.isSyncing || isForceRefreshingStepQuest}
                        >
                          <Text className="font-nunito-bold text-sm text-primaryText">
                            {isForceRefreshingStepQuest
                              ? t("settings.syncing")
                              : t("quests.stepSyncPromptRefresh")}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : null}

                  <View className="flex-row justify-between mb-1">
                    <Text className="font-nunito text-xs text-fgMuted">
                      {t("quests.progress")}
                    </Text>
                    <Text
                      className="font-nunito-bold text-xs"
                      style={{ color: getProgressColor(status, tc) }}
                    >
                      {formatProgress(
                        progressDisplay.progress,
                        progressDisplay.target,
                      )}
                    </Text>
                  </View>
                  <View className="h-3 rounded-full overflow-hidden bg-primaryTint">
                    {status === "claimed" ? (
                      <View
                        style={{
                          width: `${progressDisplay.progressPct}%`,
                          backgroundColor: tc.muted,
                          height: "100%",
                        }}
                      />
                    ) : (
                      <LinearGradient
                        colors={[colors.gradStart, colors.gradEnd]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={{
                          width: `${progressDisplay.progressPct}%`,
                          height: "100%",
                        }}
                      />
                    )}
                  </View>
                  {isWordleQuest(quest.type) && quest.attemptsUsed != null ? (
                    <Text
                      className="font-nunito-bold text-xs text-center mt-1"
                      style={{
                        color:
                          status === "claimed"
                            ? tc.muted
                            : status === "failed"
                              ? tc.dangerDark
                              : status === "completed"
                                ? tc.successDark
                                : getMetaColor(status, tc),
                      }}
                    >
                      {quest.completed
                        ? t("quests.wordleSolvedIn", {
                            used: quest.attemptsUsed,
                            total: 6,
                          })
                        : t("quests.wordleAttemptsUsed", {
                            used: quest.attemptsUsed,
                            total: 6,
                          })}
                    </Text>
                  ) : null}
                  {isSpeedCalculusQuest(quest.type) ? (
                    <Text
                      className="font-nunito-bold text-xs text-center mt-1"
                      style={{ color: getMetaColor(status, tc) }}
                    >
                      {t("quests.speedCalculusQuestCardMeta", {
                        score: quest.latestScore ?? 0,
                        reward: quest.rewardPreview ?? quest.reward,
                        runs: quest.runsUsed ?? quest.progress,
                        total: quest.maxRuns ?? quest.target,
                      })}
                    </Text>
                  ) : null}
                </View>

                {quest.actionPath ? (
                  <View
                    style={{
                      marginTop: 16,
                      borderRadius: 12,
                    }}
                  >
                    <TouchableOpacity
                      onPress={() => void openQuest(quest)}
                      style={{ borderRadius: 12, overflow: "hidden" }}
                    >
                      {status === "claimed" ? (
                        <View
                          style={{
                            backgroundColor: tc.muted,
                            minHeight: 44,
                            paddingHorizontal: 16,
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                          className="items-center justify-center"
                        >
                          <Text
                            className="font-nunito-bold text-white"
                            style={{ textAlign: "center", lineHeight: 20 }}
                          >
                            {actionLabel}
                          </Text>
                        </View>
                      ) : (
                        <LinearGradient
                          colors={[colors.gradStart, colors.gradEnd]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          className="items-center justify-center"
                          style={{
                            minHeight: 44,
                            paddingHorizontal: 16,
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Text
                            className="font-nunito-bold text-white"
                            style={{ textAlign: "center", lineHeight: 20 }}
                          >
                            {actionLabel}
                          </Text>
                        </LinearGradient>
                      )}
                    </TouchableOpacity>
                  </View>
                ) : null}

                {quest.completed && !quest.claimed ? (
                  <View
                    style={{
                      marginTop: 16,
                      borderRadius: 12,
                    }}
                  >
                    <TouchableOpacity
                      onPress={() =>
                        void claimQuestMutation.mutateAsync(quest.id)
                      }
                      disabled={isClaimLoading}
                      style={{ borderRadius: 12, overflow: "hidden" }}
                    >
                      <LinearGradient
                        colors={[tc.success, tc.successDark]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        className="items-center flex-row justify-center gap-2"
                        style={{
                          minHeight: 44,
                          paddingHorizontal: 16,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {isClaimLoading ? (
                          <ActivityIndicator color="white" size="small" />
                        ) : (
                          <>
                            <SparklesIcon size={20} color="white" />
                            <Text
                              className="font-nunito-bold text-white"
                              style={{ textAlign: "center", lineHeight: 20 }}
                            >
                              {t("quests.claim")}
                            </Text>
                          </>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal
        visible={showDescriptionFor !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDescriptionFor(null)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "center",
            padding: 24,
          }}
        >
          {showDescriptionFor
            ? (() => {
                const status = getQuestStatus(showDescriptionFor);
                const colors = STATUS_COLORS[status];

                return (
                  <View
                    style={{
                      backgroundColor: tc.surface,
                      borderRadius: 16,
                      borderWidth: 3,
                      borderColor: colors.border,
                      padding: 24,
                      gap: 12,
                    }}
                  >
                    <View
                      style={{
                        position: "absolute",
                        top: -10,
                        right: -10,
                        backgroundColor: tc.surface,
                        borderRadius: 999,
                        borderWidth: 3,
                        borderColor: colors.border,
                        padding: 4,
                        shadowColor: "#000",
                        shadowOpacity: 0.15,
                        shadowRadius: 4,
                        shadowOffset: { width: 0, height: 2 },
                        elevation: 2,
                      }}
                    >
                      <HelpCircleIcon
                        size={18}
                        color={colors.border}
                        noCircle
                      />
                    </View>
                    <Text
                      className="font-nunito-bold text-lg text-fg text-center"
                      style={{
                        borderBottomWidth: 1,
                        borderBottomColor: tc.accentBorder,
                        paddingBottom: 12,
                      }}
                    >
                      {getQuestTitle(showDescriptionFor.title, t)}
                    </Text>
                    <Text className="font-nunito text-sm text-fgMuted">
                      {getQuestDesc(showDescriptionFor.description, t)}
                    </Text>
                    <TouchableOpacity
                      onPress={() => setShowDescriptionFor(null)}
                      className="rounded-xl overflow-hidden mt-2"
                    >
                      <LinearGradient
                        colors={[colors.gradStart, colors.gradEnd]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        className="py-3 items-center"
                      >
                        <Text className="font-nunito-bold text-white">
                          {t("common.close")}
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                );
              })()
            : null}
        </View>
      </Modal>
    </View>
  );
}
