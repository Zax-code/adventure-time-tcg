import { Text, View } from "react-native";

import { useTranslation } from "../../i18n";
import { localizeStatusName } from "../../lib/combat-i18n";
import {
  getEventAbilityLabel,
  getEventActorName,
  getEventAmount,
  getEventChance,
  getEventCritChance,
  getEventCritRoll,
  getEventDestinationName,
  getEventMissChance,
  getEventMissRoll,
  getEventOptionCount,
  getEventRemaining,
  getEventRoll,
  getEventSelectedIndex,
  getEventSourceName,
  getEventStatusName,
  getEventTargetName,
  getEventWinnerLabel,
  didEventRollPass,
  isMissEvent,
} from "./event-payload";
import type { PvpBattleState } from "./types";
import { BattleFullScreenSheet } from "./battle-full-screen-sheet";

interface CombatLogModalProps {
  visible: boolean;
  log: PvpBattleState["log"];
  onClose: () => void;
}

type Translate = (key: string, params?: Record<string, string | number>) => string;

function formatPercent(value: number): string {
  const percent = value * 100;
  return `${percent < 10 ? percent.toFixed(1) : percent.toFixed(0)}%`;
}

function formatAttackRollDetail(
  event: PvpBattleState["log"][number],
  t: Translate,
): string {
  const missRoll = getEventMissRoll(event);
  const missChance = getEventMissChance(event);

  if (missRoll === null || missChance === null) {
    return "";
  }

  if (isMissEvent(event)) {
    return t("pvp.combatLog.attackMissRollDetail", {
      missRoll: formatPercent(missRoll),
      missChance: formatPercent(missChance),
    });
  }

  const critRoll = getEventCritRoll(event);
  const critChance = getEventCritChance(event);

  if (critRoll === null || critChance === null) {
    return t("pvp.combatLog.attackMissOnlyRollDetail", {
      missRoll: formatPercent(missRoll),
      missChance: formatPercent(missChance),
    });
  }

  return t("pvp.combatLog.attackHitRollDetail", {
    missRoll: formatPercent(missRoll),
    missChance: formatPercent(missChance),
    critRoll: formatPercent(critRoll),
    critChance: formatPercent(critChance),
  });
}

function formatCritRollDetail(
  event: PvpBattleState["log"][number],
  t: Translate,
): string {
  const critRoll = getEventCritRoll(event);
  const critChance = getEventCritChance(event);

  if (critRoll === null || critChance === null) {
    return "";
  }

  return t("pvp.combatLog.critRollDetail", {
    critRoll: formatPercent(critRoll),
    critChance: formatPercent(critChance),
  });
}

function formatChanceRollDetail(event: PvpBattleState["log"][number]): string {
  const roll = getEventRoll(event);
  const chance = getEventChance(event);

  if (roll === null || chance === null) {
    return "";
  }

  return `${formatPercent(roll)} / ${formatPercent(chance)}`;
}

function formatRandomChoiceDetail(
  event: PvpBattleState["log"][number],
  t: Translate,
): string {
  const roll = getEventRoll(event);
  const selectedIndex = getEventSelectedIndex(event);
  const optionCount = getEventOptionCount(event);

  if (roll === null || selectedIndex === null || optionCount === null) {
    return "";
  }

  return t("pvp.combatLog.randomChoiceDetail", {
    roll: formatPercent(roll),
    selected: String(selectedIndex + 1),
    count: String(optionCount),
  });
}

