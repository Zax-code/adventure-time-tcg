import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";

import { apiClient } from "../../src/lib/api";
import { useSessionStore } from "../../src/stores/session-store";
import {
  CheckCircleIcon,
  ClaimedIcon,
  CoinIcon,
  HelpCircleIcon,
  SparklesIcon,
  WalkingIcon,
  XCircleIcon,
} from "../../src/components/icons";
import type { QuestsResponse } from "@adventure-time/shared";
import { useTranslation } from "../../src/i18n";

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
  if (target >= 10000)
    return `${(progress / 1000).toFixed(1)}k / ${(target / 1000).toFixed(0)}k`;
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
    if (toast) {
      toastAnim.setValue(-60);
      Animated.timing(toastAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const questsQuery = useQuery({
    queryKey: ["quests"],
    queryFn: () => apiClient.quests(),
  });
  const claimQuestMutation = useMutation({
    mutationFn: (questId: string) => apiClient.claimQuest({ questId }),
    onSuccess: async (_data, questId) => {
      const quest = questsQuery.data?.quests.find((q) => q.id === questId);
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

  if (questsQuery.isLoading)
    return (
      <View className="flex-1 bg-bg p-6">
        <Text className="font-nunito text-fgMuted">
          {t("native.quests.loading")}
        </Text>
      </View>
    );
  if (questsQuery.isError || !questsQuery.data)
    return (
      <View className="flex-1 bg-bg p-6">
        <Text className="font-nunito text-red-600">
          {questsQuery.error?.message ?? t("native.quests.unavailable")}
        </Text>
      </View>
    );

  return (
    <View className="flex-1 bg-bg">
      {/* Toast */}
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

      <ScrollView className="flex-1" contentContainerClassName="gap-4 p-5">
        {/* Header */}
        <View className="items-center gap-1 mb-2">
          <Text
            className="font-nunito-extrabold text-3xl text-primaryDark"
            style={{ textShadowColor: 'rgba(0,0,0,0.15)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 }}
          >
            {t("native.quests.dailyTitle")}
          </Text>
          <Text
            className="font-nunito-medium text-sm text-center px-4"
            style={{ color: 'rgba(236,72,153,0.8)' }}
          >
            {t("native.quests.dailySubtitle")}
          </Text>
        </View>

        {!questsQuery.data.fitbitConnected && (
          <View style={{
            backgroundColor: '#CCFBF1', borderWidth: 1, borderColor: '#96F7E4',
            borderRadius: 16, padding: 16,
            shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              <WalkingIcon size={32} color="#14B8A6" />
              <View style={{ flex: 1 }}>
                <Text className="font-nunito-bold text-base" style={{ color: '#14B8A6' }}>
                  {t("native.quests.connectFitbitTitle")}
                </Text>
                <Text className="font-nunito text-sm mt-1" style={{ color: '#14B8A6' }}>
                  {t("native.quests.connectFitbitDesc")}
                </Text>
                <View style={{
                  marginTop: 12, alignSelf: 'flex-start',
                  shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6,
                  shadowOffset: { width: 0, height: 3 }, elevation: 4,
                  borderRadius: 8,
                }}>
                  <TouchableOpacity
                    onPress={() => router.push("/(tabs)/settings")}
                    style={{ borderRadius: 8, overflow: 'hidden' }}
                  >
                    <LinearGradient
                      colors={["#2DD4BF", "#14B8A6"]}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                      style={{ paddingHorizontal: 16, paddingVertical: 8 }}
                    >
                      <Text className="font-nunito text-white text-sm">
                        {t("native.quests.connectInSettings")}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        )}

        {questsQuery.data.quests.length === 0 && (
          <View style={{
            backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 16,
            borderWidth: 1, borderColor: '#F9A8D4', padding: 32, alignItems: 'center',
          }}>
            {questsQuery.data.fitbitConnected ? (
              <>
                <SparklesIcon size={48} color="#F9A8D4" />
                <Text className="font-nunito-bold text-base text-fgMuted mt-4">{t("native.quests.noQuests")}</Text>
                <Text className="font-nunito text-sm text-fgMuted mt-2 text-center">{t("native.quests.checkBackLater")}</Text>
              </>
            ) : (
              <>
                <WalkingIcon size={48} color="#F9A8D4" />
                <Text className="font-nunito-bold text-base text-fgMuted mt-4">{t("native.quests.connectFitbitTitle")}</Text>
                <Text className="font-nunito text-sm text-fgMuted mt-2 text-center">{t("native.quests.connectFitbitDesc")}</Text>
              </>
            )}
          </View>
        )}

        {questsQuery.data.quests.map((quest) => {
          const status = getQuestStatus(quest);
          const colors = STATUS_COLORS[status];
          const progressPct = Math.min(
            100,
            (quest.progress / quest.target) * 100,
          );
          const isClaimLoading =
            claimQuestMutation.isPending &&
            claimQuestMutation.variables === quest.id;

          const QuestIcon =
            quest.icon === "walking" ? WalkingIcon : SparklesIcon;
          let statusIcon;
          if (status === "completed")
            statusIcon = <CheckCircleIcon size={28} color={colors.iconColor} />;
          else if (status === "claimed")
            statusIcon = <ClaimedIcon size={28} color={colors.iconColor} />;
          else if (status === "failed")
            statusIcon = <XCircleIcon size={28} color={colors.iconColor} />;
          else statusIcon = <QuestIcon size={28} color={colors.iconColor} />;

          const actionLabel =
            status === "active"
              ? t("native.quests.playQuest")
              : t("native.quests.seeResults");

          return (
            <View
              key={quest.id}
              className="rounded-2xl p-4 gap-3"
              style={{
                backgroundColor: 'rgba(255,255,255,0.8)',
                borderWidth: 2, borderColor: colors.border,
                opacity: status === "claimed" ? 0.6 : 1,
                shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8,
                shadowOffset: { width: 0, height: 2 }, elevation: 2,
              }}
            >
              {/* Info button */}
              <TouchableOpacity
                style={{ position: "absolute", top: -8, right: -8, zIndex: 1 }}
                onPress={() => setShowDescriptionFor(quest)}
                hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
              >
                <View style={{
                  backgroundColor: 'rgba(255,255,255,0.8)',
                  borderRadius: 999, borderWidth: 2, borderColor: colors.border,
                  shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4,
                  shadowOffset: { width: 0, height: 2 }, elevation: 2,
                }}>
                  <HelpCircleIcon size={20} color={colors.border} noCircle />
                </View>
              </TouchableOpacity>

              {/* Row 1: Icon box + Title + Coin reward */}
              <View className="flex-row items-center gap-3">
                <View
                  style={{ backgroundColor: colors.iconBg }}
                  className="p-3 rounded-xl"
                >
                  {statusIcon}
                </View>
                <Text className="font-nunito-bold text-base text-fg flex-1">
                  {quest.title}
                </Text>
                <View className="flex-row items-center gap-1">
                  <CoinIcon size={18} />
                  <Text
                    style={{ color: "#EAB308" }}
                    className="font-nunito-bold text-base"
                  >
                    {quest.reward}
                  </Text>
                </View>
              </View>

              {/* Progress bar */}
              <View className="gap-1">
                <View className="flex-row justify-between">
                  <Text className="font-nunito text-xs text-fgMuted">
                    {t("native.quests.progress")}
                  </Text>
                  <Text className="font-nunito text-xs text-fgMuted">
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
                {quest.type === "wordle" &&
                quest.completed &&
                quest.attemptsUsed != null ? (
                  <Text className="font-nunito text-xs text-fgMuted text-center">
                    {t("native.quests.solvedInAttempts", {
                      used: quest.attemptsUsed,
                    })}
                  </Text>
                ) : null}
                {quest.type === "speed_calculus" ? (
                  <Text className="font-nunito text-xs text-fgMuted text-center">
                    {t("native.quests.speedSummary", {
                      score: quest.latestScore ?? 0,
                      reward: quest.rewardPreview ?? quest.reward,
                      used: quest.runsUsed ?? 0,
                      max: quest.maxRuns ?? 3,
                    })}
                  </Text>
                ) : null}
              </View>

              {/* Action button */}
              {quest.actionPath ? (
                <View style={{
                  shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6,
                  shadowOffset: { width: 0, height: 3 }, elevation: 4,
                  borderRadius: 12,
                }}>
                <TouchableOpacity
                  onPress={() => router.push(quest.actionPath as any)}
                  disabled={status === "claimed"}
                  style={{ borderRadius: 12, overflow: 'hidden' }}
                >
                  {status === "claimed" ? (
                    <View
                      style={{ backgroundColor: "#9CA3AF" }}
                      className="py-3 items-center"
                    >
                      <Text className="font-nunito-bold text-white">
                        {actionLabel}
                      </Text>
                    </View>
                  ) : (
                    <LinearGradient
                      colors={[colors.gradStart, colors.gradEnd]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      className="py-3 items-center"
                    >
                      <Text className="font-nunito-bold text-white">
                        {actionLabel}
                      </Text>
                    </LinearGradient>
                  )}
                </TouchableOpacity>
                </View>
              ) : null}

              {/* Claim button */}
              {quest.completed && !quest.claimed ? (
                <View style={{
                  shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6,
                  shadowOffset: { width: 0, height: 3 }, elevation: 4,
                  borderRadius: 12,
                }}>
                <TouchableOpacity
                  onPress={() => void claimQuestMutation.mutateAsync(quest.id)}
                  disabled={isClaimLoading}
                  style={{ borderRadius: 12, overflow: 'hidden' }}
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
                          {t("native.quests.claimReward")}
                        </Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>

      {/* Description modal */}
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
                      backgroundColor: "white",
                      borderRadius: 16,
                      borderWidth: 3,
                      borderColor: colors.border,
                      padding: 24,
                      gap: 12,
                    }}
                  >
                    <View style={{
                      position: 'absolute', top: -10, right: -10,
                      backgroundColor: 'white', borderRadius: 999, borderWidth: 3, borderColor: colors.border,
                      padding: 4,
                      shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2,
                    }}>
                      <HelpCircleIcon size={18} color={colors.border} noCircle />
                    </View>
                    <Text className="font-nunito-bold text-lg text-fg text-center" style={{ borderBottomWidth: 1, borderBottomColor: '#E5E7EB', paddingBottom: 12 }}>
                      {showDescriptionFor.title}
                    </Text>
                    <Text className="font-nunito text-sm text-fgMuted">
                      {showDescriptionFor.description}
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
