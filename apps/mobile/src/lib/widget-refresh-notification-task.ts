import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";

import {
  WIDGET_REFRESH_NOTIFICATION_TASK,
  WIDGET_REFRESH_PUSH_EVENT,
} from "./widget-refresh-push";
import { refreshWidgetSnapshotFromServer } from "./widget-refresh-sync";

function extractTaskData(payload: Notifications.NotificationTaskPayload) {
  if (!("data" in payload) || !payload.data || typeof payload.data !== "object") {
    return null;
  }

  const rawData = payload.data as {
    dataString?: string;
    [key: string]: unknown;
  };

  if (typeof rawData.dataString === "string") {
    try {
      const parsed = JSON.parse(rawData.dataString) as Record<string, unknown>;
      return {
        ...rawData,
        ...parsed,
      };
    } catch {
      return rawData;
    }
  }

  return rawData;
}

if (!TaskManager.isTaskDefined(WIDGET_REFRESH_NOTIFICATION_TASK)) {
  TaskManager.defineTask<Notifications.NotificationTaskPayload>(
    WIDGET_REFRESH_NOTIFICATION_TASK,
    async (task) => {
      if (task.error) {
        console.error("Widget refresh notification task failed", task.error);
        return;
      }

      const data = extractTaskData(task.data);
      if (!data || data.eventType !== WIDGET_REFRESH_PUSH_EVENT) {
        return;
      }

      try {
        await refreshWidgetSnapshotFromServer();
      } catch (error) {
        console.error("Widget refresh background sync failed", error);
      }
    },
  );
}

void Notifications.registerTaskAsync(WIDGET_REFRESH_NOTIFICATION_TASK).catch(() => {
  // The task is unavailable in unsupported runtimes like web and should stay best-effort.
});
