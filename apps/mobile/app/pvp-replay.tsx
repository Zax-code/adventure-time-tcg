import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Pressable, StatusBar, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import { PageLoadingState } from "../src/components/loading-state";
import { ThemedExpoButton } from "../src/components/expo-ui/themed-button";
import { PageErrorState } from "../src/components/error-state";
import {
  PauseIcon,
  PlayIcon,
  SkipBackIcon,
  SkipForwardIcon,
} from "../src/components/icons";
import { buildPvpVisualEvents } from "../src/features/pvp/animation-events";
import { BattleBoard } from "../src/features/pvp/battle-board";
import { buildReplayTurnViews } from "../src/features/pvp/read-only-view";
import { useLandscapeOrientationLock } from "../src/hooks/use-orientation-lock";
import { useTranslation } from "../src/i18n";
import { apiClient } from "../src/lib/api";
import { useSessionStore } from "../src/stores/session-store";
import { useThemeStore } from "../src/stores/theme-store";
import { THEME_COLORS, THEME_VARS } from "../src/theme/themes";

export default function PvpReplayScreen() {
  useLandscapeOrientationLock();

  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const themeName = useThemeStore((state) => state.themeName);
  const tc = THEME_COLORS[themeName];
  const currentUserId = useSessionStore((state) => state.user?.id ?? "");
  const { t } = useTranslation();

  const [currentTurnIndex, setCurrentTurnIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 2>(1);

  const { data: replayQueryData, error: replayQueryError, isError: replayQueryIsError, isLoading: replayQueryIsLoading, refetch: replayQueryRefetch } = useQuery({
    queryKey: ["pvp-history", id],
    queryFn: () => apiClient.pvpHistoryDetail(id ?? ""),
    enabled: Boolean(id),
    retry: 0,
  });

  const turnViews = useMemo(
    () => buildReplayTurnViews(replayQueryData?.replay, currentUserId),
    [currentUserId, replayQueryData?.replay],
  );

  const currentTurnView =
    turnViews[Math.max(0, Math.min(currentTurnIndex, turnViews.length - 1))] ??
    null;
  const visualEvents = useMemo(
    () =>
      currentTurnView
        ? buildPvpVisualEvents(currentTurnView.events)
        : buildPvpVisualEvents([]),
    [currentTurnView],
  );

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

  if (replayQueryIsLoading) {
    return (
      <PageLoadingState
        title={t("pvp.loadingReplay")}
        message={t("common.loadingStates.battleBody")}
        icon="play-back"
      />
    );
  }

  if (replayQueryIsError) {
    return (
      <PageErrorState
        error={replayQueryError}
        title={t("pvp.failedLoadReplay")}
        onRetry={() => {
          void replayQueryRefetch();
        }}
        onBack={() => router.push("/pvp-history" as never)}
      />
    );
  }

  if (!currentTurnView) {
    return (
      <View style={[styles.loading, THEME_VARS[themeName] as never]}>
        <Text style={styles.loadingText}>{t("pvp.replayNotAvailable")}</Text>
        <ThemedExpoButton
          onPress={() => router.push("/pvp-history" as never)}
          preferFallback
          variant="ghost"
          fallbackAppearance={{
            backgroundColor: "rgba(255,255,255,0.1)",
            borderColor: "rgba(255,255,255,0.1)",
            borderRadius: 12,
            foregroundColor: "#FFFFFF",
            gradientColors: null,
            minHeight: 0,
            paddingHorizontal: 16,
            paddingVertical: 10,
            textStyle: {
              fontFamily: "Nunito_700Bold",
              fontSize: 16,
            },
          }}
        >
          {t("pvp.backToPvp")}
        </ThemedExpoButton>
      </View>
    );
  }

  const handleTogglePlayback = () => {
    if (currentTurnIndex >= turnViews.length - 1) {
      setCurrentTurnIndex(0);
    }

    setIsPlaying((current) => !current);
  };

  const replayProgress =
    turnViews.length <= 1
      ? 1
      : currentTurnIndex / Math.max(1, turnViews.length - 1);

  return (
    <View style={[styles.container, THEME_VARS[themeName] as never]}>
      <StatusBar hidden />

      <BattleBoard
        matchView={currentTurnView.matchView}
        newEvents={visualEvents.floatingEvents}
        unitAnimationEvents={visualEvents.unitAnimationEvents}
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
        middleOverlay={
          <ReplayControlDeck
            title={t("pvp.replay")}
            turn={currentTurnView.turn}
            totalTurns={turnViews.length}
            progress={replayProgress}
            isPlaying={isPlaying}
            speed={playbackSpeed}
            colors={tc}
            labels={{
              previous: t("pvp.replayPrevious"),
              next: t("pvp.replayNext"),
              play: t("pvp.replayPlay"),
              pause: t("pvp.replayPause"),
            }}
            onPrevious={() => {
              setIsPlaying(false);
              setCurrentTurnIndex((current) => Math.max(0, current - 1));
            }}
            onTogglePlayback={handleTogglePlayback}
            onNext={() => {
              setIsPlaying(false);
              setCurrentTurnIndex((current) =>
                Math.min(turnViews.length - 1, current + 1),
              );
            }}
            onToggleSpeed={() =>
              setPlaybackSpeed((current) => (current === 1 ? 2 : 1))
            }
          />
        }
      />
    </View>
  );
}

function ReplayControlDeck({
  title,
  turn,
  totalTurns,
  progress,
  isPlaying,
  speed,
  colors,
  labels,
  onPrevious,
  onTogglePlayback,
  onNext,
  onToggleSpeed,
}: {
  title: string;
  turn: number;
  totalTurns: number;
  progress: number;
  isPlaying: boolean;
  speed: 1 | 2;
  colors: (typeof THEME_COLORS)[keyof typeof THEME_COLORS];
  labels: {
    previous: string;
    next: string;
    play: string;
    pause: string;
  };
  onPrevious: () => void;
  onTogglePlayback: () => void;
  onNext: () => void;
  onToggleSpeed: () => void;
}) {
  const clampedProgress = Math.max(0, Math.min(1, progress));
  const progressLabel = `${title} T${turn} / ${totalTurns}`;
  const quietControlBg = withHexAlpha(colors.fg, "20");

  return (
    <View className="h-full flex-row items-center gap-3">
      <View className="h-9 min-w-[58px] items-center justify-center rounded-full bg-fg/10 px-2">
        <Text
          className="font-nunito-extrabold text-[12px] text-fg"
          numberOfLines={1}
        >
          T{turn}
        </Text>
        <Text
          className="font-nunito-bold text-[9px] text-fgMuted"
          numberOfLines={1}
        >
          / {totalTurns}
        </Text>
      </View>

      <View
        accessibilityLabel={progressLabel}
        className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-fg/10"
      >
        <View
          className="h-full rounded-full"
          style={{
            width: `${clampedProgress * 100}%`,
            backgroundColor: colors.secondary,
          }}
        />
      </View>

      <View className="flex-row items-center justify-center gap-2">
        <PlaybackButton
          backgroundColor={quietControlBg}
          label={labels.previous}
          onPress={onPrevious}
        >
          <SkipBackIcon size={16} color={colors.fg} />
        </PlaybackButton>
        <PlaybackButton
          primary
          backgroundColor={colors.secondary}
          label={isPlaying ? labels.pause : labels.play}
          onPress={onTogglePlayback}
        >
          {isPlaying ? (
            <PauseIcon size={18} color={colors.secondaryText} />
          ) : (
            <PlayIcon size={18} color={colors.secondaryText} />
          )}
        </PlaybackButton>
        <PlaybackButton
          backgroundColor={quietControlBg}
          label={labels.next}
          onPress={onNext}
        >
          <SkipForwardIcon size={16} color={colors.fg} />
        </PlaybackButton>
        <Pressable
          accessibilityLabel={`${speed}x`}
          accessibilityRole="button"
          onPress={onToggleSpeed}
          className="h-8 min-w-10 items-center justify-center rounded-full px-2"
          style={{
            backgroundColor: quietControlBg,
            boxShadow: "0 8px 16px rgba(15,23,42,0.12)",
          }}
        >
          <Text
            className="font-nunito-extrabold text-[12px]"
            style={{ color: colors.fg }}
          >
            {speed}x
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function PlaybackButton({
  backgroundColor,
  children,
  label,
  onPress,
  primary = false,
}: {
  backgroundColor: string;
  children: ReactNode;
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      className={`items-center justify-center rounded-full ${
        primary ? "h-10 w-11" : "h-8 w-8"
      }`}
      style={({ pressed }) => ({
        backgroundColor,
        opacity: pressed ? 0.82 : 1,
        transform: [{ scale: pressed ? 0.96 : 1 }],
        boxShadow: primary
          ? "0 10px 18px rgba(245,158,11,0.22)"
          : "0 8px 16px rgba(15,23,42,0.12)",
      })}
    >
      {children}
    </Pressable>
  );
}

function withHexAlpha(color: string, alpha: string) {
  return color.startsWith("#") && color.length === 7
    ? `${color}${alpha}`
    : color;
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
};
