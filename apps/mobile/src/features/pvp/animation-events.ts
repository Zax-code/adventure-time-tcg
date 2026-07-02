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
  sourceIndex: number,
  targetInstanceId: string | null,
  type: UnitAnimationEvent["type"],
  delayMs: number,
) {
  if (!targetInstanceId) {
    return false;
  }

  unitAnimationEvents.push({
    key: getVisualEventKey(event, sourceIndex, "unit", type, targetInstanceId),
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

function getVisualEventKey(
  event: CombatEvent,
  sourceIndex: number,
  channel: "float" | "unit",
  visualType: string,
  targetInstanceId: string,
) {
  return [
    event.turn,
    event.seq,
    sourceIndex,
    event.type,
    channel,
    visualType,
    targetInstanceId,
  ].join(":");
}

export function buildPvpVisualEvents(events: CombatEvent[]): PvpVisualEvents {
  const floatingEvents: FloatingEvent[] = [];
  const unitAnimationEvents: UnitAnimationEvent[] = [];
  let visualStep = 0;

  for (const [sourceIndex, event] of events.entries()) {
    const delayMs = visualStep * VISUAL_EVENT_STAGGER_MS;
    let emittedVisual = false;

    if (event.type === "damage") {
      const targetInstanceId = getEventTargetInstanceId(event);
      const amount = getEventAmount(event) ?? 0;

      if (targetInstanceId) {
        const type = isMissEvent(event)
          ? "miss"
          : isCritEvent(event)
            ? "crit"
            : "damage";
        floatingEvents.push({
          key: getVisualEventKey(
            event,
            sourceIndex,
            "float",
            type,
            targetInstanceId,
          ),
          seq: event.seq,
          targetInstanceId,
          type,
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
            sourceIndex,
            targetInstanceId,
            "damage",
            delayMs,
          ) || emittedVisual;
      }
    } else if (event.type === "shieldAbsorb") {
      emittedVisual = pushUnitAnimation(
        unitAnimationEvents,
        event,
        sourceIndex,
        getEventTargetInstanceId(event),
        "damage",
        delayMs,
      );
    } else if (event.type === "heal") {
      const targetInstanceId = getEventTargetInstanceId(event);
      const amount = getEventAmount(event) ?? 0;

      if (targetInstanceId && amount > 0) {
        floatingEvents.push({
          key: getVisualEventKey(
            event,
            sourceIndex,
            "float",
            "heal",
            targetInstanceId,
          ),
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
            sourceIndex,
            targetInstanceId,
            "heal",
            delayMs,
          ) || emittedVisual;
      }
    } else if (event.type === "ko") {
      emittedVisual = pushUnitAnimation(
        unitAnimationEvents,
        event,
        sourceIndex,
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
          sourceIndex,
          targetInstanceId,
          "buff",
          delayMs,
        );
      } else if (statusName && DEBUFF_STATUS_NAMES.has(statusName)) {
        emittedVisual = pushUnitAnimation(
          unitAnimationEvents,
          event,
          sourceIndex,
          targetInstanceId,
          "debuff",
          delayMs,
        );
      }
    } else if (event.type === "swap") {
      emittedVisual = pushUnitAnimation(
        unitAnimationEvents,
        event,
        sourceIndex,
        getEventActiveOutId(event),
        "swap-out",
        delayMs,
      );
      emittedVisual =
        pushUnitAnimation(
          unitAnimationEvents,
          event,
          sourceIndex,
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

function getLatestVisualTurnEvents(
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
