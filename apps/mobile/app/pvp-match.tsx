import { useEffect, useState } from "react";
import {
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";

import type { PvpAction } from "@adventure-time/api-client";

import { PageLoadingState } from "../src/components/loading-state";
import { PageErrorState } from "../src/components/error-state";
import { useThemeStore } from "../src/stores/theme-store";
import { THEME_VARS } from "../src/theme/themes";
import { BattleBoard } from "../src/features/pvp/battle-board";
import { BattleFullScreenSheet } from "../src/features/pvp/battle-full-screen-sheet";
import { useMatch } from "../src/features/pvp/use-match";
import { prepareCopyFollowUp, type TargetingMode, type SwapSelection } from "../src/features/pvp/types";
import { useTranslation } from "../src/i18n";

export default function PvpMatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const themeName = useThemeStore((s) => s.themeName);
  const { t } = useTranslation();

  const { matchView, isLoading, isError, rawMatch, isActing, newEvents, submitAction, submitEndTurn, concede } =
    useMatch(id ?? "");

  const [targeting, setTargeting] = useState<TargetingMode | null>(null);
  const [pendingSwap, setPendingSwap] = useState<SwapSelection>(null);
  const [isSwapMode, setIsSwapMode] = useState(false);
  const [showEndTurnConfirm, setShowEndTurnConfirm] = useState(false);
  const [showConcedeConfirm, setShowConcedeConfirm] = useState(false);

  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.DEFAULT).catch(() => {});
    };
  }, []);

  const handleSelectUnit = (instanceId: string) => {
    if (isSwapMode) {
      setPendingSwap({ activeInstanceId: instanceId });
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
      action = { kind: "skill", actorInstanceId, abilityKey: abilityKey!, targetInstanceId };
    } else if (actionKind === "ultimate") {
      action = { kind: "ultimate", actorInstanceId, abilityKey: abilityKey!, targetInstanceId };
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
    if (!isSwapMode || !pendingSwap) return;
    const swap = { activeInstanceId: pendingSwap.activeInstanceId, benchInstanceId };
    setIsSwapMode(false);
    setPendingSwap(null);
    submitEndTurn({ swap });
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

  const handleActionSelected = (
    mode: Omit<TargetingMode, "validTargetIds"> & { validTargetIds?: string[] },
  ) => {
    setTargeting({
      actorInstanceId: mode.actorInstanceId,
      actionKind: mode.actionKind,
      abilityKey: mode.abilityKey,
      validTargetIds: mode.validTargetIds ?? [],
    });
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

      <ConfirmSheet
        visible={showEndTurnConfirm}
        title={t("pvp.match.endTurnTitle")}
        body={t("pvp.match.endTurnBody", { energy: matchView.myPlayer.energy })}
        confirmLabel={t("pvp.match.endTurnConfirm")}
        onCancel={() => setShowEndTurnConfirm(false)}
        onConfirm={() => {
          setShowEndTurnConfirm(false);
          submitEndTurn();
        }}
      />

      <ConfirmSheet
        visible={showConcedeConfirm}
        title={t("pvp.match.concedeTitle")}
        body={t("pvp.match.concedeBody")}
        confirmLabel={t("pvp.match.concedeConfirm")}
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

function ConfirmSheet({
  visible,
  title,
  body,
  confirmLabel,
  onCancel,
  onConfirm,
  danger = false,
}: {
  visible: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  danger?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <BattleFullScreenSheet
      visible={visible}
      title={title}
      onClose={onCancel}
      footer={
        <View className="flex-row gap-3">
          <Pressable onPress={onCancel} className="flex-1 rounded-2xl bg-surfaceMuted px-4 py-3">
            <Text className="text-center font-nunito-bold text-fgMuted">{t("common.cancel")}</Text>
          </Pressable>
          <Pressable onPress={onConfirm} className={`flex-1 rounded-2xl px-4 py-3 ${danger ? "bg-dangerDark" : "bg-primaryDark"}`}>
            <Text className="text-center font-nunito-bold text-white">{confirmLabel}</Text>
          </Pressable>
        </View>
      }
    >
      <View className="flex-1 items-center justify-center px-6 py-10">
        <View className="w-full max-w-[520px] rounded-[28px] border border-primaryTint bg-white px-6 py-8">
          <Text className="text-center font-nunito-extrabold text-3xl text-fg">{title}</Text>
          <Text className="mt-4 text-center font-nunito text-base leading-6 text-fgMuted">{body}</Text>
        </View>
      </View>
    </BattleFullScreenSheet>
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
});
