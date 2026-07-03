import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { PvpAction, PvpEndTurnInput } from "@adventure-time/api-client";

import {
  ChevronRightIcon,
  ClockIcon,
  XCircleIcon,
  ZapIcon,
} from "../../components/icons";
import { useTranslation } from "../../i18n";
import { useThemeStore } from "../../stores/theme-store";
import { THEME_COLORS } from "../../theme/themes";
import { ActionButtons, ActionEnergyPill } from "./action-buttons";
import { ActionModal } from "./action-modal";
import { BenchCard } from "./bench-card";
import { CardInfoModal } from "./card-info-modal";
import { CombatLogModal } from "./combat-log-modal";
import { ResultsScreen } from "./results-screen";
import { TargetSelectionHint } from "./target-selection-hint";
import { TurnBanner } from "./turn-banner";
import { formatTurnTimeout, useMinuteNow } from "./turn-timeout";
import { UnitCard } from "./unit-card";
import type {
  FloatingEvent,
  MyMatchView,
  SwapSelection,
  TargetingMode,
  UnitAnimationEvent,
} from "./types";

interface BattleBoardProps {
  matchView: MyMatchView;
  newEvents: FloatingEvent[];
  unitAnimationEvents: UnitAnimationEvent[];
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
  onEnterTargeting: (
    mode: Omit<TargetingMode, "validTargetIds"> & { validTargetIds?: string[] },
  ) => void;
  submitAction: (action: PvpAction) => void;
  submitEndTurn: (input?: PvpEndTurnInput) => void;
  readOnly?: boolean;
  middleOverlay?: ReactNode;
  bottomOverlay?: ReactNode;
  turnExpiresAt?: string | null;
}

function sortByPosition<T extends { position?: number | null }>(items: T[]) {
  return [...items].sort((a, b) => (a.position ?? 99) - (b.position ?? 99));
}

const overlayButtonStyle = {
  alignItems: "center" as const,
  justifyContent: "center" as const,
  backgroundColor: "rgba(255,255,255,0.68)",
  boxShadow: "0 6px 12px rgba(15,23,42,0.12)",
};

const activeCardSlot = {
  width: 164,
  height: 108,
};

const benchCardSlot = {
  width: 68,
  height: 50,
};

interface OverlayIconButtonProps {
  onPress: () => void;
  testID: string;
  accessibilityLabel: string;
  size?: number;
  children: ReactNode;
}

function OverlayIconButton({
  onPress,
  testID,
  accessibilityLabel,
  size = 42,
  children,
}: OverlayIconButtonProps) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessible
      onPress={onPress}
      style={({ pressed }) => [
        overlayButtonStyle,
        {
          width: size,
          height: size,
          minWidth: size,
          minHeight: size,
          borderRadius: 999,
          opacity: pressed ? 0.78 : 1,
        },
      ]}
      testID={testID}
    >
      {children}
    </Pressable>
  );
}

interface PlayerPlateProps {
  name: string;
  energy: number;
  maxEnergy: number;
  align: "left" | "right";
  tone: "opponent" | "player";
}

const PlayerPlate = playerPlate;

function playerPlate({
  name,
  energy,
  maxEnergy,
  align,
  tone,
}: PlayerPlateProps) {
  const isPlayer = tone === "player";
  return (
    <View className="flex-row items-center gap-4">
      {align === "left" ? (
        <EnergyPill energy={energy} maxEnergy={maxEnergy} />
      ) : null}
      <Text
        className={`font-nunito-extrabold text-[16px] ${
          isPlayer ? "text-infoText" : "text-dangerText"
        }`}
        numberOfLines={1}
        style={{ maxWidth: 260 }}
      >
        {name}
      </Text>
      {align === "right" ? (
        <EnergyPill energy={energy} maxEnergy={maxEnergy} />
      ) : null}
    </View>
  );
}

const EnergyPill = energyPill;

function energyPill({
  energy,
  maxEnergy,
}: {
  energy: number;
  maxEnergy: number;
}) {
  return (
    <View className="h-9 min-w-[56px] flex-row items-center justify-center gap-1.5 rounded-full bg-secondaryTint px-3">
      <ZapIcon size={16} color="#B45309" />
      <Text className="font-nunito-extrabold text-[16px] text-secondaryText">
        {energy}/{maxEnergy}
      </Text>
    </View>
  );
}

export function BattleBoard(props: BattleBoardProps) {
  return useBattleBoardView(props);
}

