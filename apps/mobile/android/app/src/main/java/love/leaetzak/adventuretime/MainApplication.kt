package love.leaetzak.adventuretime

import android.app.Application
import android.content.res.Configuration

import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.ReactPackage
import com.facebook.react.ReactHost
import com.facebook.react.common.ReleaseLevel
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint

import expo.modules.ApplicationLifecycleDispatcher
import expo.modules.ExpoReactHostFactory
import org.wonday.orientation.OrientationActivityLifecycle

class MainApplication : Application(), ReactApplication {
  private val packageList: List<ReactPackage> by lazy {
    PackageList(this).packages.apply {
      add(WidgetSnapshotBridgePackage())
    }
  }

  private val jsMainModulePath = ".expo/.virtual-metro-entry"
  private val jsBundleAssetPath = "index.android.bundle"

  override val reactHost: ReactHost by lazy {
    ExpoReactHostFactory.getDefaultReactHost(
      context = applicationContext,
      packageList = packageList,
      jsMainModulePath = jsMainModulePath,
      jsBundleAssetPath = jsBundleAssetPath,
      useDevSupport = BuildConfig.DEBUG,
    )
  }

  override fun onCreate() {
    super.onCreate()
    registerActivityLifecycleCallbacks(OrientationActivityLifecycle.getInstance())
    DefaultNewArchitectureEntryPoint.releaseLevel = try {
      ReleaseLevel.valueOf(BuildConfig.REACT_NATIVE_RELEASE_LEVEL.uppercase())
    } catch (e: IllegalArgumentException) {
      ReleaseLevel.STABLE
    }
    loadReactNative(this)
    ApplicationLifecycleDispatcher.onApplicationCreate(this)
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    ApplicationLifecycleDispatcher.onConfigurationChanged(this, newConfig)
  }
}
