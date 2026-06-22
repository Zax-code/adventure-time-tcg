import { useEffect, useState } from "react";
import { Pressable, StatusBar, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";

import type { PvpAction } from "@adventure-time/api-client";

import { PageLoadingState } from "../src/components/loading-state";
import { PageErrorState } from "../src/components/error-state";
import { ThemedExpoButton } from "../src/components/expo-ui/themed-button";
import { useThemeStore } from "../src/stores/theme-store";
import { THEME_COLORS, THEME_VARS } from "../src/theme/themes";
import { BattleBoard } from "../src/features/pvp/battle-board";
import { ActionModal } from "../src/features/pvp/action-modal";
import { CardInfoModal } from "../src/features/pvp/card-info-modal";
import { CombatLogModal } from "../src/features/pvp/combat-log-modal";
import { useMatch } from "../src/features/pvp/use-match";
import {
  type MyMatchView,
  prepareCopyFollowUp,
  type TargetingMode,
  type SwapSelection,
} from "../src/features/pvp/types";
import { useTranslation } from "../src/i18n";

type E2EMatchModal =
  | "action"
  | "my-card-info"
  | "opponent-card-info"
  | "log"
  | "end-turn"
  | "concede";

type TargetingModeInput = Omit<TargetingMode, "validTargetIds"> & {
  validTargetIds?: string[];
};

const e2eAuthEnabled = process.env.EXPO_PUBLIC_E2E_AUTH === "1";

function parseE2EModal(
  value: string | string[] | undefined,
): E2EMatchModal | null {
  if (!e2eAuthEnabled || typeof value !== "string") {
    return null;
  }

  if (
    value === "action" ||
    value === "my-card-info" ||
    value === "opponent-card-info" ||
    value === "log" ||
    value === "end-turn" ||
    value === "concede"
  ) {
    return value;
  }

  return null;
}

function parseMatchRouteId(value: string | undefined) {
  const fallback = {
    matchId: value ?? "",
    e2eModal: null as E2EMatchModal | null,
  };
  if (!value) {
    return fallback;
  }

  const [matchId, marker, modal] = value.split("::");
  if (marker !== "e2e") {
    return fallback;
  }

  return {
    matchId,
    e2eModal: parseE2EModal(modal),
  };
}

function normalizeTargetingMode(mode: TargetingModeInput): TargetingMode {
  return {
    ...mode,
    validTargetIds: mode.validTargetIds ?? [],
  };
}

export default function PvpMatchScreen() {
  const { id, e2eModal } = useLocalSearchParams<{
    id: string;
    e2eModal?: string;
  }>();
  const router = useRouter();
  const themeName = useThemeStore((s) => s.themeName);
  const { t } = useTranslation();
  const routeMatch = parseMatchRouteId(id);
  const initialE2EModal = parseE2EModal(e2eModal) ?? routeMatch.e2eModal;

  const {
    matchView,
    isLoading,
    isError,
    rawMatch,
    isActing,
    newEvents,
    submitAction,
    submitEndTurn,
    concede,
  } = useMatch(routeMatch.matchId);

  const [targeting, setTargeting] = useState<TargetingMode | null>(null);
  const [pendingSwap, setPendingSwap] = useState<SwapSelection>(null);
  const [isSwapMode, setIsSwapMode] = useState(false);
  const [showEndTurnConfirm, setShowEndTurnConfirm] = useState(false);
  const [showConcedeConfirm, setShowConcedeConfirm] = useState(false);

  useEffect(() => {
    ScreenOrientation.lockAsync(
      ScreenOrientation.OrientationLock.LANDSCAPE,
    ).catch(() => {});
    return () => {
      ScreenOrientation.lockAsync(
        ScreenOrientation.OrientationLock.DEFAULT,
      ).catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (!initialE2EModal) {
      return;
    }

    if (initialE2EModal === "end-turn") {
      setShowEndTurnConfirm(true);
    } else if (initialE2EModal === "concede") {
      setShowConcedeConfirm(true);
    }
  }, [initialE2EModal]);

  const submitSwapSelection = (
    activeInstanceId: string,
    benchInstanceId: string,
  ) => {
    setIsSwapMode(false);
    setPendingSwap(null);
    submitEndTurn({ swap: { activeInstanceId, benchInstanceId } });
  };

  const updatePendingSwap = (selection: NonNullable<SwapSelection>) => {
    setPendingSwap((current) => ({
      ...(current ?? {}),
      ...selection,
    }));
  };

  const handleSelectUnit = (activeInstanceId: string) => {
    if (!isSwapMode) return;

    if (pendingSwap?.benchInstanceId) {
      submitSwapSelection(activeInstanceId, pendingSwap.benchInstanceId);
    } else {
      updatePendingSwap({ activeInstanceId });
    }
  };

  const handleSelectTarget = (targetInstanceId: string) => {
    if (!targeting || !matchView) return;

    if (targeting.actionKind === "copy" && targeting.stage === "copy-source") {
      const followUp = prepareCopyFollowUp(
        matchView.battleState,
        targeting.actorInstanceId,
        targeting.abilityKey!,
        targetInstanceId,
      );
      if (!followUp) {
        setTargeting(null);
        return;
      }

      if (!followUp.requiresTargetSelection) {
        submitAction({
          kind: "copy",
          actorInstanceId: followUp.actorInstanceId,
          abilityKey: followUp.abilityKey!,
          sourceInstanceId: targetInstanceId,
        });
        setTargeting(null);
        return;
      }

      setTargeting({
        actorInstanceId: followUp.actorInstanceId,
        actionKind: "copy",
        abilityKey: followUp.abilityKey,
        sourceInstanceId: targetInstanceId,
        copiedAbilityKey: followUp.copiedAbilityKey,
        stage: "target",
        targetLabel: followUp.targetLabel,
        validTargetIds: followUp.validTargetIds,
      });
      return;
    }

    const { actorInstanceId, actionKind, abilityKey } = targeting;

    let action: PvpAction;
    if (actionKind === "basic") {
      action = { kind: "basic", actorInstanceId, targetInstanceId };
    } else if (actionKind === "skill") {
      action = {
        kind: "skill",
        actorInstanceId,
        abilityKey: abilityKey!,
        targetInstanceId,
      };
    } else if (actionKind === "ultimate") {
      action = {
        kind: "ultimate",
        actorInstanceId,
        abilityKey: abilityKey!,
        targetInstanceId,
      };
    } else if (actionKind === "copy") {
      action = {
        kind: "copy",
        actorInstanceId,
        abilityKey: abilityKey!,
        sourceInstanceId: targeting.sourceInstanceId!,
        targetInstanceId,
      };
    } else {
      action = { kind: "pass" };
    }

    submitAction(action);
    setTargeting(null);
  };

  const handleSelectBench = (benchInstanceId: string) => {
    if (!isSwapMode) return;

    if (pendingSwap?.activeInstanceId) {
      submitSwapSelection(pendingSwap.activeInstanceId, benchInstanceId);
    } else {
      updatePendingSwap({ benchInstanceId });
    }
  };

  const handleSwapToggle = () => {
    if (isSwapMode) {
      setIsSwapMode(false);
      setPendingSwap(null);
    } else {
      setIsSwapMode(true);
      setTargeting(null);
    }
  };

  const handleCancelTargeting = () => {
    setTargeting(null);
    setIsSwapMode(false);
    setPendingSwap(null);
  };

  const handleEndTurn = () => {
    if (matchView && matchView.myPlayer.energy > 0) {
      setShowEndTurnConfirm(true);
    } else {
      submitEndTurn();
    }
  };

  const handleConcede = () => {
    setShowConcedeConfirm(true);
  };

  const handleActionSelected = (mode: TargetingModeInput) => {
    setTargeting(normalizeTargetingMode(mode));
  };

  if (isLoading) {
    return (
      <PageLoadingState
        title={t("pvp.match.loading")}
        message={t("common.loadingStates.battleBody")}
        icon="shield"
      />
    );
  }

  if (isError) {
    return (
      <PageErrorState
        title={t("pvp.match.loadFailed")}
        onBack={() => router.back()}
      />
    );
  }

  if (!matchView) {
    const message =
      rawMatch?.status === "COMPLETED"
        ? t("pvp.match.ended")
        : rawMatch?.status === "EXPIRED"
          ? t("pvp.match.expiredInvite")
          : rawMatch?.status === "DECLINED"
            ? t("pvp.match.declinedInvite")
            : t("pvp.match.notReady");

    return (
      <View style={[styles.loading, THEME_VARS[themeName] as any]}>
        <Text style={styles.loadingText}>{message}</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.loadingText}>{t("pvp.match.goBack")}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, THEME_VARS[themeName] as any]}>
      <StatusBar hidden />

      <BattleBoard
        matchView={matchView}
        newEvents={newEvents}
        turnExpiresAt={rawMatch?.turnExpiresAt ?? null}
        isActing={isActing}
        pendingSwap={pendingSwap}
        isSwapMode={isSwapMode}
        targeting={targeting}
        onSelectUnit={handleSelectUnit}
        onSelectTarget={handleSelectTarget}
        onSelectBench={handleSelectBench}
        onUnitLongPress={() => {}}
        onSwapToggle={handleSwapToggle}
        onCancelTargeting={handleCancelTargeting}
        onEndTurn={handleEndTurn}
        onConcede={handleConcede}
        onBack={() => router.back()}
        onEnterTargeting={handleActionSelected}
        submitAction={(action) => {
          submitAction(action);
          setTargeting(null);
        }}
        submitEndTurn={submitEndTurn}
      />

      <E2EMatchModalRenderer
        initialE2EModal={initialE2EModal}
        matchView={matchView}
      />

      <ConfirmDialog
        visible={showEndTurnConfirm}
        title={t("pvp.match.endTurnTitle")}
        body={t("pvp.match.endTurnBody", { energy: matchView.myPlayer.energy })}
        confirmLabel={t("pvp.match.endTurnConfirm")}
        testID="pvp-end-turn-confirm-modal"
        confirmButtonTestID="pvp-end-turn-confirm-button"
        onCancel={() => setShowEndTurnConfirm(false)}
        onConfirm={() => {
          setShowEndTurnConfirm(false);
          submitEndTurn();
        }}
      />

      <ConfirmDialog
        visible={showConcedeConfirm}
        title={t("pvp.match.concedeTitle")}
        body={t("pvp.match.concedeBody")}
        confirmLabel={t("pvp.match.concedeConfirm")}
        testID="pvp-concede-confirm-modal"
        confirmButtonTestID="pvp-concede-confirm-button"
        danger
        onCancel={() => setShowConcedeConfirm(false)}
        onConfirm={() => {
          setShowConcedeConfirm(false);
          concede();
          router.back();
        }}
      />
    </View>
  );
}

