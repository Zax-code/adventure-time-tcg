package love.leaetzak.adventuretime

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.widget.RemoteViews
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import kotlin.math.roundToInt

private const val DEFAULT_WIDGET_DEEP_LINK = "adventure-time://quests?focus=steps"
private const val DEFAULT_WIDGET_THEME_NAME = "candy"
private const val ACTION_STEP_QUEST_WIDGET_MIDNIGHT_REFRESH =
  "love.leaetzak.adventuretime.action.STEP_QUEST_WIDGET_MIDNIGHT_REFRESH"
private const val MIDNIGHT_REFRESH_REQUEST_CODE = 10_001
private const val MAX_IMAGE_LEVEL = 10_000

private enum class WidgetLayout(val layoutRes: Int) {
  SMALL(R.layout.step_quest_widget),
  MEDIUM(R.layout.step_quest_widget_medium),
}

/**
 * Theme tokens mirrored from packages/theme/src/index.ts (THEME_COLORS).
 * Keep these values aligned with that file when the app tokens change.
 */
private data class WidgetTokens(
  val fg: Int,
  val fgMuted: Int,
  val bg: Int,
  val surface: Int,
  val surfaceMuted: Int,
  val primary: Int,
  val primaryText: Int,
  val primaryBorder: Int,
  val primaryTint: Int,
  val secondaryText: Int,
  val secondaryTint: Int,
  val secondaryBorder: Int,
  val success: Int,
  val successText: Int,
  val successTint: Int,
  val successBorder: Int,
) {
  companion object {
    val CANDY = WidgetTokens(
      fg = 0xFF4A3728.toInt(),
      fgMuted = 0xFF6B7280.toInt(),
      bg = 0xFFFFF0F5.toInt(),
      surface = 0xF5FFFFFF.toInt(),
      surfaceMuted = 0xE6FFFFFF.toInt(),
      primary = 0xFFF472B6.toInt(),
      primaryText = 0xFFDB2777.toInt(),
      primaryBorder = 0xFFF9A8D4.toInt(),
      primaryTint = 0xFFFCE7F3.toInt(),
      secondaryText = 0xFF894B00.toInt(),
      secondaryTint = 0xFFFEF9C3.toInt(),
      secondaryBorder = 0xFFFEF08A.toInt(),
      success = 0xFF2DD4BF.toInt(),
      successText = 0xFF005F5A.toInt(),
      successTint = 0xFFCCFBF1.toInt(),
      successBorder = 0xFF96F7E4.toInt(),
    )

    val ICE = WidgetTokens(
      fg = 0xFF1F2937.toInt(),
      fgMuted = 0xFF6B7280.toInt(),
      bg = 0xFFF0F7FF.toInt(),
      surface = 0xFAFFFFFF.toInt(),
      surfaceMuted = 0xF2F0F7FF.toInt(),
      primary = 0xFF60A5FA.toInt(),
      primaryText = 0xFF1D4ED8.toInt(),
      primaryBorder = 0xFFBFDBFE.toInt(),
      primaryTint = 0xFFDBEAFE.toInt(),
      secondaryText = 0xFF0E7490.toInt(),
      secondaryTint = 0xFFCFFAFE.toInt(),
      secondaryBorder = 0xFFA5F3FC.toInt(),
      success = 0xFF34D399.toInt(),
      successText = 0xFF065F46.toInt(),
      successTint = 0xFFD1FAE5.toInt(),
      successBorder = 0xFF6EE7B7.toInt(),
    )

    val NIGHTOSPHERE = WidgetTokens(
      fg = 0xFFF0C0C0.toInt(),
      fgMuted = 0xFF9CA3AF.toInt(),
      bg = 0xFF0D0010.toInt(),
      surface = 0xFF1A0B15.toInt(),
      surfaceMuted = 0xFF120813.toInt(),
      primary = 0xFFEF4444.toInt(),
      primaryText = 0xFFFCA5A5.toInt(),
      primaryBorder = 0xFF7F1D1D.toInt(),
      primaryTint = 0xFF2D0F0F.toInt(),
      secondaryText = 0xFFFDBA74.toInt(),
      secondaryTint = 0xFF1C0D05.toInt(),
      secondaryBorder = 0xFF7C2D12.toInt(),
      success = 0xFF34D399.toInt(),
      successText = 0xFF6EE7B7.toInt(),
      successTint = 0xFF022C22.toInt(),
      successBorder = 0xFF064E3B.toInt(),
    )

    fun forTheme(themeName: String): WidgetTokens {
      return when (themeName) {
        "ice" -> ICE
        "nightosphere" -> NIGHTOSPHERE
        else -> CANDY
      }
    }
  }
}

