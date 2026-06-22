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

const VISUAL_EVENT_STAGGER_MS = 360;

export interface PvpVisualEvents {
  floatingEvents: FloatingEvent[];
  unitAnimationEvents: UnitAnimationEvent[];
}

function pushUnitAnimation(
  unitAnimationEvents: UnitAnimationEvent[],
  event: CombatEvent,
  targetInstanceId: string | null,
  type: UnitAnimationEvent["type"],
  delayMs: number,
) {
  if (!targetInstanceId) {
    return false;
  }

  unitAnimationEvents.push({
    seq: event.seq,
    targetInstanceId,
    type,
    delayMs,
  });

  return true;
}

function hasVisualEvents(events: PvpVisualEvents) {
  return (
    events.floatingEvents.length > 0 || events.unitAnimationEvents.length > 0
  );
}

export function buildPvpVisualEvents(events: CombatEvent[]): PvpVisualEvents {
  const floatingEvents: FloatingEvent[] = [];
  const unitAnimationEvents: UnitAnimationEvent[] = [];
  let visualStep = 0;

  for (const event of events) {
    const delayMs = visualStep * VISUAL_EVENT_STAGGER_MS;
    let emittedVisual = false;

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
          delayMs,
        });
        emittedVisual = true;
      }

      if (!isMissEvent(event)) {
        emittedVisual =
          pushUnitAnimation(
            unitAnimationEvents,
            event,
            targetInstanceId,
            "damage",
            delayMs,
          ) || emittedVisual;
      }
    } else if (event.type === "shieldAbsorb") {
      emittedVisual = pushUnitAnimation(
        unitAnimationEvents,
        event,
        getEventTargetInstanceId(event),
        "damage",
        delayMs,
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
          delayMs,
        });
        emittedVisual = true;
        emittedVisual =
          pushUnitAnimation(
            unitAnimationEvents,
            event,
            targetInstanceId,
            "heal",
            delayMs,
          ) || emittedVisual;
      }
    } else if (event.type === "ko") {
      emittedVisual = pushUnitAnimation(
        unitAnimationEvents,
        event,
        getEventTargetInstanceId(event),
        "death",
        delayMs,
      );
    } else if (event.type === "statusApply") {
      const statusName = getEventStatusName(event);
      const targetInstanceId = getEventTargetInstanceId(event);

      if (statusName && BUFF_STATUS_NAMES.has(statusName)) {
        emittedVisual = pushUnitAnimation(
          unitAnimationEvents,
          event,
          targetInstanceId,
          "buff",
          delayMs,
        );
      } else if (statusName && DEBUFF_STATUS_NAMES.has(statusName)) {
        emittedVisual = pushUnitAnimation(
          unitAnimationEvents,
          event,
          targetInstanceId,
          "debuff",
          delayMs,
        );
      }
    } else if (event.type === "swap") {
      emittedVisual = pushUnitAnimation(
        unitAnimationEvents,
        event,
        getEventActiveOutId(event),
        "swap-out",
        delayMs,
      );
      emittedVisual =
        pushUnitAnimation(
          unitAnimationEvents,
          event,
          getEventBenchInId(event),
          "swap-in",
          delayMs,
        ) || emittedVisual;
    }

    if (emittedVisual) {
      visualStep += 1;
    }
  }

  return { floatingEvents, unitAnimationEvents };
}

export function getLatestVisualTurnEvents(
  events: CombatEvent[],
): CombatEvent[] {
  const checkedTurns = new Set<number>();

  for (let index = events.length - 1; index >= 0; index -= 1) {
    const turn = events[index].turn;

    if (checkedTurns.has(turn)) {
      continue;
    }

    checkedTurns.add(turn);

    const turnEvents = events.filter((event) => event.turn === turn);
    if (hasVisualEvents(buildPvpVisualEvents(turnEvents))) {
      return turnEvents;
    }
  }

  return [];
}

export function buildLatestTurnPvpVisualEvents(
  events: CombatEvent[],
): PvpVisualEvents {
  return buildPvpVisualEvents(getLatestVisualTurnEvents(events));
}
