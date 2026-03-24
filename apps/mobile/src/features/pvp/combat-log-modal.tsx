import { Text, View } from "react-native";

import type { PvpBattleState } from "./types";
import { BattleFullScreenSheet } from "./battle-full-screen-sheet";

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
    case "abilityStart":
      return `${String(payload.actorName ?? payload.sourceName ?? "Unit")} used ${String(payload.abilityName ?? payload.abilityKey ?? "an ability")}`;
    case "damage":
      if (payload.isMiss) {
        return `${String(payload.attackerName ?? payload.sourceName ?? "Unit")} missed ${String(payload.targetName ?? "target")}`;
      }
      return `${String(payload.attackerName ?? payload.sourceName ?? "Unit")} dealt ${String(payload.actualDamage ?? payload.amount ?? payload.damage ?? 0)} damage to ${String(payload.targetName ?? "target")}`;
    case "crit":
      return `Critical hit on ${String(payload.targetName ?? "target")}`;
    case "ko":
      return `${String(payload.targetName ?? payload.unitName ?? "Unit")} was knocked out`;
    case "heal":
      return `${String(payload.targetName ?? "Unit")} healed for ${String(payload.amount ?? 0)}`;
    case "revive":
      return `${String(payload.targetName ?? "Unit")} returned to battle`;
    case "swap":
      return `${String(payload.playerName ?? payload.userId ?? "Player")} swapped units`;
    case "formation":
      return "Formation shifted";
    case "statusApply":
      return `${String(payload.targetName ?? "Unit")} gained ${String(payload.statusName ?? payload.status ?? "a status")}`;
    case "statusTick":
      return `${String(payload.unitName ?? payload.targetName ?? "Unit")} was affected by ${String(payload.statusName ?? payload.status ?? "a status")}`;
    case "statusExpire":
      return `${String(payload.statusName ?? payload.status ?? "Status")} expired on ${String(payload.targetName ?? "unit")}`;
    case "gameOver":
      return `Winner: ${String(payload.winnerName ?? payload.winnerId ?? "unknown")}`;
    default:
      return event.type;
  }
}

function getEventClasses(type: string) {
  switch (type) {
    case "turnStart":
    case "turnEnd":
      return "border-primaryTint bg-primaryBg";
    case "damage":
    case "crit":
    case "ko":
      return "border-dangerBorder bg-dangerTint";
    case "heal":
    case "revive":
      return "border-successBorder bg-successTint";
    default:
      return "border-primaryTint bg-white";
  }
}

function getEventTextClass(type: string) {
  switch (type) {
    case "turnStart":
    case "turnEnd":
      return "text-primaryDark";
    case "damage":
    case "crit":
    case "ko":
      return "text-dangerDark";
    case "heal":
    case "revive":
      return "text-successDark";
    default:
      return "text-fg";
  }
}

export function CombatLogModal({ visible, log, onClose }: CombatLogModalProps) {
  const recentLog = [...log].reverse().slice(0, 30);

  return (
    <BattleFullScreenSheet visible={visible} title="Combat Log" onClose={onClose}>
      <View className="gap-3 px-4 py-4">
        {recentLog.length === 0 ? (
          <View className="rounded-3xl border border-primaryTint bg-white px-6 py-10">
            <Text className="text-center font-nunito text-fgMuted">No events yet.</Text>
          </View>
        ) : (
          recentLog.map((event) => (
            <View key={event.seq} className={`rounded-3xl border px-4 py-3 ${getEventClasses(event.type)}`}>
              <View className="flex-row items-start justify-between gap-3">
                <Text className={`flex-1 font-nunito text-sm leading-5 ${getEventTextClass(event.type)}`}>
                  {summarizeCombatEvent(event)}
                </Text>
                <View className="rounded-full bg-black/5 px-2 py-1">
                  <Text className="font-nunito-bold text-[10px] text-fgMuted">T{event.turn}</Text>
                </View>
              </View>
            </View>
          ))
        )}
      </View>
    </BattleFullScreenSheet>
  );
}
