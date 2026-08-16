package expo.modules.playintegrity

import com.google.android.play.core.integrity.StandardIntegrityManager
import com.google.android.play.core.integrity.IntegrityManagerFactory
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class PlayIntegrityModule : Module() {
  private var tokenProvider: StandardIntegrityManager.StandardIntegrityTokenProvider? = null

  override fun definition() = ModuleDefinition {
    Name("PlayIntegrity")

    AsyncFunction("prepareAsync") { cloudProjectNumber: Double, promise: Promise ->
      val context = appContext.reactContext
      if (context == null) {
        promise.reject("ERR_PLAY_INTEGRITY_UNAVAILABLE", "Android context is unavailable", null)
        return@AsyncFunction
      }

      val manager = IntegrityManagerFactory.createStandard(context)
      val request = StandardIntegrityManager.PrepareIntegrityTokenRequest.builder()
        .setCloudProjectNumber(cloudProjectNumber.toLong())
        .build()

      manager.prepareIntegrityToken(request)
        .addOnSuccessListener { provider ->
          tokenProvider = provider
          promise.resolve(null)
        }
        .addOnFailureListener { error ->
          tokenProvider = null
          promise.reject("ERR_PLAY_INTEGRITY_PREPARE", "Play Integrity is unavailable", error)
        }
    }

    AsyncFunction("requestTokenAsync") { requestHash: String, promise: Promise ->
      val provider = tokenProvider
      if (provider == null) {
        promise.reject("ERR_PLAY_INTEGRITY_NOT_PREPARED", "Play Integrity is not prepared", null)
        return@AsyncFunction
      }

      val request = StandardIntegrityManager.StandardIntegrityTokenRequest.builder()
        .setRequestHash(requestHash)
        .build()

      provider.request(request)
        .addOnSuccessListener { response -> promise.resolve(response.token()) }
        .addOnFailureListener { error ->
          promise.reject("ERR_PLAY_INTEGRITY_REQUEST", "Play Integrity request failed", error)
        }
    }
  }
}
