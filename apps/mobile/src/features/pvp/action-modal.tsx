import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";

import { getStrongAgainst, getWeakAgainst } from "@adventure-time/game-engine";

import { API_BASE_URL } from "../../lib/api";
import type { MyMatchView, PvpUnitState, TargetingMode } from "./types";

interface ActionModalProps {
  visible: boolean;
  unit: PvpUnitState | null;
  matchView: MyMatchView;
  onClose: () => void;
  onSelectAction: (mode: Omit<TargetingMode, "validTargetIds"> & { validTargetIds?: string[] }) => void;
  onSubmitNoTarget: (kind: "pass") => void;
}

export function ActionModal({
  visible,
  unit,
  matchView,
  onClose,
  onSelectAction,
  onSubmitNoTarget,
}: ActionModalProps) {
  if (!unit) return null;

  const { myPlayer, opponentPlayer, abilityDefinitions } = matchView;
  const energy = myPlayer.energy;
  const skillDef = abilityDefinitions?.[unit.skill];
  const ultimateDef = abilityDefinitions?.[unit.ultimate];

  const isSilenced = unit.statuses.some((s) => s.name === "Silence");
  const skillCd = unit.cooldowns[unit.skill] ?? 0;
  const ultimateCd = unit.cooldowns[unit.ultimate] ?? 0;
  const skillDisabled = energy < (skillDef?.cost ?? 1) || skillCd > 0 || isSilenced;
  const ultimateDisabled =
    energy < (ultimateDef?.cost ?? 2) ||
    ultimateCd > 0 ||
    isSilenced ||
    unit.usedUltimate;

  const strongTypes = getStrongAgainst(unit.type as any);
  const weakTypes = getWeakAgainst(unit.type as any);

  const liveOpponents = opponentPlayer.units.filter((u) => u.hp > 0);

  const imageUrl = unit.imageUrl
    ? unit.imageUrl.startsWith("http")
      ? unit.imageUrl
      : `${API_BASE_URL}${unit.imageUrl}`
    : null;

  const handleBasic = () => {
    const taunters = liveOpponents.filter((u) => u.statuses.some((s) => s.name === "Taunt"));
    const validTargets = (taunters.length > 0 ? taunters : liveOpponents).map((u) => u.instanceId);
    onSelectAction({ actorInstanceId: unit.instanceId, actionKind: "basic", validTargetIds: validTargets });
    onClose();
  };

  const handleSkill = () => {
    if (skillDisabled || !skillDef) return;
    const validTargets = liveOpponents.map((u) => u.instanceId);
    onSelectAction({
      actorInstanceId: unit.instanceId,
      actionKind: "skill",
      abilityKey: unit.skill,
      validTargetIds: validTargets,
    });
    onClose();
  };

  const handleUltimate = () => {
    if (ultimateDisabled || !ultimateDef) return;
    const validTargets = liveOpponents.map((u) => u.instanceId);
    onSelectAction({
      actorInstanceId: unit.instanceId,
      actionKind: "ultimate",
      abilityKey: unit.ultimate,
      validTargetIds: validTargets,
    });
    onClose();
  };

  const handlePass = () => {
    onSubmitNoTarget("pass");
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.row}>
          {/* Left: unit info */}
          <View style={styles.leftPanel}>
            <View style={styles.thumbnail}>
              {imageUrl ? (
                <Image source={{ uri: imageUrl }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
              ) : (
                <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "#374151", alignItems: "center", justifyContent: "center" }]}>
                  <Text style={{ color: "#9CA3AF", fontSize: 20 }}>{unit.name.charAt(0)}</Text>
                </View>
              )}
            </View>
            <Text style={styles.unitName} numberOfLines={1}>{unit.name}</Text>
            <Text style={styles.typeBadge}>{unit.type}</Text>
            <View style={styles.statsRow}>
              <StatLine label="ATK" value={unit.attack} />
              <StatLine label="DEF" value={unit.defense} />
              <StatLine label="SPD" value={unit.speed} />
            </View>
            <Text style={styles.energyLabel}>⚡ {energy}</Text>
            {strongTypes.length > 0 && (
              <Text style={styles.strongText}>Strong vs: {strongTypes.join(", ")}</Text>
            )}
            {weakTypes.length > 0 && (
              <Text style={styles.weakText}>Weak vs: {weakTypes.join(", ")}</Text>
            )}
          </View>

          {/* Right: actions */}
          <ScrollView style={styles.rightPanel} showsVerticalScrollIndicator={false}>
            <ActionButton
              label="Basic Attack"
              subtitle="1 energy • targets enemy"
              cost={1}
              energy={energy}
              onPress={handleBasic}
            />
            <ActionButton
              label={skillDef?.name ?? "Skill"}
              subtitle={skillDef?.description ?? ""}
              cost={skillDef?.cost ?? 1}
              energy={energy}
              cooldown={skillCd}
              disabled={skillDisabled}
              onPress={handleSkill}
            />
            <ActionButton
              label={ultimateDef?.name ?? "Ultimate"}
              subtitle={ultimateDef?.description ?? ""}
              cost={ultimateDef?.cost ?? 2}
              energy={energy}
              cooldown={ultimateCd}
              used={unit.usedUltimate}
              silenced={isSilenced}
              disabled={ultimateDisabled}
              onPress={handleUltimate}
              isUltimate
            />
            <Pressable style={styles.passButton} onPress={handlePass}>
              <Text style={styles.passText}>Pass</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function StatLine({ label, value }: { label: string; value: number }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 2 }}>
      <Text style={{ color: "#9CA3AF", fontSize: 11 }}>{label}</Text>
      <Text style={{ color: "#fff", fontSize: 11, fontFamily: "Nunito_700Bold" }}>{value}</Text>
    </View>
  );
}

