package love.leaetzak.adventuretime

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class WidgetSnapshotBridgeModule(
  reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "WidgetSnapshotBridge"

  @ReactMethod
  fun setStepQuestSnapshot(snapshotJson: String, promise: Promise) {
    try {
      StepQuestWidgetStore.writeSnapshot(reactApplicationContext, snapshotJson)
      StepQuestWidgetProvider.updateAllWidgets(reactApplicationContext)
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("WIDGET_SNAPSHOT_WRITE_FAILED", error)
    }
  }

  @ReactMethod
  fun setStepQuestSyncContext(contextJson: String, promise: Promise) {
    try {
      StepQuestWidgetStore.writeSyncContext(reactApplicationContext, contextJson)
      StepQuestWidgetProvider.updateAllWidgets(reactApplicationContext)
      StepQuestWidgetBackgroundSync.schedulePeriodic(reactApplicationContext)
      StepQuestWidgetBackgroundSync.enqueueOneTime(reactApplicationContext)
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("WIDGET_SYNC_CONTEXT_WRITE_FAILED", error)
    }
  }

  @ReactMethod
  fun clearStepQuestSnapshot(promise: Promise) {
    try {
      StepQuestWidgetStore.clearSnapshot(reactApplicationContext)
      StepQuestWidgetProvider.updateAllWidgets(reactApplicationContext)
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("WIDGET_SNAPSHOT_CLEAR_FAILED", error)
    }
  }

  @ReactMethod
  fun clearStepQuestSyncContext(promise: Promise) {
    try {
      StepQuestWidgetStore.clearSyncContext(reactApplicationContext)
      StepQuestWidgetBackgroundSync.cancel(reactApplicationContext)
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("WIDGET_SYNC_CONTEXT_CLEAR_FAILED", error)
    }
  }

  @ReactMethod
  fun getStepQuestNotificationDelivered(userId: String, recordedFor: String, promise: Promise) {
    try {
      promise.resolve(
        StepQuestWidgetStore.notificationDelivered(
          reactApplicationContext,
          userId,
          recordedFor,
        ),
      )
    } catch (error: Exception) {
      promise.reject("WIDGET_NOTIFICATION_READ_FAILED", error)
    }
  }

  @ReactMethod
  fun markStepQuestNotificationDelivered(userId: String, recordedFor: String, promise: Promise) {
    try {
      StepQuestWidgetStore.markNotificationDelivered(
        reactApplicationContext,
        userId,
        recordedFor,
      )
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("WIDGET_NOTIFICATION_WRITE_FAILED", error)
    }
  }

  @ReactMethod
  fun startStepQuestBackgroundSync(promise: Promise) {
    try {
      StepQuestWidgetBackgroundSync.schedulePeriodic(reactApplicationContext)
      StepQuestWidgetBackgroundSync.enqueueOneTime(reactApplicationContext)
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("WIDGET_BACKGROUND_SYNC_START_FAILED", error)
    }
  }
}
