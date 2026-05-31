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
    promise.resolve(null)
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
}
