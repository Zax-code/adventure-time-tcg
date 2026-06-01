import { NativeModules, Platform } from "react-native";

import type { QuestsResponse } from "@adventure-time/api-client";

import { getTranslation } from "../i18n";
import type { Locale } from "../i18n/types";
import type { ThemeName } from "../theme/themes";

export type StepQuestWidgetStatus =
  | "active"
  | "completed"
  | "claimed"
  | "failed";

export interface StepQuestWidgetSnapshot {
  questType: "steps_10k";
  themeName: ThemeName;
  title: string;
  progress: number;
  target: number;
  reward: number;
  status: StepQuestWidgetStatus;
  recordedFor: string;
  deepLink: string;
  updatedAt: string;
  progressLabel: string;
  statusLabel: string;
  subtitle: string;
}

interface WidgetSnapshotBridgeModule {
  setStepQuestSnapshot: (snapshotJson: string) => Promise<void>;
  clearStepQuestSnapshot: () => Promise<void>;
  setStepQuestSyncContext: (contextJson: string) => Promise<void>;
}

interface StepQuestWidgetSyncContext {
  apiBaseUrl: string;
  themeName: ThemeName;
}

const widgetSnapshotBridge = NativeModules
  .WidgetSnapshotBridge as WidgetSnapshotBridgeModule | undefined;

export const STEP_QUEST_WIDGET_DEEP_LINK =
  "adventure-time://widget-quests?focus=steps";

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatNumber(value: number, locale: Locale) {
  try {
    return new Intl.NumberFormat(locale).format(value);
  } catch {
    return value.toLocaleString();
  }
}

function getQuestStatus(quest: {
  claimed: boolean;
  completed: boolean;
  failed: boolean;
}): StepQuestWidgetStatus {
  if (quest.claimed) {
    return "claimed";
  }

  if (quest.completed) {
    return "completed";
  }

  if (quest.failed) {
    return "failed";
  }

  return "active";
}

function getQuestTitle(locale: Locale, titleKey: string) {
  const translated = getTranslation(locale, `quests.${titleKey}`);
  return translated.startsWith("quests.") ? titleKey : translated;
}

export function buildStepQuestWidgetSnapshot(
  questsResponse: QuestsResponse,
  locale: Locale,
  themeName: ThemeName,
): StepQuestWidgetSnapshot | null {
  const quest = questsResponse.quests.find((entry) => entry.type === "steps_10k");

  if (!quest) {
    return null;
  }

  const status = getQuestStatus(quest);
  const progress = Math.max(quest.progress, 0);
  const remaining = Math.max(0, quest.target - progress);
  const rewardLabel = formatNumber(quest.reward, locale);

  let statusLabel = getTranslation(locale, "quests.progress");
  let subtitle = getTranslation(locale, "quests.widgetRemainingSteps", {
    count: formatNumber(remaining, locale),
  });

  if (status === "completed") {
    statusLabel = getTranslation(locale, "quests.claim");
    subtitle = getTranslation(locale, "quests.widgetReadyToClaim", {
      reward: rewardLabel,
    });
  } else if (status === "claimed") {
    statusLabel = getTranslation(locale, "quests.claim");
    subtitle = getTranslation(locale, "quests.widgetClaimedToday");
  } else if (status === "failed") {
    subtitle = getTranslation(locale, "quests.widgetFailedToday");
  }

  return {
    questType: "steps_10k",
    themeName,
    title: getQuestTitle(locale, quest.title),
    progress,
    target: quest.target,
    reward: quest.reward,
    status,
    recordedFor: formatLocalDate(new Date()),
    deepLink: STEP_QUEST_WIDGET_DEEP_LINK,
    updatedAt: new Date().toISOString(),
    progressLabel: `${formatNumber(progress, locale)} / ${formatNumber(
      quest.target,
      locale,
    )}`,
    statusLabel,
    subtitle,
  };
}

export async function writeStepQuestWidgetSnapshot(
  snapshot: StepQuestWidgetSnapshot,
) {
  if (!widgetSnapshotBridge) {
    return;
  }

  await widgetSnapshotBridge.setStepQuestSnapshot(JSON.stringify(snapshot));
}

export async function clearStepQuestWidgetSnapshot() {
  if (!widgetSnapshotBridge) {
    return;
  }

  await widgetSnapshotBridge.clearStepQuestSnapshot();
}

export async function setStepQuestWidgetSyncContext(
  context: StepQuestWidgetSyncContext,
) {
  if (!widgetSnapshotBridge) {
    return;
  }

  await widgetSnapshotBridge.setStepQuestSyncContext(JSON.stringify(context));
}

export async function syncStepQuestWidgetSnapshot(
  questsResponse: QuestsResponse,
  locale: Locale,
  themeName: ThemeName,
) {
  const snapshot = buildStepQuestWidgetSnapshot(questsResponse, locale, themeName);

  if (!snapshot) {
    await clearStepQuestWidgetSnapshot();
    return;
  }

  await writeStepQuestWidgetSnapshot(snapshot);
}

export function isWidgetSnapshotBridgeAvailable() {
  return Platform.OS === "ios" || Platform.OS === "android"
    ? Boolean(widgetSnapshotBridge)
    : false;
}
