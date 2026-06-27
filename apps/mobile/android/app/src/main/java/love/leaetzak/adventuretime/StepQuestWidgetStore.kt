package love.leaetzak.adventuretime

import android.content.Context
import org.json.JSONObject

private const val STEP_QUEST_WIDGET_PREFS = "step_quest_widget"
private const val STEP_QUEST_WIDGET_SNAPSHOT_KEY = "stepQuestWidgetSnapshot"
private const val STEP_QUEST_WIDGET_API_BASE_URL_KEY = "stepQuestWidgetApiBaseUrl"
private const val STEP_QUEST_WIDGET_ACCESS_TOKEN_KEY = "stepQuestWidgetAccessToken"
private const val STEP_QUEST_WIDGET_REFRESH_TOKEN_KEY = "stepQuestWidgetRefreshToken"
private const val STEP_QUEST_WIDGET_USER_CONTEXT_KEY = "stepQuestWidgetUserContext"
private const val STEP_QUEST_WIDGET_SERVER_SYNC_STATE_KEY = "stepQuestWidgetServerSyncState"
private const val STEP_QUEST_WIDGET_THEME_KEY = "stepQuestWidgetThemeName"
private const val STEP_QUEST_WIDGET_LOCALE_KEY = "stepQuestWidgetLocale"
private const val DEFAULT_WIDGET_DEEP_LINK = "adventure-time://quests?focus=steps"
private const val DEFAULT_WIDGET_THEME_NAME = "candy"
private const val DEFAULT_WIDGET_LOCALE = "en"

data class StepQuestWidgetSnapshot(
  val themeName: String?,
  val title: String,
  val progress: Int,
  val target: Int,
  val reward: Int,
  val status: String,
  val recordedFor: String?,
  val deepLink: String,
  val progressLabel: String,
  val statusLabel: String,
  val subtitle: String,
) {
  companion object {
    fun fromJson(snapshotJson: String): StepQuestWidgetSnapshot {
      val json = JSONObject(snapshotJson)

      return StepQuestWidgetSnapshot(
        themeName = json.optString("themeName").ifBlank { null },
        title = json.optString("title"),
        progress = json.optInt("progress", 0),
        target = json.optInt("target", 10_000),
        reward = json.optInt("reward", 0),
        status = json.optString("status", "active"),
        recordedFor = json.optString("recordedFor").ifBlank { null },
        deepLink = json.optString("deepLink", DEFAULT_WIDGET_DEEP_LINK),
        progressLabel = json.optString("progressLabel"),
        statusLabel = json.optString("statusLabel"),
        subtitle = json.optString("subtitle"),
      )
    }
  }
}

data class StepQuestWidgetSyncContext(
  val apiBaseUrl: String,
  val accessToken: String?,
  val refreshToken: String?,
  val userId: String?,
  val preferredLanguage: String,
  val preferredStepSource: String,
  val notifyStepGoal: Boolean,
) {
  companion object {
    fun fromJson(contextJson: String): StepQuestWidgetSyncContext {
      val json = JSONObject(contextJson)
      val user = json.optJSONObject("user")
      val preferences = user?.optJSONObject("notificationPreferences")
      val locale = when (user?.optString("preferredLanguage") ?: json.optString("locale")) {
        "fr" -> "fr"
        else -> DEFAULT_WIDGET_LOCALE
      }

      return StepQuestWidgetSyncContext(
        apiBaseUrl = json.optString("apiBaseUrl", "").ifBlank { "" },
        accessToken = json.optString("accessToken").ifBlank { null },
        refreshToken = json.optString("refreshToken").ifBlank { null },
        userId = user?.optString("id")?.ifBlank { null },
        preferredLanguage = locale,
        preferredStepSource = user?.optString("preferredStepSource", "device_health") ?: "device_health",
        notifyStepGoal = preferences?.optBoolean("stepGoal", true) ?: true,
      )
    }
  }
}

data class StepQuestWidgetServerSyncState(
  val recordedFor: String,
  val lastAttemptAt: Long,
  val completionAttemptedFor: String?,
) {
  fun toJson(): String {
    return JSONObject()
      .put("recordedFor", recordedFor)
      .put("lastAttemptAt", lastAttemptAt)
      .put("completionAttemptedFor", completionAttemptedFor)
      .toString()
  }

  companion object {
    fun fromJson(stateJson: String): StepQuestWidgetServerSyncState {
      val json = JSONObject(stateJson)

      return StepQuestWidgetServerSyncState(
        recordedFor = json.optString("recordedFor"),
        lastAttemptAt = json.optLong("lastAttemptAt", 0L),
        completionAttemptedFor = json.optString("completionAttemptedFor").ifBlank { null },
      )
    }
  }
}

object StepQuestWidgetStore {
  private fun preferences(context: Context) =
    context.getSharedPreferences(STEP_QUEST_WIDGET_PREFS, Context.MODE_PRIVATE)

  fun readLocale(context: Context): String {
    val storedLocale = preferences(context)
      .getString(STEP_QUEST_WIDGET_LOCALE_KEY, null)

    return normalizeLocale(storedLocale)
  }

