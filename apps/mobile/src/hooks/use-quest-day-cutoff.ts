import { useEffect, useRef } from "react";
import { AppState } from "react-native";

import {
  getNextQuestDayBoundaryMs,
  QuestDayCutoffController,
  type QuestDayCutoffEvent,
  type QuestRouteContext,
} from "../features/quests/quest-day-cutoff";

const IS_E2E_BUILD = process.env.EXPO_PUBLIC_E2E_AUTH === "1";

type UseQuestDayCutoffOptions = {
  enabled: boolean;
  sessionKey: string | null;
  testTrigger?: string | null;
  timeZone: string;
  onTestTriggerConsumed?: () => void;
  routeContext: QuestRouteContext;
  onDayChanged: (event: QuestDayCutoffEvent) => void;
  onQuestCutoff: (
    event: QuestDayCutoffEvent,
    routeContext: QuestRouteContext,
  ) => void;
};

export function useQuestDayCutoff({
  enabled,
  sessionKey,
  testTrigger = null,
  timeZone,
  onTestTriggerConsumed,
  routeContext,
  onDayChanged,
  onQuestCutoff,
}: UseQuestDayCutoffOptions) {
  const routeContextRef = useRef(routeContext);
  const onDayChangedRef = useRef(onDayChanged);
  const onQuestCutoffRef = useRef(onQuestCutoff);
  const onTestTriggerConsumedRef = useRef(onTestTriggerConsumed);
  const handledTestTriggerRef = useRef<string | null>(null);

  routeContextRef.current = routeContext;
  onDayChangedRef.current = onDayChanged;
  onQuestCutoffRef.current = onQuestCutoff;
  onTestTriggerConsumedRef.current = onTestTriggerConsumed;

  useEffect(() => {
    if (!enabled || !sessionKey) return;

    const controller = new QuestDayCutoffController({
      timeZone,
      getRouteContext: () => routeContextRef.current,
      onDayChanged: (event) => onDayChangedRef.current(event),
      onQuestCutoff: (event, activeRouteContext) =>
        onQuestCutoffRef.current(event, activeRouteContext),
    });
    controller.start();

    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        controller.checkNow();
      }
    });

    return () => {
      subscription.remove();
      controller.stop();
    };
  }, [enabled, sessionKey, timeZone]);

  useEffect(() => {
    if (
      !IS_E2E_BUILD ||
      !enabled ||
      !sessionKey ||
      !testTrigger ||
      handledTestTriggerRef.current === `${sessionKey}:${testTrigger}`
    ) {
      return;
    }

    handledTestTriggerRef.current = `${sessionKey}:${testTrigger}`;
    onTestTriggerConsumedRef.current?.();
    let simulatedNow = Date.now();
    const controller = new QuestDayCutoffController({
      timeZone,
      getNow: () => simulatedNow,
      getRouteContext: () => routeContextRef.current,
      onDayChanged: (event) => onDayChangedRef.current(event),
      onQuestCutoff: (event, activeRouteContext) =>
        onQuestCutoffRef.current(event, activeRouteContext),
    });

    try {
      controller.start();
      simulatedNow = getNextQuestDayBoundaryMs(simulatedNow, timeZone) + 1;
      controller.checkNow();
    } finally {
      controller.stop();
    }
  }, [enabled, sessionKey, testTrigger, timeZone]);
}
