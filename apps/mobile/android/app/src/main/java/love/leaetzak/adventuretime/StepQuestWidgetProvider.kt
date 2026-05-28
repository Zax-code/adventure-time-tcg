package love.leaetzak.adventuretime

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.widget.RemoteViews
import java.util.Locale

private const val DEFAULT_WIDGET_DEEP_LINK = "adventure-time://widget-quests?focus=steps"

private enum class WidgetLayout(val layoutRes: Int) {
  SMALL(R.layout.step_quest_widget),
  MEDIUM(R.layout.step_quest_widget_medium),
}

private data class WidgetPalette(
  val statusBackgroundRes: Int,
  val statusTextColor: Int,
  val metricTextColor: Int,
)

class StepQuestWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(
    context: Context,
    appWidgetManager: AppWidgetManager,
    appWidgetIds: IntArray,
  ) {
    appWidgetIds.forEach { appWidgetId ->
      updateAppWidget(context, appWidgetManager, appWidgetId)
    }
  }

  override fun onAppWidgetOptionsChanged(
    context: Context,
    appWidgetManager: AppWidgetManager,
    appWidgetId: Int,
    newOptions: Bundle,
  ) {
    super.onAppWidgetOptionsChanged(context, appWidgetManager, appWidgetId, newOptions)
    updateAppWidget(context, appWidgetManager, appWidgetId)
  }

  companion object {
    fun updateAllWidgets(context: Context) {
      val appWidgetManager = AppWidgetManager.getInstance(context)
      val componentName = ComponentName(context, StepQuestWidgetProvider::class.java)
      val appWidgetIds = appWidgetManager.getAppWidgetIds(componentName)

      appWidgetIds.forEach { appWidgetId ->
        updateAppWidget(context, appWidgetManager, appWidgetId)
      }
    }

    private fun updateAppWidget(
      context: Context,
      appWidgetManager: AppWidgetManager,
      appWidgetId: Int,
    ) {
      val layout = resolveLayout(appWidgetManager.getAppWidgetOptions(appWidgetId))
      val views = RemoteViews(context.packageName, layout.layoutRes)
      val snapshot = StepQuestWidgetStore.readSnapshot(context)
      val palette = paletteForStatus(snapshot?.status)

      views.setTextViewText(R.id.widget_badge, context.getString(R.string.step_quest_widget_badge))
      views.setTextColor(R.id.widget_status_pill, palette.statusTextColor)
      views.setTextColor(R.id.widget_metric_value, palette.metricTextColor)
      views.setInt(
        R.id.widget_status_pill,
        "setBackgroundResource",
        palette.statusBackgroundRes,
      )

      if (snapshot == null) {
        bindFallback(context, views)
      } else {
        bindSnapshot(context, views, snapshot, layout)
      }

      views.setOnClickPendingIntent(
        R.id.widget_root,
        createPendingIntent(context, snapshot?.deepLink ?: DEFAULT_WIDGET_DEEP_LINK),
      )

      appWidgetManager.updateAppWidget(appWidgetId, views)
    }

    private fun bindFallback(
      context: Context,
      views: RemoteViews,
    ) {
      views.setTextViewText(
        R.id.widget_title,
        context.getString(R.string.step_quest_widget_fallback_title),
      )
      views.setTextViewText(
        R.id.widget_subtitle,
        context.getString(R.string.step_quest_widget_fallback_body),
      )
      views.setTextViewText(R.id.widget_reward, "")
      views.setTextViewText(R.id.widget_status_pill, "")
      views.setTextViewText(R.id.widget_metric_value, "--")
      views.setTextViewText(
        R.id.widget_metric_label,
        context.getString(R.string.step_quest_widget_sync_short),
      )
      views.setTextViewText(R.id.widget_progress_label, "")
      views.setViewVisibility(R.id.widget_reward_chip, View.GONE)
      views.setViewVisibility(R.id.widget_status_pill, View.GONE)
      views.setViewVisibility(R.id.widget_progress, View.GONE)
    }

    private fun bindSnapshot(
      context: Context,
      views: RemoteViews,
      snapshot: StepQuestWidgetSnapshot,
      layout: WidgetLayout,
    ) {
      val progress = snapshot.progress.coerceAtMost(snapshot.target.coerceAtLeast(1))
      val percent = ((progress.toDouble() / snapshot.target.coerceAtLeast(1).toDouble()) * 100)
        .toInt()
        .coerceIn(0, 100)

      views.setTextViewText(R.id.widget_title, snapshot.title)
      views.setTextViewText(R.id.widget_subtitle, snapshot.subtitle)
      views.setTextViewText(R.id.widget_reward, formatNumber(snapshot.reward))
      views.setTextViewText(R.id.widget_status_pill, statusHeadline(context, snapshot.status))
      views.setTextViewText(R.id.widget_progress_label, snapshot.progressLabel)
      views.setViewVisibility(R.id.widget_reward_chip, View.VISIBLE)
      views.setViewVisibility(R.id.widget_status_pill, View.VISIBLE)
      views.setViewVisibility(R.id.widget_progress, View.VISIBLE)
      views.setProgressBar(
        R.id.widget_progress,
        snapshot.target.coerceAtLeast(1),
        progress,
        false,
      )

      if (layout == WidgetLayout.SMALL) {
        views.setTextViewText(R.id.widget_metric_value, "$percent%")
        views.setTextViewText(
          R.id.widget_metric_label,
          context.getString(R.string.step_quest_widget_today_short).uppercase(Locale.getDefault()),
        )
      } else {
        views.setTextViewText(R.id.widget_metric_value, "$percent%")
        views.setTextViewText(R.id.widget_metric_label, snapshot.statusLabel)
      }
    }

    private fun resolveLayout(options: Bundle): WidgetLayout {
      val minWidth = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH)
      val maxHeight = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT)

      return if (minWidth >= 170 && minWidth > maxHeight + 28) {
        WidgetLayout.MEDIUM
      } else {
        WidgetLayout.SMALL
      }
    }

    private fun paletteForStatus(status: String?): WidgetPalette {
      return when (status) {
        "completed" -> WidgetPalette(
          statusBackgroundRes = R.drawable.step_quest_widget_status_completed,
          statusTextColor = Color.parseColor("#065F46"),
          metricTextColor = Color.parseColor("#047857"),
        )
        "claimed" -> WidgetPalette(
          statusBackgroundRes = R.drawable.step_quest_widget_status_claimed,
          statusTextColor = Color.parseColor("#6D28D9"),
          metricTextColor = Color.parseColor("#7C3AED"),
        )
        "failed" -> WidgetPalette(
          statusBackgroundRes = R.drawable.step_quest_widget_status_failed,
          statusTextColor = Color.parseColor("#BE123C"),
          metricTextColor = Color.parseColor("#E11D48"),
        )
        else -> WidgetPalette(
          statusBackgroundRes = R.drawable.step_quest_widget_status_active,
          statusTextColor = Color.parseColor("#BE185D"),
          metricTextColor = Color.parseColor("#DB2777"),
        )
      }
    }

    private fun statusHeadline(context: Context, status: String): String {
      return when (status) {
        "completed" -> context.getString(R.string.step_quest_widget_status_completed)
        "claimed" -> context.getString(R.string.step_quest_widget_status_claimed)
        "failed" -> context.getString(R.string.step_quest_widget_status_failed)
        else -> context.getString(R.string.step_quest_widget_status_active)
      }
    }

    private fun formatNumber(value: Int): String {
      return java.text.NumberFormat.getIntegerInstance().format(value)
    }

    private fun createPendingIntent(context: Context, deepLink: String): PendingIntent {
      val intent = Intent(Intent.ACTION_VIEW, Uri.parse(deepLink)).apply {
        setPackage(context.packageName)
        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
      }

      return PendingIntent.getActivity(
        context,
        0,
        intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
    }
  }
}
