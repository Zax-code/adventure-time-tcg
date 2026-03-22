import { useMemo, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";

import type { PvpAction, PvpEndTurnInput } from "@adventure-time/shared";

import { ChevronRightIcon, ClockIcon, XCircleIcon } from "../../components/icons";
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
}

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
}: BattleBoardProps) {
  const { myPlayer, opponentPlayer, isMyTurn, turn, phase, winnerId, myUserId, abilityDefinitions } = matchView;

  const [showActionModal, setShowActionModal] = useState(false);
  const [selectedActorId, setSelectedActorId] = useState<string | null>(null);
  const [showLogModal, setShowLogModal] = useState(false);
  const [longPressUnitId, setLongPressUnitId] = useState<string | null>(null);
  const [showTurnBanner, setShowTurnBanner] = useState(true);
  const prevTurnRef = useRef(turn);
  const [bannerKey, setBannerKey] = useState(0);

  // Show banner on turn change
  useMemo(() => {
    if (prevTurnRef.current !== turn) {
      prevTurnRef.current = turn;
      setBannerKey((k) => k + 1);
      setShowTurnBanner(true);
    }
  }, [turn]);

  // Per-unit floating events
  const floatingByUnit = useMemo(() => {
    const map: Record<string, FloatingEvent[]> = {};
    for (const e of newEvents) {
      if (!map[e.targetInstanceId]) map[e.targetInstanceId] = [];
      map[e.targetInstanceId].push(e);
    }
    return map;
  }, [newEvents]);

  const selectedActor = selectedActorId
    ? myPlayer.units.find((u) => u.instanceId === selectedActorId)
    : null;

  const actorType = selectedActor?.type;
  const hasBench = myPlayer.bench.some((u) => u.hp > 0);

  const handleUnitPress = (instanceId: string) => {
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
    if (!isMyTurn) return;
    const unit = myPlayer.units.find((u) => u.instanceId === instanceId);
    if (!unit || unit.hp <= 0) return;
    setSelectedActorId(instanceId);
    setShowActionModal(true);
  };

  const handleOppUnitPress = (instanceId: string) => {
    if (targeting && targeting.validTargetIds.includes(instanceId)) {
      onSelectTarget(instanceId);
    }
  };

  const handleBenchPress = (instanceId: string) => {
    if (isSwapMode) {
      onSelectBench(instanceId);
    }
  };

  const handleLongPress = (instanceId: string) => {
    setLongPressUnitId(instanceId);
    onUnitLongPress(instanceId);
  };

  const longPressUnit =
    longPressUnitId
      ? [...myPlayer.units, ...myPlayer.bench, ...opponentPlayer.units, ...opponentPlayer.bench].find(
          (u) => u.instanceId === longPressUnitId,
        )
      : null;

  const hint = isMyTurn
    ? targeting
      ? null
      : isSwapMode
      ? "Tap active unit to swap"
      : "Tap your unit to act"
    : "Waiting for opponent...";

  const overlayBtnStyle = {
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
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  };

  return (
    <View
      className="flex-1 bg-bg flex-col justify-center"
      style={{ paddingHorizontal: 40, paddingVertical: 8, gap: 4 }}
    >
      {/* ── Opponent lane ── */}
      <View
        className="flex-1 min-h-0 rounded-xl bg-danger"
        style={{
          padding: 6,
          shadowColor: "#F9A8D4",
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 1,
          shadowRadius: 10,
          elevation: 8,
        }}
      >
        {/* Overlay controls: Back | Name·Energy | Log | Concede */}
        <View className="flex-row items-center justify-between" style={{ marginBottom: 4 }}>
          <Pressable onPress={onBack} style={overlayBtnStyle}>
            <ChevronRightIcon size={16} color="#9D174D" />
          </Pressable>

          <View className="flex-row items-center" style={{ gap: 6 }}>
            <View style={{ backgroundColor: "rgba(244,63,94,0.85)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}>
              <Text style={{ color: "#fff", fontSize: 12, fontFamily: "Nunito_700Bold" }}>{opponentPlayer.name}</Text>
            </View>
            <View style={{ backgroundColor: "rgba(254,240,138,0.9)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, flexDirection: "row", alignItems: "center", gap: 2 }}>
              <Text style={{ color: "#854D0E", fontSize: 12, fontFamily: "Nunito_700Bold" }}>⚡{opponentPlayer.energy}</Text>
            </View>
          </View>

          <View className="flex-row" style={{ gap: 4 }}>
            <Pressable onPress={() => setShowLogModal(true)} style={overlayBtnStyle}>
              <ClockIcon size={15} color="#6366F1" />
            </Pressable>
            <Pressable onPress={onConcede} style={[overlayBtnStyle, { backgroundColor: "rgba(255,255,255,0.85)" }]}>
              <XCircleIcon size={15} color="#F43F5E" />
            </Pressable>
          </View>
        </View>

        {/* Opponent active units */}
        <View className="flex-1 flex-row" style={{ gap: 8 }}>
          {opponentPlayer.units.map((unit) => (
            <UnitCard
              key={unit.instanceId}
              unit={unit}
              isValidTarget={targeting?.validTargetIds.includes(unit.instanceId) ?? false}
              attackerType={actorType}
              onPress={() => handleOppUnitPress(unit.instanceId)}
              onLongPress={() => handleLongPress(unit.instanceId)}
              floatingEvents={floatingByUnit[unit.instanceId] ?? []}
            />
          ))}
        </View>

        {/* Opponent bench */}
        <View className="flex-row justify-center items-center" style={{ height: 52, gap: 16, marginTop: 4 }}>
          <Text style={{ fontSize: 9, fontFamily: "Nunito_700Bold", color: "rgba(255,255,255,0.7)", letterSpacing: 2 }}>BENCH</Text>
          {[...opponentPlayer.bench].reverse().map((unit) => (
            <BenchCard
              key={unit.instanceId}
              unit={unit}
              onPress={() => handleOppUnitPress(unit.instanceId)}
              onLongPress={() => handleLongPress(unit.instanceId)}
            />
          ))}
        </View>
      </View>

      {/* ── Center bar ── */}
      <View
        className="bg-accent flex-row items-center justify-center"
        style={{
          height: 32,
          borderRadius: 999,
          paddingHorizontal: 12,
          gap: 4,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.15,
          shadowRadius: 4,
          elevation: 4,
        }}
      >
        <Text style={{ fontSize: 11, fontFamily: "Nunito_600SemiBold", color: "#fff" }}>
          ⚔ Turn {turn}{hint ? ` · ${hint}` : ""}
        </Text>
      </View>

      {/* ── Player lane ── */}
      <View
        className="flex-1 min-h-0 rounded-xl bg-info"
        style={{
          padding: 6,
          shadowColor: "#6366F1",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.7,
          shadowRadius: 10,
          elevation: 8,
        }}
      >
        {/* Player info badge - absolute top-right */}
        <View
          className="absolute flex-row items-center"
          style={{ top: 6, right: 6, gap: 6, zIndex: 10 }}
        >
          <View style={{ backgroundColor: "rgba(99,102,241,0.85)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}>
            <Text style={{ color: "#fff", fontSize: 12, fontFamily: "Nunito_700Bold" }}>{myPlayer.name}</Text>
          </View>
          <View style={{ backgroundColor: "rgba(254,240,138,0.9)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, flexDirection: "row", alignItems: "center", gap: 2 }}>
            <Text style={{ color: "#854D0E", fontSize: 12, fontFamily: "Nunito_700Bold" }}>⚡{myPlayer.energy}</Text>
          </View>
        </View>

        {/* Player active units */}
        <View className="flex-1 flex-row" style={{ gap: 8, marginTop: 28 }}>
          {myPlayer.units.map((unit) => (
            <UnitCard
              key={unit.instanceId}
              unit={unit}
              isSelected={selectedActorId === unit.instanceId && showActionModal}
              isValidTarget={targeting?.validTargetIds.includes(unit.instanceId) ?? false}
              onPress={() => handleUnitPress(unit.instanceId)}
              onLongPress={() => handleLongPress(unit.instanceId)}
              floatingEvents={floatingByUnit[unit.instanceId] ?? []}
            />
          ))}
        </View>

        {/* Player bench */}
        <View className="flex-row justify-center items-center" style={{ height: 52, gap: 16, marginTop: 4 }}>
          {myPlayer.bench.map((unit) => (
            <BenchCard
              key={unit.instanceId}
              unit={unit}
              isSelected={pendingSwap?.activeInstanceId === unit.instanceId}
              isSwapTarget={isSwapMode}
              onPress={() => handleBenchPress(unit.instanceId)}
              onLongPress={() => handleLongPress(unit.instanceId)}
            />
          ))}
          <Text style={{ fontSize: 9, fontFamily: "Nunito_700Bold", color: "rgba(255,255,255,0.7)", letterSpacing: 2 }}>BENCH</Text>
        </View>
      </View>

      {/* Target hint */}
      <TargetSelectionHint targeting={targeting} />

      {/* Action buttons (abs bottom-right — relative to board) */}
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

      {/* Turn banner */}
      {showTurnBanner && (
        <TurnBanner
          key={bannerKey}
          isMyTurn={isMyTurn}
          onDone={() => setShowTurnBanner(false)}
        />
      )}

      {/* Results overlay */}
      <ResultsScreen
        phase={phase}
        winnerId={winnerId}
        myUserId={myUserId}
        opponentName={opponentPlayer.name}
        onBack={onBack}
      />

      {/* Action modal */}
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
        onSubmitNoTarget={() => {
          if (selectedActor) {
            submitAction({ kind: "pass" });
          }
          setShowActionModal(false);
          setSelectedActorId(null);
        }}
      />

      {/* Combat log */}
      <CombatLogModal
        visible={showLogModal}
        log={matchView.log}
        onClose={() => setShowLogModal(false)}
      />

      {/* Card info modal */}
      <CardInfoModal
        visible={longPressUnit !== null && !showActionModal}
        unit={longPressUnit ?? null}
        abilityDefinitions={abilityDefinitions}
        onClose={() => setLongPressUnitId(null)}
      />
    </View>
  );
}
