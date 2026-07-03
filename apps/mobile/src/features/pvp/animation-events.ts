import {
  getEventActiveOutId,
  getEventAmount,
  getEventActorId,
  getEventBenchInId,
  getEventSourceId,
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

type IndexedCombatEvent = {
  event: CombatEvent;
  sourceIndex: number;
};

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

function pushFloatingDamageEvent(
  floatingEvents: FloatingEvent[],
  event: CombatEvent,
  sourceIndex: number,
  delayMs: number,
) {
  const targetInstanceId = getEventTargetInstanceId(event);
  const amount = getEventAmount(event) ?? 0;

  if (!targetInstanceId) {
    return false;
  }

  const type = isMissEvent(event)
    ? "miss"
    : isCritEvent(event)
      ? "crit"
      : "damage";

  floatingEvents.push({
    key: getVisualEventKey(event, sourceIndex, "float", type, targetInstanceId),
    seq: event.seq,
    targetInstanceId,
    type,
    amount,
    delayMs,
  });

  return true;
}

function pushFloatingHealEvent(
  floatingEvents: FloatingEvent[],
  event: CombatEvent,
  sourceIndex: number,
  delayMs: number,
) {
  const targetInstanceId = getEventTargetInstanceId(event);
  const amount = getEventAmount(event) ?? 0;

  if (!targetInstanceId || amount <= 0) {
    return false;
  }

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

function pushOrderedTarget(targets: string[], targetInstanceId: string | null) {
  if (!targetInstanceId || targets.includes(targetInstanceId)) {
    return;
  }

  targets.push(targetInstanceId);
}

function getEventActorOrSourceId(event: CombatEvent) {
  return getEventActorId(event) ?? getEventSourceId(event);
}

function emitStandaloneVisualEvent(
  visualEvents: PvpVisualEvents,
  event: CombatEvent,
  sourceIndex: number,
  delayMs: number,
) {
  let emittedVisual = false;

  if (event.type === "damage") {
    const actorInstanceId = getEventActorOrSourceId(event);
    const targetInstanceId = getEventTargetInstanceId(event);

    emittedVisual =
      pushFloatingDamageEvent(
        visualEvents.floatingEvents,
        event,
        sourceIndex,
        delayMs,
      ) || emittedVisual;

    if (!isMissEvent(event)) {
      emittedVisual =
        pushUnitAnimation(
          visualEvents.unitAnimationEvents,
          event,
          sourceIndex,
          actorInstanceId !== targetInstanceId ? actorInstanceId : null,
          "attack",
          delayMs,
        ) || emittedVisual;
      emittedVisual =
        pushUnitAnimation(
          visualEvents.unitAnimationEvents,
          event,
          sourceIndex,
          targetInstanceId,
          "damage",
          delayMs,
        ) || emittedVisual;
    }
  } else if (event.type === "shieldAbsorb") {
    emittedVisual = pushUnitAnimation(
      visualEvents.unitAnimationEvents,
      event,
      sourceIndex,
      getEventTargetInstanceId(event),
      "damage",
      delayMs,
    );
  } else if (event.type === "heal") {
    emittedVisual =
      pushFloatingHealEvent(
        visualEvents.floatingEvents,
        event,
        sourceIndex,
        delayMs,
      ) || emittedVisual;
    emittedVisual =
      pushUnitAnimation(
        visualEvents.unitAnimationEvents,
        event,
        sourceIndex,
        getEventTargetInstanceId(event),
        "heal",
        delayMs,
      ) || emittedVisual;
  } else if (event.type === "ko") {
    emittedVisual = pushUnitAnimation(
      visualEvents.unitAnimationEvents,
      event,
      sourceIndex,
      getEventTargetInstanceId(event),
      "death",
      delayMs,
    );
  } else if (event.type === "statusApply") {
    const statusName = getEventStatusName(event);
    const targetInstanceId = getEventTargetInstanceId(event);
    const actorInstanceId = getEventActorOrSourceId(event);

    if (statusName && BUFF_STATUS_NAMES.has(statusName)) {
      emittedVisual = pushUnitAnimation(
        visualEvents.unitAnimationEvents,
        event,
        sourceIndex,
        actorInstanceId !== targetInstanceId ? actorInstanceId : null,
        "buff-cast",
        delayMs,
      );
      emittedVisual =
        pushUnitAnimation(
          visualEvents.unitAnimationEvents,
          event,
          sourceIndex,
          targetInstanceId,
          "buff",
          delayMs,
        ) || emittedVisual;
    } else if (statusName && DEBUFF_STATUS_NAMES.has(statusName)) {
      emittedVisual = pushUnitAnimation(
        visualEvents.unitAnimationEvents,
        event,
        sourceIndex,
        actorInstanceId !== targetInstanceId ? actorInstanceId : null,
        "attack",
        delayMs,
      );
      emittedVisual =
        pushUnitAnimation(
          visualEvents.unitAnimationEvents,
          event,
          sourceIndex,
          targetInstanceId,
          "damage",
          delayMs,
        ) || emittedVisual;
    }
  } else if (event.type === "swap") {
    emittedVisual = pushUnitAnimation(
      visualEvents.unitAnimationEvents,
      event,
      sourceIndex,
      getEventActiveOutId(event),
      "swap-out",
      delayMs,
    );
    emittedVisual =
      pushUnitAnimation(
        visualEvents.unitAnimationEvents,
        event,
        sourceIndex,
        getEventBenchInId(event),
        "swap-in",
        delayMs,
      ) || emittedVisual;
  }

  return emittedVisual;
}

function emitAbilitySegmentVisualEvents(
  visualEvents: PvpVisualEvents,
  abilityStart: IndexedCombatEvent,
  segmentEvents: IndexedCombatEvent[],
  baseDelayMs: number,
) {
  const offenseTargets: string[] = [];
  const buffTargets: string[] = [];
  const otherEvents: IndexedCombatEvent[] = [];
  const actorInstanceId = getEventActorOrSourceId(abilityStart.event);
  let emittedVisual = false;

  for (const { event, sourceIndex } of segmentEvents) {
    if (event.type === "damage") {
      emittedVisual =
        pushFloatingDamageEvent(
          visualEvents.floatingEvents,
          event,
          sourceIndex,
          baseDelayMs,
        ) || emittedVisual;

      if (!isMissEvent(event)) {
        pushOrderedTarget(offenseTargets, getEventTargetInstanceId(event));
      }
      continue;
    }

    if (event.type === "shieldAbsorb") {
      pushOrderedTarget(offenseTargets, getEventTargetInstanceId(event));
      continue;
    }

    if (event.type === "statusApply") {
      const statusName = getEventStatusName(event);

      if (statusName && DEBUFF_STATUS_NAMES.has(statusName)) {
        pushOrderedTarget(offenseTargets, getEventTargetInstanceId(event));
      } else if (statusName && BUFF_STATUS_NAMES.has(statusName)) {
        pushOrderedTarget(buffTargets, getEventTargetInstanceId(event));
      }
      continue;
    }

    otherEvents.push({ event, sourceIndex });
  }

  if (offenseTargets.length > 0) {
    emittedVisual =
      pushUnitAnimation(
        visualEvents.unitAnimationEvents,
        abilityStart.event,
        abilityStart.sourceIndex,
        actorInstanceId,
        "attack",
        baseDelayMs,
      ) || emittedVisual;
  }

  for (const targetInstanceId of offenseTargets) {
    emittedVisual =
      pushUnitAnimation(
        visualEvents.unitAnimationEvents,
        abilityStart.event,
        abilityStart.sourceIndex,
        targetInstanceId,
        "damage",
        baseDelayMs,
      ) || emittedVisual;
  }

  const buffDelayMs =
    baseDelayMs + (offenseTargets.length > 0 ? VISUAL_EVENT_STAGGER_MS : 0);

  if (buffTargets.length > 0) {
    emittedVisual =
      pushUnitAnimation(
        visualEvents.unitAnimationEvents,
        abilityStart.event,
        abilityStart.sourceIndex,
        actorInstanceId,
        "buff-cast",
        buffDelayMs,
      ) || emittedVisual;
  }

  for (const targetInstanceId of buffTargets) {
    emittedVisual =
      pushUnitAnimation(
        visualEvents.unitAnimationEvents,
        abilityStart.event,
        abilityStart.sourceIndex,
        targetInstanceId,
        "buff",
        buffDelayMs,
      ) || emittedVisual;
  }

  let otherStep =
    (offenseTargets.length > 0 ? 1 : 0) + (buffTargets.length > 0 ? 1 : 0);

  for (const { event, sourceIndex } of otherEvents) {
    const delayMs = baseDelayMs + otherStep * VISUAL_EVENT_STAGGER_MS;
    if (emitStandaloneVisualEvent(visualEvents, event, sourceIndex, delayMs)) {
      otherStep += 1;
      emittedVisual = true;
    }
  }

  return {
    emittedVisual,
    stepsUsed: Math.max(otherStep, emittedVisual ? 1 : 0),
  };
}

export function buildPvpVisualEvents(events: CombatEvent[]): PvpVisualEvents {
  const visualEvents: PvpVisualEvents = {
    floatingEvents: [],
    unitAnimationEvents: [],
  };
  let visualStep = 0;
  let index = 0;

  while (index < events.length) {
    const event = events[index];
    const delayMs = visualStep * VISUAL_EVENT_STAGGER_MS;

    if (event.type === "abilityStart") {
      const segmentEvents: IndexedCombatEvent[] = [];
      let nextIndex = index + 1;

      while (
        nextIndex < events.length &&
        events[nextIndex].type !== "abilityStart"
      ) {
        segmentEvents.push({
          event: events[nextIndex],
          sourceIndex: nextIndex,
        });
        nextIndex += 1;
      }

      const result = emitAbilitySegmentVisualEvents(
        visualEvents,
        { event, sourceIndex: index },
        segmentEvents,
        delayMs,
      );

      if (result.emittedVisual) {
        visualStep += result.stepsUsed;
      }

      index = nextIndex;
      continue;
    }

    if (emitStandaloneVisualEvent(visualEvents, event, index, delayMs)) {
      visualStep += 1;
    }

    index += 1;
  }

  return visualEvents;
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
