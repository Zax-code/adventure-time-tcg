import { Text, View } from "react-native";

import { useTranslation } from "../../i18n";
import { localizeStatusName } from "../../lib/combat-i18n";
import {
  getEventAbilityLabel,
  getEventActorName,
  getEventAmount,
  getEventStatusName,
  getEventTargetName,
  getEventWinnerLabel,
  isMissEvent,
} from "./event-payload";
import type { PvpBattleState } from "./types";
import { BattleFullScreenSheet } from "./battle-full-screen-sheet";

interface CombatLogModalProps {
  visible: boolean;
  log: PvpBattleState["log"];
  onClose: () => void;
}

function summarizeCombatEvent(
  event: PvpBattleState["log"][number],
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  const unit = t("pvp.combatLog.unitFallback");
  const player = t("pvp.combatLog.playerFallback");
  const target = t("pvp.combatLog.targetFallback");
  const ability = t("pvp.combatLog.abilityFallback");
  switch (event.type) {
    case "matchStart":
      return t("pvp.combatLog.matchStart");
    case "turnStart":
      return t("pvp.combatLog.turnStart", { turn: event.turn });
    case "turnEnd":
      return t("pvp.combatLog.turnEnd", { turn: event.turn });
    case "abilityStart":
      return t("pvp.combatLog.abilityStart", {
        actor: getEventActorName(event) ?? unit,
        ability: getEventAbilityLabel(event) ?? ability,
      });
    case "damage":
      if (isMissEvent(event)) {
        return t("pvp.combatLog.miss", {
          attacker: getEventActorName(event) ?? unit,
          target: getEventTargetName(event) ?? target,
        });
      }
      return t("pvp.combatLog.damage", {
        attacker: getEventActorName(event) ?? unit,
        amount: String(getEventAmount(event) ?? 0),
        target: getEventTargetName(event) ?? target,
      });
    case "crit":
      return t("pvp.combatLog.crit", {
        target: getEventTargetName(event) ?? target,
      });
    case "ko":
      return t("pvp.combatLog.ko", {
        target: getEventTargetName(event) ?? unit,
      });
    case "heal":
      return t("pvp.combatLog.heal", {
        target: getEventTargetName(event) ?? unit,
        amount: String(getEventAmount(event) ?? 0),
      });
    case "revive":
      return t("pvp.combatLog.revive", {
        target: getEventTargetName(event) ?? unit,
      });
    case "swap":
      return t("pvp.combatLog.swap", {
        player: getEventActorName(event) ?? player,
      });
    case "formation":
      return t("pvp.combatLog.formation");
    case "statusApply":
      return t("pvp.combatLog.statusApply", {
        target: getEventTargetName(event) ?? unit,
        status: localizeStatusName(getEventStatusName(event) ?? "", t),
      });
    case "statusTick":
      return t("pvp.combatLog.statusTick", {
        target: getEventTargetName(event) ?? unit,
        status: localizeStatusName(getEventStatusName(event) ?? "", t),
      });
    case "statusExpire":
      return t("pvp.combatLog.statusExpire", {
        status: localizeStatusName(getEventStatusName(event) ?? "", t),
        target: getEventTargetName(event) ?? unit,
      });
    case "gameOver":
      return t("pvp.combatLog.winner", {
        winner: getEventWinnerLabel(event) ?? t("pvp.combatLog.unknown"),
      });
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
  const { t } = useTranslation();
  const recentLog = [...log].reverse().slice(0, 30);

  return (
    <BattleFullScreenSheet
      visible={visible}
      title={t("pvp.combatLog.title")}
      onClose={onClose}
      testID="pvp-combat-log-modal"
      closeButtonTestID="pvp-combat-log-close-button"
    >
      <View className="gap-3 px-4 py-4">
        {recentLog.length === 0 ? (
          <View className="rounded-3xl border border-primaryTint bg-white px-6 py-10">
            <Text className="text-center font-nunito text-fgMuted">{t("pvp.combatLog.empty")}</Text>
          </View>
        ) : (
          recentLog.map((event) => (
            <View key={event.seq} className={`rounded-3xl border px-4 py-3 ${getEventClasses(event.type)}`}>
              <View className="flex-row items-start justify-between gap-3">
                <Text className={`flex-1 font-nunito text-sm leading-5 ${getEventTextClass(event.type)}`}>
                  {summarizeCombatEvent(event, t)}
                </Text>
                <View className="rounded-full bg-black/5 px-2 py-1">
                  <Text className="font-nunito-bold text-[10px] text-fgMuted">{t("pvp.combatLog.turnBadge", { turn: event.turn })}</Text>
                </View>
              </View>
            </View>
          ))
        )}
      </View>
    </BattleFullScreenSheet>
  );
}
