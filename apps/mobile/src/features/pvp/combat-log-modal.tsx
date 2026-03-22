import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import type { PvpBattleState } from "./types";

interface CombatLogModalProps {
  visible: boolean;
  log: PvpBattleState["log"];
  onClose: () => void;
}

function summarizeCombatEvent(event: PvpBattleState["log"][number]): string {
  const payload = event.payload;
  switch (event.type) {
    case "matchStart":
      return "Match started";
    case "turnStart":
      return `Turn ${event.turn} started`;
    case "turnEnd":
      return `Turn ${event.turn} ended`;
    case "damage":
      return `${String(payload.attackerName ?? payload.sourceName ?? "Unit")} dealt ${String(payload.amount ?? payload.damage ?? 0)} damage to ${String(payload.targetName ?? "target")}`;
    case "crit":
      return `${String(payload.attackerName ?? "Unit")} dealt a critical hit for ${String(payload.amount ?? 0)} to ${String(payload.targetName ?? "target")}`;
    case "ko":
      return `${String(payload.targetName ?? "Unit")} was knocked out`;
    case "heal":
      return `${String(payload.targetName ?? "Unit")} was healed for ${String(payload.amount ?? 0)}`;
    case "swap":
      return `${String(payload.playerName ?? payload.userId ?? "Player")} swapped units`;
    case "statusApply":
      return `${String(payload.targetName ?? "Unit")} gained ${String(payload.status ?? "")}`;
    case "statusExpire":
      return `${String(payload.status ?? "Status")} expired on ${String(payload.targetName ?? "unit")}`;
    case "gameOver":
      return `Winner: ${String(payload.winnerId ?? "unknown")}`;
    default:
      return event.type;
  }
}

function getEventStyle(type: string) {
  switch (type) {
    case "turnStart":
    case "turnEnd":
      return styles.eventTurn;
    case "damage":
    case "crit":
    case "ko":
      return styles.eventDanger;
    case "heal":
      return styles.eventHeal;
    default:
      return styles.eventDefault;
  }
}

export function CombatLogModal({ visible, log, onClose }: CombatLogModalProps) {
  const recentLog = [...log].reverse().slice(0, 30);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.header}>
          <Text style={styles.title}>Combat Log</Text>
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
        </View>
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          {recentLog.map((event) => (
            <View
              key={event.seq}
              style={[styles.eventRow, (event.type === "turnStart" || event.type === "turnEnd") && styles.turnRow]}
            >
              <Text style={[styles.eventText, getEventStyle(event.type)]}>
                {summarizeCombatEvent(event)}
              </Text>
              <Text style={styles.turnLabel}>T{event.turn}</Text>
            </View>
          ))}
          {recentLog.length === 0 && (
            <Text style={styles.emptyText}>No events yet.</Text>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
  },
  sheet: {
    backgroundColor: "#111827",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "60%",
    padding: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Nunito_700Bold",
  },
  closeBtn: {
    padding: 4,
  },
  closeText: {
    color: "#9CA3AF",
    fontSize: 18,
  },
  scroll: {
    flex: 1,
  },
  eventRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  turnRow: {
    backgroundColor: "rgba(99,102,241,0.1)",
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  eventText: {
    fontSize: 12,
    flex: 1,
    marginRight: 8,
  },
  eventTurn: {
    color: "#A5B4FC",
    fontFamily: "Nunito_700Bold",
  },
  eventDanger: {
    color: "#FCA5A5",
  },
  eventHeal: {
    color: "#6EE7B7",
  },
  eventDefault: {
    color: "#D1D5DB",
  },
  turnLabel: {
    color: "#6B7280",
    fontSize: 10,
    minWidth: 24,
    textAlign: "right",
  },
  emptyText: {
    color: "#6B7280",
    fontSize: 13,
    textAlign: "center",
    paddingVertical: 20,
  },
});
