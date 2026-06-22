import { useMemo } from "react";
import { Text, View } from "react-native";

import { useTranslation } from "../../i18n";
import { localizeStatusName } from "../../lib/combat-i18n";
import { getCombatLogEventKey } from "./combat-log-keys";
import {
  getEventAbilityLabel,
  getEventActorId,
  getEventActorName,
  getEventAmount,
  getEventChance,
  getEventCritChance,
  getEventCritRoll,
  getEventDestinationId,
  getEventDestinationName,
  getEventMissChance,
  getEventMissRoll,
  getEventMaxEnergy,
  getEventOptionCount,
  getEventRemaining,
  getEventRoll,
  getEventSelectedIndex,
  getEventSourceId,
  getEventSourceName,
  getEventStatusName,
  getEventTargetId,
  getEventTargetName,
  getEventWinnerId,
  getEventWinnerLabel,
  didEventRollPass,
  isMissEvent,
  isDrawEvent,
} from "./event-payload";
import type { PvpBattleState } from "./types";
import { BattleFullScreenSheet } from "./battle-full-screen-sheet";

interface CombatLogModalProps {
  visible: boolean;
  log: PvpBattleState["log"];
  battleState: PvpBattleState;
  onClose: () => void;
}

type Translate = (
  key: string,
  params?: Record<string, string | number>,
) => string;
type ResolveDisplayName = (id: string | null) => string | null;
type ResolveAbilityName = (keyOrName: string | null) => string | null;

interface CombatLogResolvers {
  displayName: ResolveDisplayName;
  abilityName: ResolveAbilityName;
}

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

function buildCombatLogResolvers(
  battleState: PvpBattleState,
): CombatLogResolvers {
  const displayNames = new Map<string, string>();
  const abilityNames = new Map<string, string>();

  for (const player of battleState.players) {
    displayNames.set(player.userId, player.name);
    for (const unit of [...player.units, ...player.bench]) {
      displayNames.set(unit.instanceId, unit.name);
      displayNames.set(unit.cardId, unit.name);
    }
  }

  for (const [key, ability] of Object.entries(
    battleState.abilityDefinitions ?? {},
  )) {
    abilityNames.set(key, ability.name);
    abilityNames.set(ability.name, ability.name);
  }

  return {
    displayName: (id) => (id ? (displayNames.get(id) ?? null) : null),
    abilityName: (keyOrName) =>
      keyOrName ? (abilityNames.get(keyOrName) ?? keyOrName) : null,
  };
}

