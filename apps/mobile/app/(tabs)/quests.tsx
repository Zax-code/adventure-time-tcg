import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import type { QuestsResponse } from "@adventure-time/shared";

import {
  CheckCircleIcon,
  ClaimedIcon,
  CoinIcon,
  HelpCircleIcon,
  SparklesIcon,
  WalkingIcon,
  XCircleIcon,
} from "../../src/components/icons";
import { useTranslation } from "../../src/i18n";
import { apiClient } from "../../src/lib/api";
import { useSessionStore } from "../../src/stores/session-store";

type QuestStatus = "active" | "completed" | "claimed" | "failed";
type Quest = QuestsResponse["quests"][number];

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
    border: "#F9A8D4",
    iconBg: "#FCE7F3",
    iconColor: "#DB2777",
    gradStart: "#F472B6",
    gradEnd: "#EC4899",
  },
  completed: {
    border: "#96F7E4",
    iconBg: "#CCFBF1",
    iconColor: "#14B8A6",
    gradStart: "#2DD4BF",
    gradEnd: "#14B8A6",
  },
  claimed: {
    border: "#D1D5DB",
    iconBg: "#E5E7EB",
    iconColor: "#9CA3AF",
    gradStart: "#9CA3AF",
    gradEnd: "#9CA3AF",
  },
  failed: {
    border: "#FECDD3",
    iconBg: "#FFE4E6",
    iconColor: "#F43F5E",
    gradStart: "#FB7185",
    gradEnd: "#F43F5E",
  },
};

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

function getProgressColor(status: QuestStatus) {
  if (status === "claimed") return "#6B7280";
  if (status === "completed") return "#0F766E";
  if (status === "failed") return "#BE123C";
  return "#7C3AED";
}

function getMetaColor(status: QuestStatus) {
  if (status === "claimed") return "#6B7280";
  if (status === "completed") return "#0F766E";
  return "#831843";
}

function isWordleQuest(questType: string) {
  return questType === "wordle_daily";
}

function isSpeedCalculusQuest(questType: string) {
  return questType === "speed_calculus_daily";
}

