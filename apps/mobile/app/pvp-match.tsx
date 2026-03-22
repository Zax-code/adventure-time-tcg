import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";

import type { PvpAction } from "@adventure-time/shared";

import { useThemeStore } from "../src/stores/theme-store";
import { THEME_VARS } from "../src/theme/themes";
import { BattleBoard } from "../src/features/pvp/battle-board";
import { useMatch } from "../src/features/pvp/use-match";
import type { TargetingMode, SwapSelection } from "../src/features/pvp/types";

export default function PvpMatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const themeName = useThemeStore((s) => s.themeName);

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
    if (!targeting) return;
    const { actorInstanceId, actionKind, abilityKey } = targeting;

    let action: PvpAction;
    if (actionKind === "basic") {
      action = { kind: "basic", actorInstanceId, targetInstanceId };
    } else if (actionKind === "skill") {
      action = { kind: "skill", actorInstanceId, abilityKey: abilityKey!, targetInstanceId };
    } else if (actionKind === "ultimate") {
      action = { kind: "ultimate", actorInstanceId, abilityKey: abilityKey!, targetInstanceId };
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
      <View style={[styles.loading, THEME_VARS[themeName] as any]}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>Loading match...</Text>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={[styles.loading, THEME_VARS[themeName] as any]}>
        <Text style={styles.loadingText}>Failed to load match.</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.loadingText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  if (!matchView) {
    return (
      <View style={[styles.loading, THEME_VARS[themeName] as any]}>
        <Text style={styles.loadingText}>
          {rawMatch?.status === "COMPLETED" ? "Match has ended." : "Match not ready yet."}
        </Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.loadingText}>Go Back</Text>
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

      {/* End turn confirm */}
      <Modal visible={showEndTurnConfirm} transparent animationType="fade">
        <View style={styles.confirmBackdrop}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>End Turn?</Text>
            <Text style={styles.confirmBody}>
              You still have {matchView.myPlayer.energy} energy remaining.
            </Text>
            <View style={styles.confirmBtns}>
              <Pressable style={styles.confirmCancel} onPress={() => setShowEndTurnConfirm(false)}>
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.confirmOk}
                onPress={() => {
                  setShowEndTurnConfirm(false);
                  submitEndTurn();
                }}
              >
                <Text style={styles.confirmOkText}>End Turn</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Concede confirm */}
      <Modal visible={showConcedeConfirm} transparent animationType="fade">
        <View style={styles.confirmBackdrop}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Concede?</Text>
            <Text style={styles.confirmBody}>
              This will count as a loss. Are you sure?
            </Text>
            <View style={styles.confirmBtns}>
              <Pressable style={styles.confirmCancel} onPress={() => setShowConcedeConfirm(false)}>
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.confirmOk, { backgroundColor: "#EF4444" }]}
                onPress={() => {
                  setShowConcedeConfirm(false);
                  concede();
                  router.back();
                }}
              >
                <Text style={styles.confirmOkText}>Concede</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  confirmCard: {
    backgroundColor: "#1F2937",
    borderRadius: 16,
    padding: 24,
    width: "80%",
    maxWidth: 320,
  },
  confirmTitle: {
    color: "#fff",
    fontSize: 18,
    fontFamily: "Nunito_700Bold",
    marginBottom: 8,
  },
  confirmBody: {
    color: "#9CA3AF",
    fontSize: 14,
    marginBottom: 20,
  },
  confirmBtns: {
    flexDirection: "row",
    gap: 10,
  },
  confirmCancel: {
    flex: 1,
    backgroundColor: "#374151",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
  },
  confirmCancelText: {
    color: "#D1D5DB",
    fontSize: 14,
    fontFamily: "Nunito_700Bold",
  },
  confirmOk: {
    flex: 1,
    backgroundColor: "#3B82F6",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
  },
  confirmOkText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Nunito_700Bold",
  },
});