function summarizeCombatEvent(
  event: PvpBattleState["log"][number],
  t: Translate,
  resolvers: CombatLogResolvers,
): string {
  const unit = t("pvp.combatLog.unitFallback");
  const player = t("pvp.combatLog.playerFallback");
  const target = t("pvp.combatLog.targetFallback");
  const ability = t("pvp.combatLog.abilityFallback");
  const actorName =
    getEventActorName(event) ?? resolvers.displayName(getEventActorId(event));
  const targetName =
    getEventTargetName(event) ?? resolvers.displayName(getEventTargetId(event));
  const sourceName =
    getEventSourceName(event) ?? resolvers.displayName(getEventSourceId(event));
  const destinationName =
    getEventDestinationName(event) ??
    resolvers.displayName(getEventDestinationId(event));
  const winnerLabel =
    getEventWinnerLabel(event) ??
    resolvers.displayName(getEventWinnerId(event));
  const abilityLabel = resolvers.abilityName(getEventAbilityLabel(event));

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
      const amount = getEventAmount(event) ?? 0;
      const maxEnergy = getEventMaxEnergy(event);
      return t("pvp.combatLog.energyGrant", {
        player: actorName ?? player,
        amount: maxEnergy === null ? String(amount) : `${amount}/${maxEnergy}`,
      });
    case "abilityStart":
      return t("pvp.combatLog.abilityStart", {
        actor: actorName ?? unit,
        ability: abilityLabel ?? ability,
      });
    case "damage":
      if (isMissEvent(event)) {
        return t("pvp.combatLog.miss", {
          attacker: actorName ?? unit,
          target: targetName ?? target,
          roll: formatAttackRollDetail(event, t),
        });
      }
      return t("pvp.combatLog.damage", {
        attacker: actorName ?? unit,
        amount: String(getEventAmount(event) ?? 0),
        target: targetName ?? target,
        roll: formatAttackRollDetail(event, t),
      });
    case "crit":
      return t("pvp.combatLog.crit", {
        target: targetName ?? target,
        roll: formatCritRollDetail(event, t),
      });
    case "ko":
      return t("pvp.combatLog.ko", {
        target: targetName ?? unit,
      });
    case "heal":
      return t("pvp.combatLog.heal", {
        target: targetName ?? unit,
        amount: String(getEventAmount(event) ?? 0),
      });
    case "revive":
      return t("pvp.combatLog.revive", {
        target: targetName ?? unit,
      });
    case "shieldAbsorb":
      return t("pvp.combatLog.shieldAbsorb", {
        target: targetName ?? unit,
        amount: String(getEventAmount(event) ?? 0),
      });
    case "swap":
      return t("pvp.combatLog.swap", {
        player: actorName ?? player,
      });
    case "formation":
      return t("pvp.combatLog.formation");
    case "pass":
      return t("pvp.combatLog.pass", {
        player: actorName ?? player,
      });
    case "concede":
      return t("pvp.combatLog.concede", {
        player: actorName ?? player,
      });
    case "timeout":
      return t("pvp.combatLog.timeout", {
        player: actorName ?? player,
      });
    case "statusApply":
      return t("pvp.combatLog.statusApply", {
        target: targetName ?? unit,
        status: localizeStatusName(getEventStatusName(event) ?? "", t),
      });
    case "statusTick":
      return t("pvp.combatLog.statusTick", {
        target: targetName ?? unit,
        status: localizeStatusName(getEventStatusName(event) ?? "", t),
      });
    case "statusExpire":
      return t("pvp.combatLog.statusExpire", {
        status: localizeStatusName(getEventStatusName(event) ?? "", t),
        target: targetName ?? unit,
      });
    case "statusCleanse":
      return t("pvp.combatLog.statusCleanse", {
        target: targetName ?? unit,
        status: localizeStatusName(getEventStatusName(event) ?? "", t),
      });
    case "passiveRoll":
      return t(
        didEventRollPass(event)
          ? "pvp.combatLog.passiveRollPass"
          : "pvp.combatLog.passiveRollFail",
        {
          unit: actorName ?? unit,
          ability: abilityLabel ?? ability,
          roll: formatChanceRollDetail(event),
        },
      );
    case "passiveTrigger":
      return t("pvp.combatLog.passiveTrigger", {
        unit: actorName ?? unit,
        ability: abilityLabel ?? ability,
      });
    case "statusRoll":
      return t(
        didEventRollPass(event)
          ? "pvp.combatLog.statusRollPass"
          : "pvp.combatLog.statusRollFail",
        {
          target: targetName ?? unit,
          status: localizeStatusName(getEventStatusName(event) ?? "", t),
          roll: formatChanceRollDetail(event),
        },
      );
    case "randomStatusRoll":
      return t("pvp.combatLog.randomStatusRoll", {
        target: targetName ?? unit,
        status: localizeStatusName(getEventStatusName(event) ?? "", t),
        roll: formatRandomChoiceDetail(event, t),
      });
    case "cooldownTick":
      return t("pvp.combatLog.cooldownTick", {
        target: targetName ?? unit,
        ability: abilityLabel ?? ability,
        count: String(getEventRemaining(event) ?? 0),
      });
    case "freeze_skip":
      return t("pvp.combatLog.freezeSkip", {
        target: targetName ?? unit,
      });
    case "stun_consume":
      return t("pvp.combatLog.stunConsume", {
        target: targetName ?? unit,
      });
    case "coverRedirect":
      return t("pvp.combatLog.coverRedirect", {
        source: sourceName ?? target,
        target: destinationName ?? unit,
      });
    case "thorns":
      return t("pvp.combatLog.thorns", {
        source: sourceName ?? unit,
        target: targetName ?? target,
        amount: String(getEventAmount(event) ?? 0),
      });
    case "counter":
      return t("pvp.combatLog.counter", {
        source: sourceName ?? unit,
        target: targetName ?? target,
        amount: String(getEventAmount(event) ?? 0),
      });
    case "preventDeath":
      return t("pvp.combatLog.preventDeath", {
        target: targetName ?? unit,
        ability: abilityLabel ?? ability,
      });
    case "statusSteal":
      return t("pvp.combatLog.statusSteal", {
        status: localizeStatusName(getEventStatusName(event) ?? "", t),
        source: sourceName ?? target,
        target: destinationName ?? unit,
      });
    case "swapHp":
      return t("pvp.combatLog.swapHp", {
        actor: actorName ?? unit,
        target: targetName ?? target,
      });
    case "gameOver":
      if (isDrawEvent(event)) {
        return t("pvp.combatLog.draw");
      }

      return t("pvp.combatLog.winner", {
        winner: winnerLabel ?? t("pvp.combatLog.unknown"),
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
    case "timeout":
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
    case "timeout":
      return "text-infoDark";
    default:
      return "text-fg";
  }
}

export function CombatLogModal({
  visible,
  log,
  battleState,
  onClose,
}: CombatLogModalProps) {
  const { t } = useTranslation();
  const recentLog = useMemo(
    () =>
      log
        .map((event, index) => ({
          event,
          key: getCombatLogEventKey(event, index),
        }))
        .reverse()
        .slice(0, 30),
    [log],
  );
  const resolvers = useMemo(
    () => buildCombatLogResolvers(battleState),
    [battleState],
  );

  return (
    <BattleFullScreenSheet
      visible={visible}
      title={t("pvp.combatLog.title")}
      onClose={onClose}
      testID="pvp-combat-log-modal"
    >
      <View className="gap-3 px-4 py-4">
        {recentLog.length === 0 ? (
          <View className="rounded-3xl border border-primaryTint bg-white px-6 py-10">
            <Text className="text-center font-nunito text-fgMuted">
              {t("pvp.combatLog.empty")}
            </Text>
          </View>
        ) : (
          recentLog.map(({ event, key }) => (
            <View
              key={key}
              className={`rounded-3xl border px-4 py-3 ${getEventClasses(event.type)}`}
            >
              <View className="flex-row items-start justify-between gap-3">
                <Text
                  className={`flex-1 font-nunito text-sm leading-5 ${getEventTextClass(event.type)}`}
                >
                  {summarizeCombatEvent(event, t, resolvers)}
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