private data class ChipColors(
  val background: Int,
  val border: Int,
  val foreground: Int,
)

/** Visual state derived from the snapshot status (`active`, `completed`, `claimed`, `failed`) or the not-synced fallback. */
private data class WidgetStyle(
  val tokens: WidgetTokens,
  val background: Int,
  val tile: ChipColors,
  val status: ChipColors,
  val reward: ChipColors,
  val barFill: Int,
  val statusIconRes: Int,
) {
  companion object {
    fun create(themeName: String, status: String?): WidgetStyle {
      val t = WidgetTokens.forTheme(themeName)
      val primaryChip = ChipColors(t.primaryTint, t.primaryBorder, t.primaryText)
      val reward = ChipColors(t.secondaryTint, t.secondaryBorder, t.secondaryText)
      val mutedTile = ChipColors(t.surfaceMuted, t.primaryBorder, t.fgMuted)
      val mutedChip = ChipColors(t.surface, t.primaryBorder, t.fgMuted)

      return when (status) {
        "completed" -> WidgetStyle(
          tokens = t,
          background = t.successTint,
          tile = ChipColors(t.surface, t.successBorder, t.successText),
          status = ChipColors(t.successTint, t.successBorder, t.successText),
          reward = reward,
          barFill = t.success,
          statusIconRes = R.drawable.ic_step_quest_widget_gift,
        )

        "claimed" -> WidgetStyle(
          tokens = t,
          background = t.bg,
          tile = mutedTile,
          status = mutedChip,
          reward = reward,
          barFill = t.success,
          statusIconRes = R.drawable.ic_step_quest_widget_check,
        )

        "failed" -> WidgetStyle(
          tokens = t,
          background = t.surfaceMuted,
          tile = mutedTile,
          status = mutedChip,
          reward = reward,
          barFill = t.fgMuted,
          statusIconRes = R.drawable.ic_step_quest_widget_moon,
        )

        else -> WidgetStyle(
          tokens = t,
          background = t.bg,
          tile = primaryChip,
          status = primaryChip,
          reward = reward,
          barFill = t.primary,
          statusIconRes = R.drawable.ic_step_quest_widget_footprints,
        )
      }
    }
  }
}

class StepQuestWidgetProvider : AppWidgetProvider() {
  override fun onReceive(context: Context, intent: Intent) {
    super.onReceive(context, intent)

    when (intent.action) {
      ACTION_STEP_QUEST_WIDGET_MIDNIGHT_REFRESH,
      Intent.ACTION_DATE_CHANGED,
      Intent.ACTION_TIME_CHANGED,
      Intent.ACTION_TIMEZONE_CHANGED,
      Intent.ACTION_BOOT_COMPLETED -> {
        updateAllWidgets(context)
      }
    }
  }

  override fun onUpdate(
    context: Context,
    appWidgetManager: AppWidgetManager,
    appWidgetIds: IntArray,
  ) {
    appWidgetIds.forEach { appWidgetId ->
      updateAppWidget(context, appWidgetManager, appWidgetId)
    }

    scheduleNextMidnightRefresh(context)
    StepQuestWidgetBackgroundSync.schedulePeriodic(context)
    StepQuestWidgetBackgroundSync.enqueueOneTime(context)
  }

  override fun onEnabled(context: Context) {
    super.onEnabled(context)
    scheduleNextMidnightRefresh(context)
    StepQuestWidgetBackgroundSync.schedulePeriodic(context)
    StepQuestWidgetBackgroundSync.enqueueOneTime(context)
  }

