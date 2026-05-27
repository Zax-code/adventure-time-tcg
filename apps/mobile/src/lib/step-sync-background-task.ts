import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";

import {
  STEP_SYNC_BACKGROUND_TASK,
  configureStepNotifications,
  syncDeviceStepsNow,
} from "./step-sync";

if (!TaskManager.isTaskDefined(STEP_SYNC_BACKGROUND_TASK)) {
  TaskManager.defineTask(STEP_SYNC_BACKGROUND_TASK, async () => {
    try {
      await configureStepNotifications();
      await syncDeviceStepsNow({
        allowPermissionPrompt: false,
        interactive: false,
        source: "background_task",
      });
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch (error) {
      console.error("Background step sync failed", error);
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
}