export default function QuestsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const accessToken = useSessionStore((state) => state.accessToken);
  const refreshToken = useSessionStore((state) => state.refreshToken);
  const setSession = useSessionStore((state) => state.setSession);
  const { t } = useTranslation();

  const [showDescriptionFor, setShowDescriptionFor] = useState<Quest | null>(
    null,
  );
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const toastAnim = useRef(new Animated.Value(-60)).current;

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

  const questsQuery = useQuery({
    queryKey: ["quests"],
    queryFn: () => apiClient.quests(),
  });

  const claimQuestMutation = useMutation({
    mutationFn: (questId: string) => apiClient.claimQuest({ questId }),
    onSuccess: async (_data, questId) => {
      const quest = questsQuery.data?.quests.find((entry) => entry.id === questId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["quests"] }),
        queryClient.invalidateQueries({ queryKey: ["home"] }),
      ]);

      if (accessToken && refreshToken) {
        const me = await apiClient.me();
        await setSession({ user: me, accessToken, refreshToken });
      }

      setToast({
        message: t("native.quests.claimSuccess", {
          amount: quest?.reward ?? 0,
        }),
        type: "success",
      });
    },
    onError: () => {
      setToast({ message: t("native.quests.claimFailed"), type: "error" });
    },
  });

  if (questsQuery.isLoading) {
    return (
      <View className="flex-1 bg-bg items-center justify-center px-6">
        <ActivityIndicator size="large" color="#EC4899" />
        <Text className="font-nunito text-fgMuted mt-4">
          {t("native.quests.loading")}
        </Text>
      </View>
    );
  }

  if (questsQuery.isError || !questsQuery.data) {
    return (
      <View className="flex-1 bg-bg p-6">
        <Text className="font-nunito text-red-600">
          {questsQuery.error?.message ?? t("native.quests.unavailable")}
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-bg">
      {toast ? (
        <Animated.View
          style={{
            position: "absolute",
            top: 16,
            left: 16,
            right: 16,
            zIndex: 50,
            transform: [{ translateY: toastAnim }],
          }}
        >
          <View
            style={{
              backgroundColor: toast.type === "success" ? "#16A34A" : "#DC2626",
            }}
            className="rounded-xl p-4 shadow-lg"
          >
            <Text className="font-nunito-bold text-white">{toast.message}</Text>
          </View>
        </Animated.View>
      ) : null}

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: 16,
          paddingBottom: 20,
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
              color: "rgba(236,72,153,0.8)",
              textAlign: "center",
            }}
          >
            {t("quests.subtitle")}
          </Text>
        </View>

        {!questsQuery.data.fitbitConnected ? (
          <View
            style={{
              backgroundColor: "#CCFBF1",
              borderWidth: 1,
              borderColor: "#96F7E4",
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
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
              <WalkingIcon size={32} color="#14B8A6" />
              <View style={{ flex: 1 }}>
                <Text className="font-nunito-bold text-base" style={{ color: "#14B8A6" }}>
                  {t("settings.connectFitbit")}
                </Text>
                <Text className="font-nunito text-sm mt-1" style={{ color: "#14B8A6" }}>
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
                    onPress={() => router.push("/(tabs)/settings")}
                    style={{ borderRadius: 8, overflow: "hidden" }}
                  >
                    <LinearGradient
                      colors={["#2DD4BF", "#14B8A6"]}
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
            style={{
              backgroundColor: "rgba(255,255,255,0.6)",
              borderRadius: 16,
              borderWidth: 1,
              borderColor: "#F9A8D4",
              padding: 32,
              alignItems: "center",
            }}
          >
            {questsQuery.data.fitbitConnected ? (
              <>
                <SparklesIcon size={48} color="#F9A8D4" />
                <Text className="font-nunito-bold text-base text-fgMuted mt-4">
                  {t("quests.noQuests")}
                </Text>
                <Text className="font-nunito text-sm text-fgMuted mt-2 text-center">
                  {t("quests.checkBackLater")}
                </Text>
              </>
            ) : (
              <>
                <WalkingIcon size={48} color="#F9A8D4" />
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
            const progressPct = quest.completed
              ? 100
              : Math.min(100, (quest.progress / quest.target) * 100);
            const isClaimLoading =
              claimQuestMutation.isPending && claimQuestMutation.variables === quest.id;
            const QuestIcon = quest.icon === "walking" ? WalkingIcon : SparklesIcon;
            const title = getQuestTitle(quest.title, t);
            const actionLabel =
              status === "active" ? t("quests.playQuest") : t("quests.seeResults");

            let statusIcon;
            if (status === "completed") {
              statusIcon = <CheckCircleIcon size={28} color={colors.iconColor} />;
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
                  backgroundColor: "rgba(255,255,255,0.8)",
                  borderWidth: 2,
                  borderColor: colors.border,
                  opacity: status === "claimed" ? 0.6 : 1,
                  shadowColor: "#000",
                  shadowOpacity: 0.1,
                  shadowRadius: 8,
                  shadowOffset: { width: 0, height: 2 },
                  elevation: 2,
                  marginBottom: index === questsQuery.data.quests.length - 1 ? 0 : 12,
                }}
              >
                <TouchableOpacity
                  style={{ position: "absolute", top: -8, right: -8, zIndex: 1 }}
                  onPress={() => setShowDescriptionFor(quest)}
                  hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                >
                  <View
                    style={{
                      backgroundColor: "rgba(255,255,255,0.8)",
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
                    <Text className="font-nunito-bold text-base text-fg">{title}</Text>
                  </View>

                  <View className="flex-row items-center gap-1">
                    <CoinIcon size={18} />
                    <Text style={{ color: "#EAB308" }} className="font-nunito-bold text-base">
                      {quest.reward}
                    </Text>
                  </View>
                </View>

                <View style={{ marginTop: 16 }}>
                  <View className="flex-row justify-between mb-1">
                    <Text className="font-nunito text-xs text-fgMuted">
                      {t("quests.progress")}
                    </Text>
                    <Text
                      className="font-nunito-bold text-xs"
                      style={{ color: getProgressColor(status) }}
                    >
                      {formatProgress(quest.progress, quest.target)}
                    </Text>
                  </View>
                  <View className="h-3 rounded-full overflow-hidden bg-gray-100">
                    {status === "claimed" ? (
                      <View
                        style={{
                          width: `${progressPct}%`,
                          backgroundColor: "#9CA3AF",
                          height: "100%",
                        }}
                      />
                    ) : (
                      <LinearGradient
                        colors={[colors.gradStart, colors.gradEnd]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={{ width: `${progressPct}%`, height: "100%" }}
                      />
                    )}
                  </View>
                  {isWordleQuest(quest.type) &&
                  quest.completed &&
                  quest.attemptsUsed != null ? (
                    <Text
                      className="font-nunito-bold text-xs text-center mt-1"
                      style={{ color: status === "claimed" ? "#6B7280" : "#0F766E" }}
                    >
                      {t("quests.wordleSolvedIn", {
                        used: quest.attemptsUsed,
                        total: 6,
                      })}
                    </Text>
                  ) : null}
                  {isSpeedCalculusQuest(quest.type) ? (
                    <Text
                      className="font-nunito-bold text-xs text-center mt-1"
                      style={{ color: getMetaColor(status) }}
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
                      shadowColor: "#000",
                      shadowOpacity: 0.15,
                      shadowRadius: 6,
                      shadowOffset: { width: 0, height: 3 },
                      elevation: 4,
                      borderRadius: 12,
                      alignSelf: "stretch",
                    }}
                  >
                    <TouchableOpacity
                      onPress={() => router.push(quest.actionPath as never)}
                      disabled={status === "claimed"}
                      style={{ borderRadius: 12, overflow: "hidden", width: "100%" }}
                    >
                      {status === "claimed" ? (
                        <View
                          style={{ backgroundColor: "#9CA3AF" }}
                          className="py-3 items-center justify-center"
                        >
                          <Text className="font-nunito-bold text-white">{actionLabel}</Text>
                        </View>
                      ) : (
                        <LinearGradient
                          colors={[colors.gradStart, colors.gradEnd]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          className="py-3 items-center justify-center"
                        >
                          <Text className="font-nunito-bold text-white">{actionLabel}</Text>
                        </LinearGradient>
                      )}
                    </TouchableOpacity>
                  </View>
                ) : null}

                {quest.completed && !quest.claimed ? (
                  <View
                    style={{
                      marginTop: 16,
                      shadowColor: "#000",
                      shadowOpacity: 0.15,
                      shadowRadius: 6,
                      shadowOffset: { width: 0, height: 3 },
                      elevation: 4,
                      borderRadius: 12,
                      alignSelf: "stretch",
                    }}
                  >
                    <TouchableOpacity
                      onPress={() => void claimQuestMutation.mutateAsync(quest.id)}
                      disabled={isClaimLoading}
                      style={{ borderRadius: 12, overflow: "hidden", width: "100%" }}
                    >
                      <LinearGradient
                        colors={["#2DD4BF", "#14B8A6"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        className="py-3 items-center flex-row justify-center gap-2"
                      >
                        {isClaimLoading ? (
                          <ActivityIndicator color="white" size="small" />
                        ) : (
                          <>
                            <SparklesIcon size={20} color="white" />
                            <Text className="font-nunito-bold text-white">
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
          {showDescriptionFor ? (
            (() => {
              const status = getQuestStatus(showDescriptionFor);
              const colors = STATUS_COLORS[status];

              return (
                <View
                  style={{
                    backgroundColor: "white",
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
                      backgroundColor: "white",
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
                    <HelpCircleIcon size={18} color={colors.border} noCircle />
                  </View>
                  <Text
                    className="font-nunito-bold text-lg text-fg text-center"
                    style={{
                      borderBottomWidth: 1,
                      borderBottomColor: "#E5E7EB",
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
          ) : null}
        </View>
      </Modal>
    </View>
  );
}