  fun readThemeName(context: Context): String {
    val storedThemeName = preferences(context)
      .getString(STEP_QUEST_WIDGET_THEME_KEY, null)

    return normalizeThemeName(storedThemeName)
  }

  fun readSnapshot(context: Context): StepQuestWidgetSnapshot? {
    val snapshotJson = preferences(context)
      .getString(STEP_QUEST_WIDGET_SNAPSHOT_KEY, null)
      ?: return null

    return runCatching { StepQuestWidgetSnapshot.fromJson(snapshotJson) }.getOrNull()
  }

  fun writeSnapshot(context: Context, snapshotJson: String) {
    preferences(context)
      .edit()
      .putString(STEP_QUEST_WIDGET_SNAPSHOT_KEY, snapshotJson)
      .apply()
  }

  fun writeThemeName(context: Context, themeName: String) {
    preferences(context)
      .edit()
      .putString(STEP_QUEST_WIDGET_THEME_KEY, normalizeThemeName(themeName))
      .apply()
  }

  fun writeLocale(context: Context, locale: String) {
    preferences(context)
      .edit()
      .putString(STEP_QUEST_WIDGET_LOCALE_KEY, normalizeLocale(locale))
      .apply()
  }

  fun clearSnapshot(context: Context) {
    preferences(context)
      .edit()
      .remove(STEP_QUEST_WIDGET_SNAPSHOT_KEY)
      .apply()
  }

  fun writeSyncContext(context: Context, contextJson: String) {
    val parsed = StepQuestWidgetSyncContext.fromJson(contextJson)

    preferences(context)
      .edit()
      .putString(STEP_QUEST_WIDGET_API_BASE_URL_KEY, parsed.apiBaseUrl)
      .putString(STEP_QUEST_WIDGET_ACCESS_TOKEN_KEY, parsed.accessToken)
      .putString(STEP_QUEST_WIDGET_REFRESH_TOKEN_KEY, parsed.refreshToken)
      .putString(STEP_QUEST_WIDGET_USER_CONTEXT_KEY, contextJson)
      .putString(STEP_QUEST_WIDGET_THEME_KEY, normalizeThemeName(JSONObject(contextJson).optString("themeName", "candy")))
      .putString(STEP_QUEST_WIDGET_LOCALE_KEY, parsed.preferredLanguage)
      .apply()
  }

  fun readSyncContext(context: Context): StepQuestWidgetSyncContext? {
    val contextJson = preferences(context)
      .getString(STEP_QUEST_WIDGET_USER_CONTEXT_KEY, null)
      ?: return null

    return runCatching { StepQuestWidgetSyncContext.fromJson(contextJson) }.getOrNull()
  }

  fun clearSyncContext(context: Context) {
    preferences(context)
      .edit()
      .remove(STEP_QUEST_WIDGET_API_BASE_URL_KEY)
      .remove(STEP_QUEST_WIDGET_ACCESS_TOKEN_KEY)
      .remove(STEP_QUEST_WIDGET_REFRESH_TOKEN_KEY)
      .remove(STEP_QUEST_WIDGET_USER_CONTEXT_KEY)
      .remove(STEP_QUEST_WIDGET_SERVER_SYNC_STATE_KEY)
      .apply()
  }

  fun readServerSyncState(context: Context): StepQuestWidgetServerSyncState? {
    val stateJson = preferences(context)
      .getString(STEP_QUEST_WIDGET_SERVER_SYNC_STATE_KEY, null)
      ?: return null

    return runCatching { StepQuestWidgetServerSyncState.fromJson(stateJson) }.getOrNull()
  }

  fun writeServerSyncState(context: Context, state: StepQuestWidgetServerSyncState) {
    preferences(context)
      .edit()
      .putString(STEP_QUEST_WIDGET_SERVER_SYNC_STATE_KEY, state.toJson())
      .apply()
  }

  fun notificationDelivered(context: Context, userId: String, recordedFor: String): Boolean {
    return preferences(context).getBoolean(notificationKey(userId, recordedFor), false)
  }

  fun markNotificationDelivered(context: Context, userId: String, recordedFor: String) {
    preferences(context)
      .edit()
      .putBoolean(notificationKey(userId, recordedFor), true)
      .apply()
  }

  private fun notificationKey(userId: String, recordedFor: String): String {
    return "step-goal-notified.${secureKeySegment(userId)}.${secureKeySegment(recordedFor)}"
  }

  fun normalizeThemeName(themeName: String?): String {
    return when (themeName) {
      "ice", "nightosphere" -> themeName
      else -> DEFAULT_WIDGET_THEME_NAME
    }
  }

  fun normalizeLocale(locale: String?): String {
    return when (locale) {
      "fr" -> locale
      else -> DEFAULT_WIDGET_LOCALE
    }
  }

  private fun secureKeySegment(value: String): String {
    return value.replace(Regex("[^0-9A-Za-z._-]"), "_")
  }
}
