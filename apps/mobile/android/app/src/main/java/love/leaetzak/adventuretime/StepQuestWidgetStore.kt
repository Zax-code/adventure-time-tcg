package love.leaetzak.adventuretime

import android.content.Context
import org.json.JSONObject

private const val STEP_QUEST_WIDGET_PREFS = "step_quest_widget"
private const val STEP_QUEST_WIDGET_SNAPSHOT_KEY = "stepQuestWidgetSnapshot"
private const val STEP_QUEST_WIDGET_THEME_KEY = "stepQuestWidgetThemeName"
private const val DEFAULT_WIDGET_DEEP_LINK = "adventure-time://widget-quests?focus=steps"
private const val DEFAULT_WIDGET_THEME_NAME = "candy"

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

object StepQuestWidgetStore {
  fun readThemeName(context: Context): String {
    val storedThemeName = context
      .getSharedPreferences(STEP_QUEST_WIDGET_PREFS, Context.MODE_PRIVATE)
      .getString(STEP_QUEST_WIDGET_THEME_KEY, null)

    return normalizeThemeName(storedThemeName)
  }

  fun readSnapshot(context: Context): StepQuestWidgetSnapshot? {
    val snapshotJson = context
      .getSharedPreferences(STEP_QUEST_WIDGET_PREFS, Context.MODE_PRIVATE)
      .getString(STEP_QUEST_WIDGET_SNAPSHOT_KEY, null)
      ?: return null

    return runCatching { StepQuestWidgetSnapshot.fromJson(snapshotJson) }.getOrNull()
  }

  fun writeSnapshot(context: Context, snapshotJson: String) {
    context
      .getSharedPreferences(STEP_QUEST_WIDGET_PREFS, Context.MODE_PRIVATE)
      .edit()
      .putString(STEP_QUEST_WIDGET_SNAPSHOT_KEY, snapshotJson)
      .apply()
  }

  fun writeThemeName(context: Context, themeName: String) {
    context
      .getSharedPreferences(STEP_QUEST_WIDGET_PREFS, Context.MODE_PRIVATE)
      .edit()
      .putString(STEP_QUEST_WIDGET_THEME_KEY, normalizeThemeName(themeName))
      .apply()
  }

  fun clearSnapshot(context: Context) {
    context
      .getSharedPreferences(STEP_QUEST_WIDGET_PREFS, Context.MODE_PRIVATE)
      .edit()
      .remove(STEP_QUEST_WIDGET_SNAPSHOT_KEY)
      .apply()
  }

  private fun normalizeThemeName(themeName: String?): String {
    return when (themeName) {
      "ice", "nightosphere" -> themeName
      else -> DEFAULT_WIDGET_THEME_NAME
    }
  }
}
