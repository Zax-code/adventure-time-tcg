package love.leaetzak.adventuretime

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.view.View
import android.widget.RemoteViews

private const val DEFAULT_WIDGET_DEEP_LINK = "adventure-time://widget-quests?focus=steps"

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
      val views = RemoteViews(context.packageName, R.layout.step_quest_widget)
      val snapshot = StepQuestWidgetStore.readSnapshot(context)

      if (snapshot == null) {
        views.setTextViewText(
          R.id.widget_title,
          context.getString(R.string.step_quest_widget_fallback_title),
        )
        views.setTextViewText(
          R.id.widget_status,
          context.getString(R.string.step_quest_widget_fallback_body),
        )
        views.setTextViewText(R.id.widget_subtitle, "")
        views.setTextViewText(R.id.widget_reward, "")
        views.setTextViewText(R.id.widget_progress_label, "")
        views.setViewVisibility(R.id.widget_progress, View.GONE)
      } else {
        views.setTextViewText(R.id.widget_title, snapshot.title)
        views.setTextViewText(R.id.widget_status, snapshot.statusLabel)
        views.setTextViewText(R.id.widget_subtitle, snapshot.subtitle)
        views.setTextViewText(R.id.widget_reward, "\uD83E\uDE99 ${snapshot.reward}")
        views.setTextViewText(R.id.widget_progress_label, snapshot.progressLabel)
        views.setProgressBar(
          R.id.widget_progress,
          snapshot.target.coerceAtLeast(1),
          snapshot.progress.coerceAtMost(snapshot.target.coerceAtLeast(1)),
          false,
        )
        views.setViewVisibility(R.id.widget_progress, View.VISIBLE)
      }

      views.setOnClickPendingIntent(
        R.id.widget_root,
        createPendingIntent(context, snapshot?.deepLink ?: DEFAULT_WIDGET_DEEP_LINK),
      )

      appWidgetManager.updateAppWidget(appWidgetId, views)
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