function E2EMatchModalRenderer({
  initialE2EModal,
  matchView,
}: {
  initialE2EModal: E2EMatchModal | null;
  matchView: MyMatchView;
}) {
  if (!initialE2EModal) {
    return null;
  }

  const unit =
    initialE2EModal === "opponent-card-info"
      ? (matchView.opponentPlayer.units.find((candidate) => candidate.hp > 0) ??
        null)
      : (matchView.myPlayer.units.find((candidate) => candidate.hp > 0) ??
        null);

  if (initialE2EModal === "action") {
    return (
      <ActionModal
        visible={true}
        unit={unit}
        matchView={matchView}
        onClose={() => {}}
        onSelectAction={() => {}}
        onSubmitAction={() => {}}
      />
    );
  }

  if (
    initialE2EModal === "my-card-info" ||
    initialE2EModal === "opponent-card-info"
  ) {
    return (
      <CardInfoModal
        visible={true}
        unit={unit}
        abilityDefinitions={matchView.abilityDefinitions}
        onClose={() => {}}
      />
    );
  }

  if (initialE2EModal === "log") {
    return (
      <CombatLogModal
        visible={true}
        log={matchView.log}
        battleState={matchView.battleState}
        onClose={() => {}}
      />
    );
  }

  return null;
}

function ConfirmDialog({
  visible,
  title,
  body,
  confirmLabel,
  testID,
  confirmButtonTestID,
  onCancel,
  onConfirm,
  danger = false,
}: {
  visible: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  testID: string;
  confirmButtonTestID: string;
  onCancel: () => void;
  onConfirm: () => void;
  danger?: boolean;
}) {
  const { t } = useTranslation();
  const themeName = useThemeStore((state) => state.themeName);
  const tc = THEME_COLORS[themeName];

  if (!visible) {
    return null;
  }

  return (
    <View
      className="items-center justify-center px-5 py-8"
      style={[StyleSheet.absoluteFill, styles.confirmBackdrop]}
      testID={`${testID}-backdrop-container`}
    >
      <Pressable
        accessibilityRole="button"
        className="absolute inset-0"
        onPress={onCancel}
        testID={`${testID}-backdrop`}
      />

      <View
        className="w-full max-w-[480px] rounded-[28px] border border-primaryTint bg-surface px-5 py-6"
        style={styles.confirmDialog}
        testID={testID}
      >
        <Text className="text-center font-nunito-extrabold text-3xl text-fg">
          {title}
        </Text>
        <Text className="mt-4 text-center font-nunito text-base leading-6 text-fgMuted">
          {body}
        </Text>

        <View className="mt-6 flex-row gap-3">
          <ThemedExpoButton
            onPress={onCancel}
            testID={`${testID}-cancel-button`}
            fallbackAppearance={{
              backgroundColor: tc.surfaceMuted,
              borderColor: "transparent",
              borderRadius: 16,
              paddingHorizontal: 16,
              paddingVertical: 12,
              gradientColors: null,
              foregroundColor: tc.fgMuted,
              textStyle: {
                fontFamily: "Nunito_700Bold",
                fontSize: 14,
              },
            }}
            style={{ flex: 1 }}
            variant="ghost"
          >
            {t("common.cancel")}
          </ThemedExpoButton>
          <ThemedExpoButton
            onPress={onConfirm}
            testID={confirmButtonTestID}
            fallbackAppearance={{
              backgroundColor: danger ? tc.dangerDark : tc.primaryDark,
              borderColor: "transparent",
              borderRadius: 16,
              paddingHorizontal: 16,
              paddingVertical: 12,
              gradientColors: null,
              foregroundColor: "#FFFFFF",
              textStyle: {
                fontFamily: "Nunito_700Bold",
                fontSize: 14,
              },
            }}
            style={{ flex: 1 }}
            variant={danger ? "danger" : "primary"}
          >
            {confirmLabel}
          </ThemedExpoButton>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff0f5",
  },
  loading: {
    flex: 1,
    backgroundColor: "#fff0f5",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    color: "#9CA3AF",
    fontSize: 14,
  },
  confirmBackdrop: {
    backgroundColor: "rgba(0,0,0,0.72)",
  },
  confirmDialog: {
    borderCurve: "continuous",
  },
});