  override fun onDisabled(context: Context) {
    super.onDisabled(context)
    cancelNextMidnightRefresh(context)
    StepQuestWidgetBackgroundSync.cancel(context)
  }

  override fun onAppWidgetOptionsChanged(
    context: Context,
    appWidgetManager: AppWidgetManager,
    appWidgetId: Int,
    newOptions: Bundle,
  ) {
    super.onAppWidgetOptionsChanged(context, appWidgetManager, appWidgetId, newOptions)
    updateAppWidget(context, appWidgetManager, appWidgetId)
    scheduleNextMidnightRefresh(context)
  }

  companion object {
    fun updateAllWidgets(context: Context) {
      val appWidgetManager = AppWidgetManager.getInstance(context)
      val componentName = ComponentName(context, StepQuestWidgetProvider::class.java)
      val appWidgetIds = appWidgetManager.getAppWidgetIds(componentName)

      if (appWidgetIds.isEmpty()) {
        cancelNextMidnightRefresh(context)
        return
      }

      appWidgetIds.forEach { appWidgetId ->
        updateAppWidget(context, appWidgetManager, appWidgetId)
      }

      scheduleNextMidnightRefresh(context)
    }

    private fun updateAppWidget(
      context: Context,
      appWidgetManager: AppWidgetManager,
      appWidgetId: Int,
    ) {
      val localeTag = StepQuestWidgetStore.readLocale(context)
      val localizedContext = localizedContext(context, localeTag)
      val layout = resolveLayout(appWidgetManager.getAppWidgetOptions(appWidgetId))
      val snapshot = StepQuestWidgetStore
        .readSnapshot(context)
        ?.let { normalizeSnapshotForToday(localizedContext, localeTag, it) }
      val themeName = normalizeThemeName(snapshot?.themeName ?: StepQuestWidgetStore.readThemeName(context))
      val style = WidgetStyle.create(themeName, snapshot?.status)
      val views = RemoteViews(localizedContext.packageName, layout.layoutRes)

      applyBaseStyling(views, style)

      if (snapshot == null) {
        bindFallback(views, layout)
      } else {
        bindSnapshot(localizedContext, localeTag, views, snapshot, layout, style)
      }

      views.setOnClickPendingIntent(
        R.id.widget_root,
        createPendingIntent(context, snapshot?.deepLink ?: DEFAULT_WIDGET_DEEP_LINK),
      )

      appWidgetManager.updateAppWidget(appWidgetId, views)
    }

    private fun applyBaseStyling(views: RemoteViews, style: WidgetStyle) {
      val t = style.tokens
      tint(views, R.id.widget_background, style.background)
      applyChipColors(views, R.id.widget_tile_bg, R.id.widget_tile_border, style.tile)
      tint(views, R.id.widget_tile_icon, style.tile.foreground)

      applyChipColors(views, R.id.widget_reward_chip_bg, R.id.widget_reward_chip_border, style.reward)
      tint(views, R.id.widget_reward_chip_icon, style.reward.foreground)
      views.setTextColor(R.id.widget_reward_chip_text, style.reward.foreground)

      applyChipColors(views, R.id.widget_status_chip_bg, R.id.widget_status_chip_border, style.status)
      views.setImageViewResource(R.id.widget_status_chip_icon, style.statusIconRes)
      tint(views, R.id.widget_status_chip_icon, style.status.foreground)
      views.setTextColor(R.id.widget_status_chip_text, style.status.foreground)

      tint(views, R.id.widget_bar_bg, t.surface)
      tint(views, R.id.widget_bar_fill, style.barFill)

      views.setTextColor(R.id.widget_steps, t.fg)
      views.setTextColor(R.id.widget_of_target, t.fgMuted)
      views.setTextColor(R.id.widget_fallback_title, t.fg)
      views.setTextColor(R.id.widget_fallback_body, t.fgMuted)
    }

    private fun applyChipColors(views: RemoteViews, backgroundId: Int, borderId: Int, colors: ChipColors) {
      tint(views, backgroundId, colors.background)
      tint(views, borderId, colors.border)
    }

    private fun tint(views: RemoteViews, viewId: Int, color: Int) {
      views.setInt(viewId, "setColorFilter", color)
    }

    private fun setProgress(views: RemoteViews, ratio: Float) {
      val level = (ratio.coerceIn(0f, 1f) * MAX_IMAGE_LEVEL).roundToInt()
      views.setInt(R.id.widget_bar_fill, "setImageLevel", level)
    }

    private fun bindFallback(views: RemoteViews, layout: WidgetLayout) {
      views.setViewVisibility(R.id.widget_reward_chip, View.GONE)
      views.setViewVisibility(R.id.widget_count, View.GONE)
      views.setViewVisibility(R.id.widget_status_chip, View.GONE)
      views.setViewVisibility(R.id.widget_fallback, View.VISIBLE)
      setProgress(views, 0f)

      when (layout) {
        WidgetLayout.SMALL -> views.setViewVisibility(R.id.widget_status_row, View.GONE)
        WidgetLayout.MEDIUM -> {
          views.setViewVisibility(R.id.widget_title, View.INVISIBLE)
          views.setViewVisibility(R.id.widget_footnote, View.GONE)
        }
      }
    }

    private fun bindSnapshot(
      context: Context,
      localeTag: String,
      views: RemoteViews,
      snapshot: StepQuestWidgetSnapshot,
      layout: WidgetLayout,
      style: WidgetStyle,
    ) {
      val target = snapshot.target.coerceAtLeast(1)
      val progress = snapshot.progress.coerceAtLeast(0)
      val ratio = progress.coerceAtMost(target).toFloat() / target.toFloat()

      views.setViewVisibility(R.id.widget_reward_chip, View.VISIBLE)
      views.setViewVisibility(R.id.widget_count, View.VISIBLE)
      views.setViewVisibility(R.id.widget_status_chip, View.VISIBLE)
      views.setViewVisibility(R.id.widget_fallback, View.GONE)

      views.setTextViewText(R.id.widget_reward_chip_text, formatNumber(snapshot.reward, localeTag))
      views.setTextViewText(R.id.widget_steps, formatNumber(progress, localeTag))
      views.setTextViewText(
        R.id.widget_of_target,
        context.getString(R.string.step_quest_widget_of_target, formatNumber(target, localeTag)),
      )
      views.setTextViewText(R.id.widget_status_chip_text, statusLabel(context, snapshot.status, ratio))
      setProgress(views, ratio)

      when (layout) {
        WidgetLayout.SMALL -> views.setViewVisibility(R.id.widget_status_row, View.VISIBLE)
        WidgetLayout.MEDIUM -> {
          views.setViewVisibility(R.id.widget_title, View.VISIBLE)
          views.setTextColor(R.id.widget_title, style.tokens.fg)
          views.setTextViewText(
            R.id.widget_title,
            snapshot.title.trim().ifBlank { context.getString(R.string.step_quest_widget_title_default) },
          )
          views.setViewVisibility(R.id.widget_footnote, View.VISIBLE)
          views.setTextColor(R.id.widget_footnote, style.tokens.fgMuted)
          views.setTextViewText(R.id.widget_footnote, footnote(context, localeTag, snapshot))
        }
      }
    }

    private fun normalizeSnapshotForToday(
      context: Context,
      localeTag: String,
      snapshot: StepQuestWidgetSnapshot,
    ): StepQuestWidgetSnapshot {
      if (snapshot.recordedFor == currentLocalDateString()) {
        return snapshot
      }

      val target = snapshot.target.coerceAtLeast(1)
      val targetLabel = formatNumber(target, localeTag)

      return snapshot.copy(
        progress = 0,
        status = "active",
        recordedFor = currentLocalDateString(),
        progressLabel = "0 / $targetLabel",
        statusLabel = context.getString(R.string.step_quest_widget_status_active, 0),
        subtitle = context.getString(R.string.step_quest_widget_fallback_body),
      )
    }

    private fun currentLocalDateString(): String {
      val formatter = SimpleDateFormat("yyyy-MM-dd", Locale.US)
      return formatter.format(Date())
    }

    private fun nextLocalMidnight(): Long {
      val calendar = Calendar.getInstance().apply {
        add(Calendar.DAY_OF_YEAR, 1)
        set(Calendar.HOUR_OF_DAY, 0)
        set(Calendar.MINUTE, 0)
        set(Calendar.SECOND, 0)
        set(Calendar.MILLISECOND, 0)
      }

      return calendar.timeInMillis
    }

    private fun scheduleNextMidnightRefresh(context: Context) {
      val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
      alarmManager.setAndAllowWhileIdle(
        AlarmManager.RTC_WAKEUP,
        nextLocalMidnight(),
        createMidnightRefreshPendingIntent(context),
      )
    }

    private fun cancelNextMidnightRefresh(context: Context) {
      val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
      alarmManager.cancel(createMidnightRefreshPendingIntent(context))
    }

    private fun resolveLayout(options: Bundle): WidgetLayout {
      val minWidth = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH)
      val maxHeight = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT)

