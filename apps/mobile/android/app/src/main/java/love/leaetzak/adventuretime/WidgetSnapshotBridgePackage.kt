package love.leaetzak.adventuretime

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class WidgetSnapshotBridgePackage : BaseReactPackage() {
  override fun getModule(
    name: String,
    reactContext: ReactApplicationContext,
  ): NativeModule? =
    if (name == WidgetSnapshotBridgeModule.NAME) {
      WidgetSnapshotBridgeModule(reactContext)
    } else {
      null
    }

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider =
    ReactModuleInfoProvider {
      mapOf(
        WidgetSnapshotBridgeModule.NAME to
          ReactModuleInfo(
            WidgetSnapshotBridgeModule.NAME,
            WidgetSnapshotBridgeModule::class.java.name,
            false,
            false,
            false,
            false,
          ),
      )
    }
}