function ActionButton({
  label,
  subtitle,
  cost,
  energy,
  cooldown = 0,
  used = false,
  silenced = false,
  disabled = false,
  isUltimate = false,
  onPress,
}: {
  label: string;
  subtitle: string;
  cost: number;
  energy: number;
  cooldown?: number;
  used?: boolean;
  silenced?: boolean;
  disabled?: boolean;
  isUltimate?: boolean;
  onPress: () => void;
}) {
  const canAfford = energy >= cost;
  const isDisabled = disabled || !canAfford;
  const statusNote = used
    ? "Used"
    : silenced
    ? "Silenced"
    : cooldown > 0
    ? `CD: ${cooldown}`
    : !canAfford
    ? "Not enough energy"
    : null;

  return (
    <Pressable
      style={[styles.actionBtn, isDisabled && styles.actionBtnDisabled, isUltimate && styles.ultimateBtn]}
      onPress={isDisabled ? undefined : onPress}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={[styles.actionLabel, isDisabled && styles.actionLabelDisabled]}>{label}</Text>
        <Text style={styles.costBadge}>⚡{cost}</Text>
      </View>
      <Text style={styles.actionSubtitle} numberOfLines={2}>{subtitle}</Text>
      {statusNote && <Text style={styles.statusNote}>{statusNote}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
  },
  sheet: {
    backgroundColor: "#1F2937",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: 340,
    padding: 16,
  },
  row: {
    flexDirection: "row",
    flex: 1,
  },
  leftPanel: {
    width: "38%",
    paddingRight: 12,
  },
  thumbnail: {
    width: 56,
    height: 56,
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: 6,
  },
  unitName: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Nunito_700Bold",
  },
  typeBadge: {
    color: "#9CA3AF",
    fontSize: 11,
    marginBottom: 6,
  },
  statsRow: {
    marginBottom: 6,
  },
  energyLabel: {
    color: "#FACC15",
    fontSize: 14,
    fontFamily: "Nunito_700Bold",
    marginBottom: 6,
  },
  strongText: {
    color: "#10B981",
    fontSize: 10,
    marginBottom: 2,
  },
  weakText: {
    color: "#EF4444",
    fontSize: 10,
  },
  rightPanel: {
    flex: 1,
  },
  actionBtn: {
    backgroundColor: "#374151",
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  actionBtnDisabled: {
    opacity: 0.5,
  },
  ultimateBtn: {
    borderWidth: 1,
    borderColor: "#EF4444",
  },
  actionLabel: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Nunito_700Bold",
  },
  actionLabelDisabled: {
    color: "#9CA3AF",
  },
  costBadge: {
    color: "#FACC15",
    fontSize: 12,
    fontFamily: "Nunito_700Bold",
  },
  actionSubtitle: {
    color: "#9CA3AF",
    fontSize: 11,
    marginTop: 2,
  },
  statusNote: {
    color: "#EF4444",
    fontSize: 10,
    marginTop: 2,
  },
  passButton: {
    backgroundColor: "#4B5563",
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
    marginBottom: 8,
  },
  passText: {
    color: "#9CA3AF",
    fontSize: 13,
    fontFamily: "Nunito_700Bold",
  },
});