function useBattleBoardView({
  matchView,
  newEvents,
  unitAnimationEvents,
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
  middleOverlay,
  bottomOverlay,
  turnExpiresAt,
}: BattleBoardProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const themeName = useThemeStore((state) => state.themeName);
  const tc = THEME_COLORS[themeName];
  const {
    myPlayer,
    opponentPlayer,
    isMyTurn,
    turn,
    phase,
    winnerId,
    myUserId,
    abilityDefinitions,
  } = matchView;
  const now = useMinuteNow(Boolean(turnExpiresAt) && phase === "active");
  const timeoutLabel = formatTurnTimeout(turnExpiresAt, t, now);
  const horizontalPadding = Math.max(
    16,
    Math.max(insets.left, insets.right) + 10,
  );
  const verticalPadding = Math.max(8, Math.max(insets.top, insets.bottom) + 4);

  const [showActionModal, setShowActionModal] = useState(false);
  const [selectedActorId, setSelectedActorId] = useState<string | null>(null);
  const [showLogModal, setShowLogModal] = useState(false);
  const [longPressUnitId, setLongPressUnitId] = useState<string | null>(null);
  const [turnBannerState, setTurnBannerState] = useState(() => ({
    turn,
    bannerKey: 0,
    visible: true,
  }));

  useEffect(() => {
    setTurnBannerState((current) => ({
      turn,
      bannerKey:
        current.turn === turn ? current.bannerKey : current.bannerKey + 1,
      visible: true,
    }));
  }, [turn]);

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

  const animationsByUnit = useMemo(() => {
    const next: Record<string, UnitAnimationEvent[]> = {};
    for (const event of unitAnimationEvents) {
      if (!next[event.targetInstanceId]) {
        next[event.targetInstanceId] = [];
      }
      next[event.targetInstanceId].push(event);
    }
    return next;
  }, [unitAnimationEvents]);

  const sortedMyUnits = useMemo(
    () => sortByPosition(myPlayer.units),
    [myPlayer.units],
  );
  const sortedOpponentUnits = useMemo(
    () => sortByPosition(opponentPlayer.units),
    [opponentPlayer.units],
  );
  const selectedActor = selectedActorId
    ? (sortedMyUnits.find((unit) => unit.instanceId === selectedActorId) ??
      null)
    : null;
  const targetingActor = targeting
    ? (sortedMyUnits.find(
        (unit) => unit.instanceId === targeting.actorInstanceId,
      ) ?? null)
    : null;
  const actorType = selectedActor?.type ?? targetingActor?.type;
  const hasBench = myPlayer.bench.some((unit) => unit.hp > 0);
  const hasReadyActor = sortedMyUnits.some(
    (unit) =>
      unit.hp > 0 &&
      !unit.statuses.some((status) => status.name === "SummoningSickness"),
  );

  const longPressUnit = longPressUnitId
    ? ([
        ...myPlayer.units,
        ...myPlayer.bench,
        ...opponentPlayer.units,
        ...opponentPlayer.bench,
      ].find((unit) => unit.instanceId === longPressUnitId) ?? null)
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
          : hasReadyActor
            ? t("pvp.board.hint.actions")
            : t("pvp.board.hint.noReady")
      : t("pvp.board.hint.waiting");

  const isOverlayOpen =
    showActionModal || showLogModal || longPressUnit !== null;
  const opponentBenchOffset = -22;
  const myBenchOffset = 20;

  const handleUnitPress = (instanceId: string) => {
    if (readOnly || isActing) {
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

    const unit = myPlayer.units.find(
      (entry) => entry.instanceId === instanceId,
    );
    if (
      !unit ||
      unit.hp <= 0 ||
      unit.statuses.some((status) => status.name === "SummoningSickness")
    ) {
      return;
    }

    setSelectedActorId(instanceId);
    setShowActionModal(true);
  };

  const handleOppUnitPress = (instanceId: string) => {
    if (readOnly || isActing) {
      return;
    }

    if (targeting?.validTargetIds.includes(instanceId)) {
      onSelectTarget(instanceId);
    }
  };

  const handleBenchPress = (instanceId: string) => {
    if (readOnly || isActing) {
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
    <View
      className="flex-1 overflow-hidden bg-bg"
      style={{
        paddingLeft: horizontalPadding,
        paddingRight: horizontalPadding,
        paddingTop: verticalPadding,
        paddingBottom: verticalPadding,
      }}
      testID="pvp-battle-board"
    >
      <LinearGradient
        pointerEvents="none"
        colors={[tc.primaryTint, tc.bg, tc.infoTint]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          position: "absolute",
          inset: 0,
          opacity: themeName === "nightosphere" ? 0.34 : 0.86,
        }}
      />

      <View className="relative z-10 flex-1">
        <View className="absolute left-3 top-3 z-30">
          <OverlayIconButton
            accessibilityLabel={t("pvp.match.goBack")}
            onPress={onBack}
            testID="pvp-battle-back-button"
          >
            <View style={{ transform: [{ rotate: "180deg" }] }}>
              <ChevronRightIcon size={18} color={tc.primaryText} />
            </View>
          </OverlayIconButton>
        </View>

        <View className="absolute right-0 top-3 z-30 flex-row gap-2">
          <OverlayIconButton
            accessibilityLabel={t("pvp.combatLog.title")}
            onPress={() => setShowLogModal(true)}
            size={50}
            testID="pvp-battle-log-button"
          >
            <ClockIcon size={20} color={tc.primaryText} />
          </OverlayIconButton>
          {!readOnly ? (
            <OverlayIconButton
              accessibilityLabel={t("pvp.match.concedeConfirm")}
              onPress={onConcede}
              size={50}
              testID="pvp-battle-concede-button"
            >
              <XCircleIcon size={20} color={tc.dangerDark} />
            </OverlayIconButton>
          ) : null}
        </View>

        <View className="relative z-10 flex-1 justify-center gap-2">
          <View className="relative min-h-0 flex-1 px-3 pt-1">
            <View
              className="mb-4 flex-row items-center justify-center pl-[54px] pr-[110px]"
              style={{ transform: [{ translateY: -24 }] }}
            >
              <PlayerPlate
                name={opponentPlayer.name}
                energy={opponentPlayer.energy}
                maxEnergy={opponentPlayer.maxEnergy}
                align="left"
                tone="opponent"
              />
            </View>

            <View className="min-h-0 flex-1 flex-row items-center justify-center gap-6 pb-4">
              <View className="flex-row items-center justify-center gap-5">
                {sortedOpponentUnits.map((unit, index) => (
                  <View key={unit.instanceId} style={activeCardSlot}>
                    <UnitCard
                      unit={unit}
                      testID={`pvp-opponent-unit-${index}`}
                      isValidTarget={
                        targeting?.validTargetIds.includes(unit.instanceId) ??
                        false
                      }
                      attackerType={actorType}
                      onPress={() => handleOppUnitPress(unit.instanceId)}
                      onLongPress={() => handleLongPress(unit.instanceId)}
                      floatingEvents={floatingByUnit[unit.instanceId] ?? []}
                      animationEvents={animationsByUnit[unit.instanceId] ?? []}
                      swapAnimationOffset={48}
                    />
                  </View>
                ))}
              </View>

              <View
                className="w-[70px] items-center gap-2"
                style={{ transform: [{ translateY: opponentBenchOffset }] }}
              >
                {opponentPlayer.bench.map((unit, index) => (
                  <View key={unit.instanceId} style={benchCardSlot}>
                    <BenchCard
                      unit={unit}
                      testID={`pvp-opponent-bench-${index}`}
                      onPress={() => handleOppUnitPress(unit.instanceId)}
                      onLongPress={() => handleLongPress(unit.instanceId)}
                      animationEvents={animationsByUnit[unit.instanceId] ?? []}
                      swapAnimationOffset={-36}
                    />
                  </View>
                ))}
              </View>
            </View>
          </View>

          <View
            className="mx-10 h-[52px] overflow-hidden rounded-full"
            style={{
              backgroundColor:
                themeName === "nightosphere"
                  ? "rgba(26,11,21,0.86)"
                  : "rgba(255,255,255,0.72)",
              boxShadow: "0 8px 18px rgba(15,23,42,0.08)",
            }}
          >
            {middleOverlay ? (
              <View className="h-full justify-center px-3">
                {middleOverlay}
              </View>
            ) : (
              <View className="h-full flex-row items-center px-2.5">
                <View
                  className={`h-9 w-9 items-center justify-center rounded-full ${
                    isMyTurn ? "bg-success" : "bg-slate-900/55"
                  }`}
                >
                  <Text className="font-nunito-extrabold text-[12px] text-white">
                    T{turn}
                  </Text>
                </View>
                <View className="min-w-0 flex-1 px-4">
                  <Text
                    className="text-center font-nunito-extrabold text-[14px] text-fg"
                    numberOfLines={1}
                  >
                    {hint}
                  </Text>
                  {timeoutLabel ? (
                    <Text
                      className="text-center font-nunito-bold text-[10px] text-fgMuted"
                      numberOfLines={1}
                    >
                      {timeoutLabel.fullLabel}
                    </Text>
                  ) : null}
                </View>
                <View
                  className={`h-9 w-9 items-center justify-center rounded-full ${
                    isMyTurn ? "bg-white/78" : "bg-slate-900/45"
                  }`}
                >
                  <Text
                    className={`font-nunito-extrabold text-[10px] ${
                      isMyTurn ? "text-successText" : "text-white"
                    }`}
                  >
                    {isMyTurn ? t("pvp.board.ready") : "..."}
                  </Text>
                </View>
              </View>
            )}
          </View>

          <View className="relative min-h-0 flex-1 px-3 pb-1">
            <View
              className="min-h-0 flex-1 flex-row items-center justify-center gap-6"
              style={{
                paddingTop: 24,
                paddingBottom: bottomOverlay ? 52 : 40,
                paddingRight: 78,
              }}
            >
              <View
                className="w-[70px] items-center gap-2"
                style={{ transform: [{ translateY: myBenchOffset }] }}
              >
                {myPlayer.bench.map((unit, index) => (
                  <View key={unit.instanceId} style={benchCardSlot}>
                    <BenchCard
                      unit={unit}
                      testID={`pvp-my-bench-${index}`}
                      isSelected={
                        pendingSwap?.benchInstanceId === unit.instanceId
                      }
                      isSwapTarget={isSwapMode}
                      isValidTarget={
                        targeting?.validTargetIds.includes(unit.instanceId) ??
                        false
                      }
                      onPress={() => handleBenchPress(unit.instanceId)}
                      onLongPress={() => handleLongPress(unit.instanceId)}
                      animationEvents={animationsByUnit[unit.instanceId] ?? []}
                      swapAnimationOffset={36}
                    />
                  </View>
                ))}
              </View>

              <View className="flex-row items-center justify-center gap-5">
                {sortedMyUnits.map((unit, index) => (
                  <View key={unit.instanceId} style={activeCardSlot}>
                    <UnitCard
                      unit={unit}
                      testID={`pvp-my-unit-${index}`}
                      isSelected={
                        (selectedActorId === unit.instanceId &&
                          showActionModal) ||
                        pendingSwap?.activeInstanceId === unit.instanceId
                      }
                      isValidTarget={
                        targeting?.validTargetIds.includes(unit.instanceId) ??
                        false
                      }
                      canSelectAsActor={
                        isMyTurn &&
                        !targeting &&
                        !isSwapMode &&
                        unit.hp > 0 &&
                        !unit.statuses.some(
                          (status) => status.name === "SummoningSickness",
                        )
                      }
                      onPress={() => handleUnitPress(unit.instanceId)}
                      onLongPress={() => handleLongPress(unit.instanceId)}
                      floatingEvents={floatingByUnit[unit.instanceId] ?? []}
                      animationEvents={animationsByUnit[unit.instanceId] ?? []}
                      swapAnimationOffset={-48}
                    />
                  </View>
                ))}
              </View>
            </View>

            {readOnly ? (
              <View
                pointerEvents="none"
                className="absolute bottom-[14px] right-0 z-50 items-end gap-2"
              >
                <ActionEnergyPill
                  energy={myPlayer.energy}
                  maxEnergy={myPlayer.maxEnergy}
                />
                <View className="h-12" />
              </View>
            ) : (
              <ActionButtons
                energy={myPlayer.energy}
                maxEnergy={myPlayer.maxEnergy}
                state={{
                  isSwapMode,
                  isTargeting: targeting !== null,
                  hasBench,
                  isMyTurn,
                  isActing,
                }}
                onSwapToggle={onSwapToggle}
                onCancel={onCancelTargeting}
                onEndTurn={onEndTurn}
              />
            )}
          </View>
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
          if (isActing) {
            return;
          }
          onEnterTargeting(mode);
        }}
        onSubmitAction={(action) => {
          if (isActing) {
            return;
          }
          submitAction(action);
          setShowActionModal(false);
          setSelectedActorId(null);
        }}
      />

      <CombatLogModal
        visible={showLogModal}
        log={matchView.log}
        battleState={matchView.battleState}
        onClose={() => setShowLogModal(false)}
      />

      <CardInfoModal
        visible={longPressUnit !== null && !showActionModal}
        unit={longPressUnit}
        abilityDefinitions={abilityDefinitions}
        onClose={() => setLongPressUnitId(null)}
      />

      {bottomOverlay ? (
        <View
          pointerEvents="box-none"
          className="absolute bottom-3 left-0 right-0 items-center px-6"
        >
          {bottomOverlay}
        </View>
      ) : null}
    </View>
  );
}