function summarizeCombatEvent(
  event: PvpBattleState["log"][number],
  t: Translate,
): string {
  const unit = t("pvp.combatLog.unitFallback");
  const player = t("pvp.combatLog.playerFallback");
  const target = t("pvp.combatLog.targetFallback");
  const ability = t("pvp.combatLog.abilityFallback");
  switch (event.type) {
    case "matchStart":
      return t("pvp.combatLog.matchStart", {
        roll:
          formatChanceRollDetail(event) === ""
            ? ""
            : t("pvp.combatLog.initiativeTieRollDetail", {
                roll: formatChanceRollDetail(event),
              }),
      });
    case "turnStart":
      return t("pvp.combatLog.turnStart", { turn: event.turn });
    case "turnEnd":
      return t("pvp.combatLog.turnEnd", { turn: event.turn });
    case "energyGrant":
      return t("pvp.combatLog.energyGrant", {
        player: getEventActorName(event) ?? player,
        amount: String(getEventAmount(event) ?? 0),
      });
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
          roll: formatAttackRollDetail(event, t),
        });
      }
      return t("pvp.combatLog.damage", {
        attacker: getEventActorName(event) ?? unit,
        amount: String(getEventAmount(event) ?? 0),
        target: getEventTargetName(event) ?? target,
        roll: formatAttackRollDetail(event, t),
      });
    case "crit":
      return t("pvp.combatLog.crit", {
        target: getEventTargetName(event) ?? target,
        roll: formatCritRollDetail(event, t),
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
    case "shieldAbsorb":
      return t("pvp.combatLog.shieldAbsorb", {
        target: getEventTargetName(event) ?? unit,
        amount: String(getEventAmount(event) ?? 0),
      });
    case "swap":
      return t("pvp.combatLog.swap", {
        player: getEventActorName(event) ?? player,
      });
    case "formation":
      return t("pvp.combatLog.formation");
    case "pass":
      return t("pvp.combatLog.pass", {
        player: getEventActorName(event) ?? player,
      });
    case "concede":
      return t("pvp.combatLog.concede", {
        player: getEventActorName(event) ?? player,
      });
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
    case "statusCleanse":
      return t("pvp.combatLog.statusCleanse", {
        target: getEventTargetName(event) ?? unit,
        status: localizeStatusName(getEventStatusName(event) ?? "", t),
      });
    case "passiveRoll":
      return t(
        didEventRollPass(event)
          ? "pvp.combatLog.passiveRollPass"
          : "pvp.combatLog.passiveRollFail",
        {
          unit: getEventActorName(event) ?? unit,
          ability: getEventAbilityLabel(event) ?? ability,
          roll: formatChanceRollDetail(event),
        },
      );
    case "passiveTrigger":
      return t("pvp.combatLog.passiveTrigger", {
        unit: getEventActorName(event) ?? unit,
        ability: getEventAbilityLabel(event) ?? ability,
      });
    case "statusRoll":
      return t(
        didEventRollPass(event)
          ? "pvp.combatLog.statusRollPass"
          : "pvp.combatLog.statusRollFail",
        {
          target: getEventTargetName(event) ?? unit,
          status: localizeStatusName(getEventStatusName(event) ?? "", t),
          roll: formatChanceRollDetail(event),
        },
      );
    case "randomStatusRoll":
      return t("pvp.combatLog.randomStatusRoll", {
        target: getEventTargetName(event) ?? unit,
        status: localizeStatusName(getEventStatusName(event) ?? "", t),
        roll: formatRandomChoiceDetail(event, t),
      });
    case "cooldownTick":
      return t("pvp.combatLog.cooldownTick", {
        target: getEventTargetName(event) ?? unit,
        ability: getEventAbilityLabel(event) ?? ability,
        count: String(getEventRemaining(event) ?? 0),
      });
    case "freeze_skip":
      return t("pvp.combatLog.freezeSkip", {
        target: getEventTargetName(event) ?? unit,
      });
    case "stun_consume":
      return t("pvp.combatLog.stunConsume", {
        target: getEventTargetName(event) ?? unit,
      });
    case "coverRedirect":
      return t("pvp.combatLog.coverRedirect", {
        source: getEventSourceName(event) ?? target,
        target: getEventDestinationName(event) ?? unit,
      });
    case "thorns":
      return t("pvp.combatLog.thorns", {
        source: getEventSourceName(event) ?? unit,
        target: getEventTargetName(event) ?? target,
        amount: String(getEventAmount(event) ?? 0),
      });
    case "counter":
      return t("pvp.combatLog.counter", {
        source: getEventSourceName(event) ?? unit,
        target: getEventTargetName(event) ?? target,
        amount: String(getEventAmount(event) ?? 0),
      });
    case "preventDeath":
      return t("pvp.combatLog.preventDeath", {
        target: getEventTargetName(event) ?? unit,
        ability: getEventAbilityLabel(event) ?? ability,
      });
    case "statusSteal":
      return t("pvp.combatLog.statusSteal", {
        status: localizeStatusName(getEventStatusName(event) ?? "", t),
        source: getEventSourceName(event) ?? target,
        target: getEventDestinationName(event) ?? unit,
      });
    case "swapHp":
      return t("pvp.combatLog.swapHp", {
        actor: getEventActorName(event) ?? unit,
        target: getEventTargetName(event) ?? target,
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
    case "statusCleanse":
    case "preventDeath":
      return "border-successBorder bg-successTint";
    case "energyGrant":
    case "cooldownTick":
    case "passiveRoll":
    case "passiveTrigger":
    case "statusRoll":
    case "randomStatusRoll":
    case "formation":
    case "swap":
    case "pass":
      return "border-infoBorder bg-infoTint";
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
    case "statusCleanse":
    case "preventDeath":
      return "text-successDark";
    case "energyGrant":
    case "cooldownTick":
    case "passiveRoll":
    case "passiveTrigger":
    case "statusRoll":
    case "randomStatusRoll":
    case "formation":
    case "swap":
    case "pass":
      return "text-infoDark";
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
            <Text className="text-center font-nunito text-fgMuted">
              {t("pvp.combatLog.empty")}
            </Text>
          </View>
        ) : (
          recentLog.map((event) => (
            <View
              key={event.seq}
              className={`rounded-3xl border px-4 py-3 ${getEventClasses(event.type)}`}
            >
              <View className="flex-row items-start justify-between gap-3">
                <Text
                  className={`flex-1 font-nunito text-sm leading-5 ${getEventTextClass(event.type)}`}
                >
                  {summarizeCombatEvent(event, t)}
                </Text>
                <View className="rounded-full bg-black/5 px-2 py-1">
                  <Text className="font-nunito-bold text-[10px] text-fgMuted">
                    {t("pvp.combatLog.turnBadge", { turn: event.turn })}
                  </Text>
                </View>
              </View>
            </View>
          ))
        )}
      </View>
    </BattleFullScreenSheet>
  );
}