      return if (minWidth >= 180 && minWidth > maxHeight + 24) {
        WidgetLayout.MEDIUM
      } else {
        WidgetLayout.SMALL
      }
    }

    private fun normalizeThemeName(themeName: String?): String {
      val raw = themeName?.trim()?.lowercase(Locale.ROOT).orEmpty()
      return when {
        raw == "candy" || raw == "ice" || raw == "nightosphere" -> raw
        // Map legacy or unknown theme names to the closest current theme.
        raw.contains("night") || raw.contains("dark") || raw.contains("marceline") -> "nightosphere"
        raw.contains("ice") || raw.contains("frost") || raw.contains("snow") || raw.contains("blue") -> "ice"
        else -> DEFAULT_WIDGET_THEME_NAME
      }
    }

    private fun localizedContext(context: Context, localeTag: String): Context {
      val configuration = Configuration(context.resources.configuration)
      configuration.setLocale(Locale.forLanguageTag(localeTag))
      return context.createConfigurationContext(configuration)
    }

    private fun statusLabel(context: Context, status: String, ratio: Float): String {
      return when (status) {
        "completed" -> context.getString(R.string.step_quest_widget_status_completed)
        "claimed" -> context.getString(R.string.step_quest_widget_status_claimed)
        "failed" -> context.getString(R.string.step_quest_widget_status_failed)
        else -> context.getString(R.string.step_quest_widget_status_active, (ratio * 100).roundToInt().coerceIn(0, 100))
      }
    }

    private fun footnote(context: Context, localeTag: String, snapshot: StepQuestWidgetSnapshot): String {
      return when (snapshot.status) {
        "completed" -> context.getString(
          R.string.step_quest_widget_footnote_completed,
          formatNumber(snapshot.reward, localeTag),
        )
        "claimed" -> context.getString(R.string.step_quest_widget_footnote_claimed)
        "failed" -> context.getString(R.string.step_quest_widget_footnote_failed)
        else -> context.getString(
          R.string.step_quest_widget_footnote_active,
          formatNumber((snapshot.target - snapshot.progress).coerceAtLeast(0), localeTag),
        )
      }
    }

    private fun formatNumber(value: Int, localeTag: String?): String {
      val locale = if (localeTag.isNullOrBlank()) Locale.getDefault() else Locale.forLanguageTag(localeTag)
      return NumberFormat.getIntegerInstance(locale).format(value)
    }

    private fun createPendingIntent(context: Context, deepLink: String): PendingIntent {
      val intent = Intent(Intent.ACTION_VIEW, Uri.parse(deepLink)).apply {
        setPackage(context.packageName)
        flags = Intent.FLAG_ACTIVITY_NEW_TASK
      }

      return PendingIntent.getActivity(
        context,
        0,
        intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
    }

    private fun createMidnightRefreshPendingIntent(context: Context): PendingIntent {
      val intent = Intent(context, StepQuestWidgetProvider::class.java).apply {
        action = ACTION_STEP_QUEST_WIDGET_MIDNIGHT_REFRESH
      }

      return PendingIntent.getBroadcast(
        context,
        MIDNIGHT_REFRESH_REQUEST_CODE,
        intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
    }
  }
}
