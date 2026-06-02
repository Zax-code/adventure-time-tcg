import { useMemo, useState, type ReactNode } from "react";
import { Text, View } from "react-native";

import type { PvpAction, PvpEndTurnInput } from "@adventure-time/api-client";

import { ChevronRightIcon, ClockIcon, XCircleIcon } from "../../components/icons";
import { ThemedExpoButton } from "../../components/expo-ui/themed-button";
import { useTranslation } from "../../i18n";
import { ActionButtons } from "./action-buttons";
import { ActionModal } from "./action-modal";
import { BenchCard } from "./bench-card";
import { CardInfoModal } from "./card-info-modal";
import { CombatLogModal } from "./combat-log-modal";
import { ResultsScreen } from "./results-screen";
import { TargetSelectionHint } from "./target-selection-hint";
import { TurnBanner } from "./turn-banner";
import { UnitCard } from "./unit-card";
import type { FloatingEvent, MyMatchView, SwapSelection, TargetingMode } from "./types";

interface BattleBoardProps {
  matchView: MyMatchView;
  newEvents: FloatingEvent[];
  isActing: boolean;
  pendingSwap: SwapSelection;
  isSwapMode: boolean;
  onSelectUnit: (instanceId: string) => void;
  onSelectTarget: (instanceId: string) => void;
  onSelectBench: (instanceId: string) => void;
  onUnitLongPress: (instanceId: string) => void;
  onSwapToggle: () => void;
  onCancelTargeting: () => void;
  onEndTurn: () => void;
  onConcede: () => void;
  onBack: () => void;
  targeting: TargetingMode | null;
  onEnterTargeting: (mode: Omit<TargetingMode, "validTargetIds"> & { validTargetIds?: string[] }) => void;
  submitAction: (action: PvpAction) => void;
  submitEndTurn: (input?: PvpEndTurnInput) => void;
  readOnly?: boolean;
  bottomOverlay?: ReactNode;
}

function sortByPosition<T extends { position?: number | null }>(items: T[]) {
  return [...items].sort((a, b) => (a.position ?? 99) - (b.position ?? 99));
}

const overlayButtonStyle = {
  width: 36,
  height: 36,
  minWidth: 36,
  minHeight: 36,
  borderRadius: 8,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  backgroundColor: "rgba(255,255,255,0.85)",
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.12,
  shadowRadius: 2,
  elevation: 2,
};

const overlayButtonAppearance = {
  backgroundColor: "rgba(255,255,255,0.85)",
  borderColor: "rgba(255,255,255,0.85)",
  borderRadius: 8,
  foregroundColor: "#334155",
  gradientColors: null,
  minHeight: 36,
  paddingHorizontal: 0,
  paddingVertical: 0,
  textStyle: {
    fontFamily: "Nunito_700Bold",
    fontSize: 14,
  },
} as const;

