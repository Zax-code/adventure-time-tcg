import {
  getEventActiveOutId,
  getEventAmount,
  getEventBenchInId,
  getEventStatusName,
  getEventTargetInstanceId,
  isCritEvent,
  isMissEvent,
} from "./event-payload";
import type {
  FloatingEvent,
  PvpBattleState,
  UnitAnimationEvent,
} from "./types";

type CombatEvent = PvpBattleState["log"][number];

const BUFF_STATUS_NAMES = new Set([
  "Shield",
  "GuardUp",
  "Haste",
  "Regeneration",
  "Cover",
  "Thorns",
  "Stealth",
  "Empower",
  "Counter",
  "Barrier",
]);

const DEBUFF_STATUS_NAMES = new Set([
  "Burn",
  "Freeze",
  "Vulnerable",
  "Weakened",
  "Silence",
  "Stunned",
  "Poison",
  "Mark",
  "Doom",
]);

export interface PvpVisualEvents {
  floatingEvents: FloatingEvent[];
  unitAnimationEvents: UnitAnimationEvent[];
}

function pushUnitAnimation(
  unitAnimationEvents: UnitAnimationEvent[],
  event: CombatEvent,
  targetInstanceId: string | null,
  type: UnitAnimationEvent["type"],
) {
  if (!targetInstanceId) {
    return;
  }

  unitAnimationEvents.push({
    seq: event.seq,
    targetInstanceId,
    type,
  });
}

export function buildPvpVisualEvents(events: CombatEvent[]): PvpVisualEvents {
  const floatingEvents: FloatingEvent[] = [];
  const unitAnimationEvents: UnitAnimationEvent[] = [];

  for (const event of events) {
    if (event.type === "damage" || event.type === "crit") {
      const targetInstanceId = getEventTargetInstanceId(event);
      const amount = getEventAmount(event) ?? 0;

      if (targetInstanceId) {
        floatingEvents.push({
          seq: event.seq,
          targetInstanceId,
          type: isMissEvent(event)
            ? "miss"
            : isCritEvent(event)
              ? "crit"
              : "damage",
          amount,
        });
      }

      if (!isMissEvent(event)) {
        pushUnitAnimation(
          unitAnimationEvents,
          event,
          targetInstanceId,
          "damage",
        );
      }
    } else if (event.type === "shieldAbsorb") {
      pushUnitAnimation(
        unitAnimationEvents,
        event,
        getEventTargetInstanceId(event),
        "damage",
      );
    } else if (event.type === "heal") {
      const targetInstanceId = getEventTargetInstanceId(event);
      const amount = getEventAmount(event) ?? 0;

      if (targetInstanceId && amount > 0) {
        floatingEvents.push({
          seq: event.seq,
          targetInstanceId,
          type: "heal",
          amount,
        });
        pushUnitAnimation(unitAnimationEvents, event, targetInstanceId, "heal");
      }
    } else if (event.type === "ko") {
      pushUnitAnimation(
        unitAnimationEvents,
        event,
        getEventTargetInstanceId(event),
        "death",
      );
    } else if (event.type === "statusApply") {
      const statusName = getEventStatusName(event);
      const targetInstanceId = getEventTargetInstanceId(event);

      if (statusName && BUFF_STATUS_NAMES.has(statusName)) {
        pushUnitAnimation(unitAnimationEvents, event, targetInstanceId, "buff");
      } else if (statusName && DEBUFF_STATUS_NAMES.has(statusName)) {
        pushUnitAnimation(
          unitAnimationEvents,
          event,
          targetInstanceId,
          "debuff",
        );
      }
    } else if (event.type === "swap") {
      pushUnitAnimation(
        unitAnimationEvents,
        event,
        getEventActiveOutId(event),
        "swap-out",
      );
      pushUnitAnimation(
        unitAnimationEvents,
        event,
        getEventBenchInId(event),
        "swap-in",
      );
    }
  }

  return { floatingEvents, unitAnimationEvents };
}
