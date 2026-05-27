import { useEffect, useMemo, useState } from "react";
import { Pressable, StatusBar, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import * as ScreenOrientation from "expo-screen-orientation";

import { PageLoadingState } from "../src/components/loading-state";
import type { FloatingEvent } from "../src/features/pvp/types";
import { BattleBoard } from "../src/features/pvp/battle-board";
import {
  buildReplayTurnViews,
  type ReplayTurnView,
} from "../src/features/pvp/read-only-view";
import {
  getEventAmount,
  getEventTargetInstanceId,
  isCritEvent,
  isMissEvent,
} from "../src/features/pvp/event-payload";
import { useTranslation } from "../src/i18n";
import { apiClient } from "../src/lib/api";
import { useSessionStore } from "../src/stores/session-store";
import { useThemeStore } from "../src/stores/theme-store";
import { THEME_VARS } from "../src/theme/themes";

function buildFloatingEvents(events: ReplayTurnView["events"]): FloatingEvent[] {
  const next: FloatingEvent[] = [];

  for (const event of events) {
    if (event.type === "damage" || event.type === "crit") {
      const targetInstanceId = getEventTargetInstanceId(event) ?? "";
      const amount = getEventAmount(event) ?? 0;

      if (targetInstanceId) {
        next.push({
          seq: event.seq,
          targetInstanceId,
          type: isMissEvent(event)
            ? "miss"
            : isCritEvent(event)
              ? "crit"
              : "damage",
          amount,
        });
      }
    } else if (event.type === "heal") {
      const targetInstanceId = getEventTargetInstanceId(event) ?? "";
      const amount = getEventAmount(event) ?? 0;

      if (targetInstanceId && amount > 0) {
        next.push({
          seq: event.seq,
          targetInstanceId,
          type: "heal",
          amount,
        });
      }
    }
  }

  return next;
}

export default function PvpReplayScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const themeName = useThemeStore((state) => state.themeName);
  const currentUserId = useSessionStore((state) => state.user?.id ?? "");
  const { t } = useTranslation();

  const [currentTurnIndex, setCurrentTurnIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 2>(1);

  const replayQuery = useQuery({
    queryKey: ["pvp-history", id],
    queryFn: () => apiClient.pvpHistoryDetail(id ?? ""),
    enabled: Boolean(id),
    retry: 0,
  });

  const turnViews = useMemo(
    () => buildReplayTurnViews(replayQuery.data?.replay, currentUserId),
    [currentUserId, replayQuery.data?.replay],
  );

  const currentTurnView =
    turnViews[Math.max(0, Math.min(currentTurnIndex, turnViews.length - 1))] ?? null;
  const floatingEvents = useMemo(
    () => (currentTurnView ? buildFloatingEvents(currentTurnView.events) : []),
    [currentTurnView],
  );

  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.DEFAULT).catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (turnViews.length === 0) {
      setCurrentTurnIndex(0);
      setIsPlaying(false);
      return;
    }

    setCurrentTurnIndex((current) => Math.min(current, turnViews.length - 1));
  }, [turnViews.length]);

  useEffect(() => {
    if (!isPlaying || turnViews.length <= 1) {
      return;
    }

    const interval = setInterval(() => {
      setCurrentTurnIndex((current) => {
        if (current >= turnViews.length - 1) {
          setIsPlaying(false);
          return current;
        }

        return current + 1;
      });
    }, 2000 / playbackSpeed);

    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed, turnViews.length]);

  if (replayQuery.isLoading) {
    return (
      <PageLoadingState
        title={t("pvp.loadingReplay")}
        message={t("common.loadingStates.battleBody")}
        icon="play-back"
      />
    );
  }

  if (replayQuery.isError) {
    return (
      <View style={[styles.loading, THEME_VARS[themeName] as never]}>
        <Text style={styles.loadingText}>
          {replayQuery.error instanceof Error
            ? replayQuery.error.message
            : t("pvp.failedLoadReplay")}
        </Text>
        <Text style={styles.linkText} onPress={() => router.push("/pvp-history" as never)}>
          {t("pvp.backToPvp")}
        </Text>
      </View>
    );
  }

  if (!currentTurnView) {
    return (
      <View style={[styles.loading, THEME_VARS[themeName] as never]}>
        <Text style={styles.loadingText}>{t("pvp.replayNotAvailable")}</Text>
        <Text style={styles.linkText} onPress={() => router.push("/pvp-history" as never)}>
          {t("pvp.backToPvp")}
        </Text>
      </View>
    );
  }

  const handleTogglePlayback = () => {
    if (currentTurnIndex >= turnViews.length - 1) {
      setCurrentTurnIndex(0);
    }

    setIsPlaying((current) => !current);
  };

  return (
    <View style={[styles.container, THEME_VARS[themeName] as never]}>
      <StatusBar hidden />

      <BattleBoard
        matchView={currentTurnView.matchView}
        newEvents={floatingEvents}
        isActing={false}
        pendingSwap={null}
        isSwapMode={false}
        targeting={null}
        onSelectUnit={() => {}}
        onSelectTarget={() => {}}
        onSelectBench={() => {}}
        onUnitLongPress={() => {}}
        onSwapToggle={() => {}}
        onCancelTargeting={() => {}}
        onEndTurn={() => {}}
        onConcede={() => {}}
        onBack={() => router.push("/pvp-history" as never)}
        onEnterTargeting={(_mode) => {}}
        submitAction={(_action) => {}}
        submitEndTurn={(_input) => {}}
        readOnly
        bottomOverlay={
          <View className="w-full max-w-xl rounded-2xl bg-slate-950/85 px-4 py-3">
            <Text className="text-center font-nunito-bold text-sm text-white">
              {t("pvp.replay")} · T{currentTurnView.turn} / {turnViews.length}
            </Text>
            <View className="mt-3 flex-row items-center justify-center gap-3">
              <Pressable
                onPress={() => {
                  setIsPlaying(false);
                  setCurrentTurnIndex((current) => Math.max(0, current - 1));
                }}
                className="rounded-xl bg-white/10 px-4 py-2"
              >
                <Text className="font-nunito-bold text-white">{t("pvp.replayPrevious")}</Text>
              </Pressable>
              <Pressable
                onPress={handleTogglePlayback}
                className="rounded-xl bg-primary px-5 py-2"
              >
                <Text className="font-nunito-bold text-white">
                  {isPlaying ? t("pvp.replayPause") : t("pvp.replayPlay")}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setIsPlaying(false);
                  setCurrentTurnIndex((current) => Math.min(turnViews.length - 1, current + 1));
                }}
                className="rounded-xl bg-white/10 px-4 py-2"
              >
                <Text className="font-nunito-bold text-white">{t("pvp.replayNext")}</Text>
              </Pressable>
              <Pressable
                onPress={() => setPlaybackSpeed((current) => (current === 1 ? 2 : 1))}
                className="rounded-xl bg-white/10 px-4 py-2"
              >
                <Text className="font-nunito-bold text-white">
                  {playbackSpeed}x
                </Text>
              </Pressable>
            </View>
          </View>
        }
      />
    </View>
  );
}

const styles = {
  container: {
    flex: 1,
  },
  loading: {
    flex: 1,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    paddingHorizontal: 24,
    gap: 12,
  },
  loadingText: {
    color: "#fff",
    fontSize: 18,
    fontFamily: "Nunito_700Bold",
    textAlign: "center" as const,
  },
  linkText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Nunito_700Bold",
  },
};