export function BattleBoard({
  matchView,
  newEvents,
  isActing,
  pendingSwap,
  isSwapMode,
  onSelectUnit,
  onSelectTarget,
  onSelectBench,
  onUnitLongPress,
  onSwapToggle,
  onCancelTargeting,
  onEndTurn,
  onConcede,
  onBack,
  targeting,
  onEnterTargeting,
  submitAction,
  submitEndTurn,
  readOnly = false,
  bottomOverlay,
}: BattleBoardProps) {
  const { t } = useTranslation();
  const { myPlayer, opponentPlayer, isMyTurn, turn, phase, winnerId, myUserId, abilityDefinitions } = matchView;

  const [showActionModal, setShowActionModal] = useState(false);
  const [selectedActorId, setSelectedActorId] = useState<string | null>(null);
  const [showLogModal, setShowLogModal] = useState(false);
  const [longPressUnitId, setLongPressUnitId] = useState<string | null>(null);
  const [turnBannerState, setTurnBannerState] = useState(() => ({
    turn,
    bannerKey: 0,
    visible: true,
  }));

  if (turnBannerState.turn !== turn) {
    setTurnBannerState((current) => ({
      turn,
      bannerKey: current.bannerKey + 1,
      visible: true,
    }));
  }

  const floatingByUnit = useMemo(() => {
    const next: Record<string, FloatingEvent[]> = {};
    for (const event of newEvents) {
      if (!next[event.targetInstanceId]) {
        next[event.targetInstanceId] = [];
      }
      next[event.targetInstanceId].push(event);
    }
    return next;
  }, [newEvents]);

  const sortedMyUnits = useMemo(() => sortByPosition(myPlayer.units), [myPlayer.units]);
  const sortedOpponentUnits = useMemo(() => sortByPosition(opponentPlayer.units), [opponentPlayer.units]);
  const selectedActor = selectedActorId ? sortedMyUnits.find((unit) => unit.instanceId === selectedActorId) ?? null : null;
  const actorType = selectedActor?.type;
  const hasBench = myPlayer.bench.some((unit) => unit.hp > 0);

  const longPressUnit = longPressUnitId
    ? [...myPlayer.units, ...myPlayer.bench, ...opponentPlayer.units, ...opponentPlayer.bench].find(
        (unit) => unit.instanceId === longPressUnitId,
      ) ?? null
    : null;

  const hint = readOnly
    ? t("pvp.board.hint.waiting")
    : isMyTurn
    ? targeting
      ? targeting.stage === "copy-source"
        ? t("pvp.board.hint.copySource")
        : targeting.targetLabel === "ally"
          ? t("pvp.board.hint.ally")
          : targeting.targetLabel === "any"
            ? t("pvp.board.hint.any")
            : targeting.targetLabel === "copy source"
              ? t("pvp.board.hint.sourceUnit")
              : t("pvp.board.hint.highlighted")
      : isSwapMode
        ? t("pvp.board.hint.swap")
        : t("pvp.board.hint.actions")
    : t("pvp.board.hint.waiting");

  const isOverlayOpen = showActionModal || showLogModal || longPressUnit !== null;

  const handleUnitPress = (instanceId: string) => {
    if (readOnly) {
      return;
    }

    if (targeting) {
      if (targeting.validTargetIds.includes(instanceId)) {
        onSelectTarget(instanceId);
      }
      return;
    }

    if (isSwapMode) {
      onSelectUnit(instanceId);
      return;
    }

    if (!isMyTurn || isOverlayOpen) {
      return;
    }

    const unit = myPlayer.units.find((entry) => entry.instanceId === instanceId);
    if (!unit || unit.hp <= 0 || unit.statuses.some((status) => status.name === "SummoningSickness")) {
      return;
    }

    setSelectedActorId(instanceId);
    setShowActionModal(true);
  };

  const handleOppUnitPress = (instanceId: string) => {
    if (readOnly) {
      return;
    }

    if (targeting?.validTargetIds.includes(instanceId)) {
      onSelectTarget(instanceId);
    }
  };

  const handleBenchPress = (instanceId: string) => {
    if (readOnly) {
      return;
    }

    if (targeting?.validTargetIds.includes(instanceId)) {
      onSelectTarget(instanceId);
      return;
    }

    if (isSwapMode) {
      onSelectBench(instanceId);
    }
  };

  const handleLongPress = (instanceId: string) => {
    if (showActionModal) {
      return;
    }
    setLongPressUnitId(instanceId);
    onUnitLongPress(instanceId);
  };

  return (
    <View className="flex-1 bg-bg px-12 py-2">
      <View className="relative z-10 flex-1 justify-center" style={{ gap: 2 }}>
        <View
          className="relative min-h-0 flex-1 rounded-xl bg-danger px-1.5 py-1.5"
          style={{
            shadowColor: "#f9a8d4",
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 1,
            shadowRadius: 10,
            elevation: 8,
          }}
        >
          <View className="absolute left-1 right-1 top-1 z-20 flex-row items-center justify-between">
            <ThemedExpoButton
              onPress={onBack}
              preferFallback
              variant="ghost"
              fallbackAppearance={overlayButtonAppearance}
              style={overlayButtonStyle}
            >
              <View style={{ transform: [{ rotate: "180deg" }] }}>
                <ChevronRightIcon size={16} color="#7f1d1d" />
              </View>
            </ThemedExpoButton>

            <View className="flex-row" style={{ gap: 6 }}>
              <ThemedExpoButton
                onPress={() => setShowLogModal(true)}
                preferFallback
                variant="ghost"
                fallbackAppearance={overlayButtonAppearance}
                style={overlayButtonStyle}
              >
                <ClockIcon size={15} color="#334155" />
              </ThemedExpoButton>
              {!readOnly ? (
                <ThemedExpoButton
                  onPress={onConcede}
                  preferFallback
                  variant="ghost"
                  fallbackAppearance={overlayButtonAppearance}
                  style={overlayButtonStyle}
                >
                  <XCircleIcon size={15} color="#e11d48" />
                </ThemedExpoButton>
              ) : null}
            </View>
          </View>

          <View className="absolute bottom-0 left-1 right-1 z-20 flex-row items-center justify-between">
            <View className="rounded-full bg-rose-900/80 px-3 py-1">
              <Text className="font-nunito-bold text-xs text-white">{opponentPlayer.name}</Text>
            </View>
            <View className="flex-row items-center rounded-full bg-secondaryBorder/90 px-4 py-1">
              <Text className="font-nunito-bold text-xs text-secondaryText">⚡ {opponentPlayer.energy}</Text>
            </View>
          </View>

          <View className="h-full justify-between">
            <View className="h-[46px] flex-row items-center px-1" style={{ gap: 10 }}>
              <Text style={{ color: "rgba(127,29,29,0.8)", fontSize: 11, fontFamily: "Nunito_700Bold", letterSpacing: 1.4 }}>
                {t("pvp.board.bench")}
              </Text>
              {opponentPlayer.bench.map((unit) => (
                <View key={unit.instanceId} style={{ height: "100%", width: 64 }}>
                  <BenchCard
                    unit={unit}
                    onPress={() => handleOppUnitPress(unit.instanceId)}
                    onLongPress={() => handleLongPress(unit.instanceId)}
                  />
                </View>
              ))}
            </View>

            <View className="flex-row items-center justify-between" style={{ gap: 6, height: 76 }}>
              {sortedOpponentUnits.map((unit) => (
                <View key={unit.instanceId} style={{ width: "29.75%" }}>
                  <UnitCard
                    unit={unit}
                    isValidTarget={targeting?.validTargetIds.includes(unit.instanceId) ?? false}
                    attackerType={actorType}
                    onPress={() => handleOppUnitPress(unit.instanceId)}
                    onLongPress={() => handleLongPress(unit.instanceId)}
                    floatingEvents={floatingByUnit[unit.instanceId] ?? []}
                  />
                </View>
              ))}
            </View>
          </View>
        </View>

        <View
          className="rounded-full bg-accent px-2"
          style={{
            height: 32,
            justifyContent: "center",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.15,
            shadowRadius: 4,
            elevation: 4,
          }}
        >
          <View className="w-full items-center justify-center px-4">
             <Text className="font-nunito-semibold text-[11px] text-white">{t("pvp.board.turnLabel", { turn, hint })}</Text>
          </View>
        </View>

        <View
          className="relative min-h-0 flex-1 rounded-xl bg-info px-1.5 py-1.5"
          style={{
            shadowColor: "#1d4ed8",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.75,
            shadowRadius: 10,
            elevation: 8,
          }}
        >
          <View className="absolute left-1 right-1 top-0 z-20 flex-row items-center justify-between">
            <View className="flex-row items-center rounded-full bg-secondaryBorder/90 px-4 py-1">
              <Text className="font-nunito-bold text-xs text-secondaryText">⚡ {myPlayer.energy}</Text>
            </View>
            <View className="rounded-full bg-sky-900/80 px-3 py-1">
              <Text className="font-nunito-bold text-xs text-white">{myPlayer.name}</Text>
            </View>
          </View>

          <View className="h-full justify-between">
            <View className="flex-row items-center justify-between" style={{ gap: 6, height: 76, marginTop: 18 }}>
              {sortedMyUnits.map((unit) => (
                <View key={unit.instanceId} style={{ width: "29.75%" }}>
                  <UnitCard
                    unit={unit}
                    isSelected={selectedActorId === unit.instanceId && showActionModal}
                    isValidTarget={targeting?.validTargetIds.includes(unit.instanceId) ?? false}
                    canSelectAsActor={isMyTurn && !targeting && !isSwapMode && unit.hp > 0}
                    onPress={() => handleUnitPress(unit.instanceId)}
                    onLongPress={() => handleLongPress(unit.instanceId)}
                    floatingEvents={floatingByUnit[unit.instanceId] ?? []}
                  />
                </View>
              ))}
            </View>

            <View className="h-[46px] flex-row items-center justify-end px-1" style={{ gap: 10 }}>
              {myPlayer.bench.map((unit) => (
                <View key={unit.instanceId} style={{ height: "100%", width: 64 }}>
                  <BenchCard
                    unit={unit}
                    isSelected={pendingSwap?.activeInstanceId === unit.instanceId}
                    isSwapTarget={isSwapMode}
                    isValidTarget={targeting?.validTargetIds.includes(unit.instanceId) ?? false}
                    onPress={() => handleBenchPress(unit.instanceId)}
                    onLongPress={() => handleLongPress(unit.instanceId)}
                  />
                </View>
              ))}
              <Text style={{ color: "rgba(30,64,175,0.8)", fontSize: 11, fontFamily: "Nunito_700Bold", letterSpacing: 1.4 }}>
                {t("pvp.board.bench")}
              </Text>
            </View>
          </View>

          {!readOnly ? (
            <ActionButtons
              isSwapMode={isSwapMode}
              isTargeting={targeting !== null}
              hasBench={hasBench}
              isMyTurn={isMyTurn}
              isActing={isActing}
              onSwapToggle={onSwapToggle}
              onCancel={onCancelTargeting}
              onEndTurn={onEndTurn}
            />
          ) : null}
        </View>
      </View>

      {!readOnly ? <TargetSelectionHint targeting={targeting} /> : null}

      {!readOnly && turnBannerState.visible ? (
        <TurnBanner
          key={turnBannerState.bannerKey}
          isMyTurn={isMyTurn}
          onDone={() =>
            setTurnBannerState((current) => ({ ...current, visible: false }))
          }
        />
      ) : null}

      {!readOnly ? (
        <ResultsScreen
          phase={phase}
          winnerId={winnerId}
          myUserId={myUserId}
          opponentName={opponentPlayer.name}
          onBack={onBack}
        />
      ) : null}

      <ActionModal
        visible={showActionModal}
        unit={selectedActor ?? null}
        matchView={matchView}
        onClose={() => {
          setShowActionModal(false);
          setSelectedActorId(null);
        }}
        onSelectAction={(mode) => {
          onEnterTargeting(mode);
        }}
        onSubmitAction={(action) => {
          submitAction(action);
          setShowActionModal(false);
          setSelectedActorId(null);
        }}
      />

      <CombatLogModal visible={showLogModal} log={matchView.log} onClose={() => setShowLogModal(false)} />

      <CardInfoModal
        visible={longPressUnit !== null && !showActionModal}
        unit={longPressUnit}
        abilityDefinitions={abilityDefinitions}
        onClose={() => setLongPressUnitId(null)}
      />

      {bottomOverlay ? (
        <View pointerEvents="box-none" className="absolute bottom-3 left-0 right-0 items-center px-6">
          {bottomOverlay}
        </View>
      ) : null}
    </View>
  );
}
