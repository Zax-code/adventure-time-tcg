package love.leaetzak.adventuretime

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.SweepGradient
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.widget.RemoteViews
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale
import java.util.Date
import kotlin.math.floor
import kotlin.math.roundToInt

private const val DEFAULT_WIDGET_DEEP_LINK = "adventure-time://widget-quests?focus=steps"
private const val DEFAULT_WIDGET_THEME_NAME = "candy"
private const val REWARD_TEXT_COLOR = 0xFF8A4A00.toInt()
private const val ACTION_STEP_QUEST_WIDGET_MIDNIGHT_REFRESH =
  "love.leaetzak.adventuretime.action.STEP_QUEST_WIDGET_MIDNIGHT_REFRESH"
private const val MIDNIGHT_REFRESH_REQUEST_CODE = 10_001

private enum class WidgetLayout(
  val layoutRes: Int,
  val ringSizeDp: Float,
) {
  SMALL(R.layout.step_quest_widget, 98f),
  MEDIUM(R.layout.step_quest_widget_medium, 112f),
}

private data class WidgetPalette(
  val backgroundSmallRes: Int,
  val backgroundMediumRes: Int,
  val statusBackgroundRes: Int,
  val ringFillColor: Int,
  val statusTextColor: Int,
  val titleColor: Int,
  val bodyColor: Int,
  val mutedColor: Int,
  val progressColor: Int,
  val progressTrackColor: Int,
  val glowSecondaryColor: Int,
) {
  fun backgroundRes(layout: WidgetLayout): Int {
    return when (layout) {
      WidgetLayout.SMALL -> backgroundSmallRes
      WidgetLayout.MEDIUM -> backgroundMediumRes
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
  }

  override fun onEnabled(context: Context) {
    super.onEnabled(context)
    scheduleNextMidnightRefresh(context)
  }

  override fun onDisabled(context: Context) {
    super.onDisabled(context)
    cancelNextMidnightRefresh(context)
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
      val palette = paletteForThemeAndStatus(themeName, snapshot?.status)
      val views = RemoteViews(localizedContext.packageName, layout.layoutRes)

      applyBaseStyling(localizedContext, views, layout, palette)

      if (snapshot == null) {
        bindFallback(localizedContext, localeTag, views, layout, palette)
      } else {
        bindSnapshot(localizedContext, localeTag, views, snapshot, layout, palette)
      }

      views.setOnClickPendingIntent(
        R.id.widget_root,
        createPendingIntent(context, snapshot?.deepLink ?: DEFAULT_WIDGET_DEEP_LINK),
      )

      appWidgetManager.updateAppWidget(appWidgetId, views)
    }

    private fun applyBaseStyling(
      context: Context,
      views: RemoteViews,
      layout: WidgetLayout,
      palette: WidgetPalette,
    ) {
      views.setInt(R.id.widget_root, "setBackgroundResource", palette.backgroundRes(layout))
      views.setTextViewText(R.id.widget_badge, badgeText(context, layout))
      views.setTextColor(R.id.widget_badge, palette.titleColor)
      views.setTextColor(R.id.widget_title, palette.titleColor)
      views.setTextColor(R.id.widget_status_pill, palette.statusTextColor)
      views.setTextColor(R.id.widget_reward, REWARD_TEXT_COLOR)
      views.setTextColor(R.id.widget_detail_label, palette.titleColor)
      views.setTextColor(R.id.widget_detail_body, palette.mutedColor)
      views.setTextColor(R.id.widget_fallback_body, palette.bodyColor)
      views.setInt(
        R.id.widget_status_pill,
        "setBackgroundResource",
        palette.statusBackgroundRes,
      )
    }

    private fun bindFallback(
      context: Context,
      localeTag: String,
      views: RemoteViews,
      layout: WidgetLayout,
      palette: WidgetPalette,
    ) {
      views.setTextViewText(R.id.widget_title, context.getString(R.string.step_quest_widget_fallback_title))
      views.setTextViewText(
        R.id.widget_fallback_body,
        context.getString(R.string.step_quest_widget_fallback_body),
      )
      views.setViewVisibility(R.id.widget_reward_chip, View.GONE)
      views.setViewVisibility(R.id.widget_status_pill, View.GONE)
      views.setViewVisibility(R.id.widget_fallback_body, View.VISIBLE)
      views.setViewVisibility(R.id.widget_detail_label, View.GONE)
      views.setViewVisibility(R.id.widget_detail_body, View.GONE)
      views.setImageViewBitmap(
        R.id.widget_ring,
        buildRingBitmap(
          context = context,
          localeTag = localeTag,
          sizeDp = layout.ringSizeDp,
          progress = 0.24f,
          palette = palette,
          primaryLabel = "--",
          secondaryLabel = if (layout == WidgetLayout.SMALL) {
            context.getString(R.string.step_quest_widget_sync_short)
          } else {
            null
          },
        ),
      )
    }

    private fun bindSnapshot(
      context: Context,
      localeTag: String,
      views: RemoteViews,
      snapshot: StepQuestWidgetSnapshot,
      layout: WidgetLayout,
      palette: WidgetPalette,
    ) {
      val progress = snapshot.progress.coerceAtLeast(0)
      val progressRatio = progress.coerceAtMost(snapshot.target.coerceAtLeast(1)).toFloat() /
        snapshot.target.coerceAtLeast(1).toFloat()

      views.setTextViewText(R.id.widget_title, titleText(context, layout))
      views.setTextViewText(R.id.widget_reward, formatNumber(snapshot.reward, localeTag))
      views.setTextViewText(R.id.widget_status_pill, statusHeadline(context, snapshot.status))
      views.setViewVisibility(R.id.widget_reward_chip, View.VISIBLE)
      views.setViewVisibility(R.id.widget_status_pill, View.VISIBLE)
      views.setViewVisibility(R.id.widget_fallback_body, View.GONE)

      val secondaryRingLabel = compactRingProgressLabel(snapshot, localeTag)

      views.setImageViewBitmap(
        R.id.widget_ring,
        buildRingBitmap(
          context = context,
          localeTag = localeTag,
          sizeDp = layout.ringSizeDp,
          progress = progressRatio,
          palette = palette,
          primaryLabel = percentText(snapshot),
          secondaryLabel = if (layout == WidgetLayout.SMALL) secondaryRingLabel else null,
        ),
      )

      when (layout) {
        WidgetLayout.SMALL -> {
          views.setViewVisibility(R.id.widget_detail_label, View.GONE)
          views.setViewVisibility(R.id.widget_detail_body, View.GONE)
        }

        WidgetLayout.MEDIUM -> {
          views.setViewVisibility(R.id.widget_detail_label, View.VISIBLE)
          views.setViewVisibility(R.id.widget_detail_body, View.VISIBLE)
          views.setTextViewText(
            R.id.widget_detail_label,
            snapshot.progressLabel.ifBlank { fullProgressLabel(snapshot, localeTag) },
          )
          views.setTextViewText(R.id.widget_detail_body, progressFootnote(context, snapshot.status))
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
        statusLabel = context.getString(R.string.step_quest_widget_status_active),
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

    private fun paletteForThemeAndStatus(themeName: String, status: String?): WidgetPalette {
      return when (themeName) {
        "ice" -> icePaletteForStatus(status)
        "nightosphere" -> nightospherePaletteForStatus(status)
        else -> candyPaletteForStatus(status)
      }
    }

    private fun candyPaletteForStatus(status: String?): WidgetPalette {
      return when (status) {
        "completed" -> WidgetPalette(
          backgroundSmallRes = R.drawable.step_quest_widget_background_small_completed,
          backgroundMediumRes = R.drawable.step_quest_widget_background_medium_completed,
          statusBackgroundRes = R.drawable.step_quest_widget_status_completed,
          ringFillColor = 0x8CFFFFFF.toInt(),
          statusTextColor = Color.parseColor("#025F48"),
          titleColor = Color.parseColor("#353D33"),
          bodyColor = Color.parseColor("#476359"),
          mutedColor = Color.parseColor("#6B7F77"),
          progressColor = Color.parseColor("#14B892"),
          progressTrackColor = Color.parseColor("#C7F4E3"),
          glowSecondaryColor = Color.parseColor("#F9DB59"),
        )

        "claimed" -> WidgetPalette(
          backgroundSmallRes = R.drawable.step_quest_widget_background_small_claimed,
          backgroundMediumRes = R.drawable.step_quest_widget_background_medium_claimed,
          statusBackgroundRes = R.drawable.step_quest_widget_status_claimed,
          ringFillColor = 0x8CFFFFFF.toInt(),
          statusTextColor = Color.parseColor("#6B389E"),
          titleColor = Color.parseColor("#47334F"),
          bodyColor = Color.parseColor("#6E5B7A"),
          mutedColor = Color.parseColor("#8C7A99"),
          progressColor = Color.parseColor("#8A72BE"),
          progressTrackColor = Color.parseColor("#E8DDF6"),
          glowSecondaryColor = Color.parseColor("#F572B5"),
        )

        "failed" -> WidgetPalette(
          backgroundSmallRes = R.drawable.step_quest_widget_background_small_failed,
          backgroundMediumRes = R.drawable.step_quest_widget_background_medium_failed,
          statusBackgroundRes = R.drawable.step_quest_widget_status_failed,
          ringFillColor = 0x8CFFFFFF.toInt(),
          statusTextColor = Color.parseColor("#AD1D2E"),
          titleColor = Color.parseColor("#592B2D"),
          bodyColor = Color.parseColor("#754740"),
          mutedColor = Color.parseColor("#9E6B60"),
          progressColor = Color.parseColor("#E75A48"),
          progressTrackColor = Color.parseColor("#FFDCDD"),
          glowSecondaryColor = Color.parseColor("#FA9933"),
        )

        else -> WidgetPalette(
          backgroundSmallRes = R.drawable.step_quest_widget_background_small,
          backgroundMediumRes = R.drawable.step_quest_widget_background_medium,
          statusBackgroundRes = R.drawable.step_quest_widget_status_active,
          ringFillColor = 0x8CFFFFFF.toInt(),
          statusTextColor = Color.parseColor("#BF1569"),
          titleColor = Color.parseColor("#4A3728"),
          bodyColor = Color.parseColor("#614E3C"),
          mutedColor = Color.parseColor("#786452"),
          progressColor = Color.parseColor("#EC4A99"),
          progressTrackColor = Color.parseColor("#F8D4E5"),
          glowSecondaryColor = Color.parseColor("#FDD229"),
        )
      }
    }

    private fun icePaletteForStatus(status: String?): WidgetPalette {
      return when (status) {
        "completed" -> WidgetPalette(
          backgroundSmallRes = R.drawable.step_quest_widget_background_small_ice_completed,
          backgroundMediumRes = R.drawable.step_quest_widget_background_medium_ice_completed,
          statusBackgroundRes = R.drawable.step_quest_widget_status_ice_completed,
          ringFillColor = 0x8CFFFFFF.toInt(),
          statusTextColor = Color.parseColor("#0F766E"),
          titleColor = Color.parseColor("#164E63"),
          bodyColor = Color.parseColor("#155E75"),
          mutedColor = Color.parseColor("#4B6B7C"),
          progressColor = Color.parseColor("#14B8A6"),
          progressTrackColor = Color.parseColor("#CCFBF1"),
          glowSecondaryColor = Color.parseColor("#7DD3FC"),
        )

        "claimed" -> WidgetPalette(
          backgroundSmallRes = R.drawable.step_quest_widget_background_small_ice_claimed,
          backgroundMediumRes = R.drawable.step_quest_widget_background_medium_ice_claimed,
          statusBackgroundRes = R.drawable.step_quest_widget_status_ice_claimed,
          ringFillColor = 0x8CFFFFFF.toInt(),
          statusTextColor = Color.parseColor("#4338CA"),
          titleColor = Color.parseColor("#1E3A8A"),
          bodyColor = Color.parseColor("#334155"),
          mutedColor = Color.parseColor("#64748B"),
          progressColor = Color.parseColor("#818CF8"),
          progressTrackColor = Color.parseColor("#E0E7FF"),
          glowSecondaryColor = Color.parseColor("#67E8F9"),
        )

        "failed" -> WidgetPalette(
          backgroundSmallRes = R.drawable.step_quest_widget_background_small_ice_failed,
          backgroundMediumRes = R.drawable.step_quest_widget_background_medium_ice_failed,
          statusBackgroundRes = R.drawable.step_quest_widget_status_ice_failed,
          ringFillColor = 0x8CFFFFFF.toInt(),
          statusTextColor = Color.parseColor("#B91C1C"),
          titleColor = Color.parseColor("#7C2D12"),
          bodyColor = Color.parseColor("#9A3412"),
          mutedColor = Color.parseColor("#A16207"),
          progressColor = Color.parseColor("#F97316"),
          progressTrackColor = Color.parseColor("#FFEDD5"),
          glowSecondaryColor = Color.parseColor("#F87171"),
        )

        else -> WidgetPalette(
          backgroundSmallRes = R.drawable.step_quest_widget_background_small_ice,
          backgroundMediumRes = R.drawable.step_quest_widget_background_medium_ice,
          statusBackgroundRes = R.drawable.step_quest_widget_status_ice_active,
          ringFillColor = 0x8CFFFFFF.toInt(),
          statusTextColor = Color.parseColor("#1D4ED8"),
          titleColor = Color.parseColor("#1E3A8A"),
          bodyColor = Color.parseColor("#1D4ED8"),
          mutedColor = Color.parseColor("#64748B"),
          progressColor = Color.parseColor("#38BDF8"),
          progressTrackColor = Color.parseColor("#DBEAFE"),
          glowSecondaryColor = Color.parseColor("#67E8F9"),
        )
      }
    }

    private fun nightospherePaletteForStatus(status: String?): WidgetPalette {
      return when (status) {
        "completed" -> WidgetPalette(
          backgroundSmallRes = R.drawable.step_quest_widget_background_small_nightosphere_completed,
          backgroundMediumRes = R.drawable.step_quest_widget_background_medium_nightosphere_completed,
          statusBackgroundRes = R.drawable.step_quest_widget_status_nightosphere_completed,
          ringFillColor = 0xC7FFFFFF.toInt(),
          statusTextColor = Color.parseColor("#FDE68A"),
          titleColor = Color.parseColor("#FECACA"),
          bodyColor = Color.parseColor("#FCA5A5"),
          mutedColor = Color.parseColor("#FDBA74"),
          progressColor = Color.parseColor("#F97316"),
          progressTrackColor = Color.parseColor("#4A1D12"),
          glowSecondaryColor = Color.parseColor("#C084FC"),
        )

        "claimed" -> WidgetPalette(
          backgroundSmallRes = R.drawable.step_quest_widget_background_small_nightosphere_claimed,
          backgroundMediumRes = R.drawable.step_quest_widget_background_medium_nightosphere_claimed,
          statusBackgroundRes = R.drawable.step_quest_widget_status_nightosphere_claimed,
          ringFillColor = 0xC7FFFFFF.toInt(),
          statusTextColor = Color.parseColor("#E9D5FF"),
          titleColor = Color.parseColor("#F5D0FE"),
          bodyColor = Color.parseColor("#E9D5FF"),
          mutedColor = Color.parseColor("#C4B5FD"),
          progressColor = Color.parseColor("#C084FC"),
          progressTrackColor = Color.parseColor("#3B124F"),
          glowSecondaryColor = Color.parseColor("#FB7185"),
        )

        "failed" -> WidgetPalette(
          backgroundSmallRes = R.drawable.step_quest_widget_background_small_nightosphere_failed,
          backgroundMediumRes = R.drawable.step_quest_widget_background_medium_nightosphere_failed,
          statusBackgroundRes = R.drawable.step_quest_widget_status_nightosphere_failed,
          ringFillColor = 0xC7FFFFFF.toInt(),
          statusTextColor = Color.parseColor("#FCA5A5"),
          titleColor = Color.parseColor("#FECACA"),
          bodyColor = Color.parseColor("#FCA5A5"),
          mutedColor = Color.parseColor("#FDBA74"),
          progressColor = Color.parseColor("#EF4444"),
          progressTrackColor = Color.parseColor("#3F0B12"),
          glowSecondaryColor = Color.parseColor("#F97316"),
        )

        else -> WidgetPalette(
          backgroundSmallRes = R.drawable.step_quest_widget_background_small_nightosphere,
          backgroundMediumRes = R.drawable.step_quest_widget_background_medium_nightosphere,
          statusBackgroundRes = R.drawable.step_quest_widget_status_nightosphere_active,
          ringFillColor = 0xC7FFFFFF.toInt(),
          statusTextColor = Color.parseColor("#F9A8D4"),
          titleColor = Color.parseColor("#F5D0FE"),
          bodyColor = Color.parseColor("#FBCFE8"),
          mutedColor = Color.parseColor("#C4B5FD"),
          progressColor = Color.parseColor("#FB7185"),
          progressTrackColor = Color.parseColor("#341124"),
          glowSecondaryColor = Color.parseColor("#C084FC"),
        )
      }
    }

    private fun normalizeThemeName(themeName: String?): String {
      return when (themeName) {
        "ice", "nightosphere" -> themeName
        else -> DEFAULT_WIDGET_THEME_NAME
      }
    }

    private fun localizedContext(context: Context, localeTag: String): Context {
      val configuration = Configuration(context.resources.configuration)
      configuration.setLocale(Locale.forLanguageTag(localeTag))
      return context.createConfigurationContext(configuration)
    }

    private fun badgeText(context: Context, layout: WidgetLayout): String {
      return when (layout) {
        WidgetLayout.SMALL -> context.getString(R.string.step_quest_widget_badge_small)
        WidgetLayout.MEDIUM -> context.getString(R.string.step_quest_widget_badge_medium)
      }
    }

    private fun titleText(context: Context, layout: WidgetLayout): String {
      return when (layout) {
        WidgetLayout.SMALL -> context.getString(R.string.step_quest_widget_small_title)
        WidgetLayout.MEDIUM -> context.getString(R.string.step_quest_widget_medium_title)
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

    private fun progressFootnote(context: Context, status: String): String {
      return when (status) {
        "completed" -> context.getString(R.string.step_quest_widget_footnote_completed)
        "claimed" -> context.getString(R.string.step_quest_widget_footnote_claimed)
        "failed" -> context.getString(R.string.step_quest_widget_footnote_failed)
        else -> context.getString(R.string.step_quest_widget_footnote_active)
      }
    }

    private fun percentText(snapshot: StepQuestWidgetSnapshot): String {
      val target = snapshot.target.coerceAtLeast(1)
      val percent = ((snapshot.progress.toDouble() / target.toDouble()) * 100).roundToInt()
      return "${percent.coerceIn(0, 100)}%"
    }

    private fun fullProgressLabel(snapshot: StepQuestWidgetSnapshot, localeTag: String): String {
      return "${formatNumber(snapshot.progress, localeTag)} / ${formatNumber(snapshot.target, localeTag)}"
    }

    private fun compactRingProgressLabel(snapshot: StepQuestWidgetSnapshot, localeTag: String): String {
      return "${abbreviatedStepCount(snapshot.progress, localeTag)} / ${abbreviatedStepCount(snapshot.target, localeTag)}"
    }

    private fun abbreviatedStepCount(value: Int, localeTag: String): String {
      if (value >= 10_000) {
        val rounded = value / 1_000.0
        return if (value % 1_000 == 0) {
          "${rounded.toInt()}K"
        } else {
          "${trimmedSingleDecimal(rounded)}K"
        }
      }

      if (value >= 1_000) {
        return "${trimmedSingleDecimal(value / 1_000.0)}K"
      }

      return formatNumber(value, localeTag)
    }

    private fun trimmedSingleDecimal(value: Double): String {
      val rounded = (value * 10).roundToInt() / 10.0
      return if (rounded == floor(rounded)) {
        rounded.toInt().toString()
      } else {
        String.format(Locale.US, "%.1f", rounded)
      }
    }

    private fun formatNumber(value: Int, localeTag: String?): String {
      val locale = if (localeTag.isNullOrBlank()) Locale.getDefault() else Locale.forLanguageTag(localeTag)
      return NumberFormat.getIntegerInstance(locale).format(value)
    }

    private fun buildRingBitmap(
      context: Context,
      localeTag: String,
      sizeDp: Float,
      progress: Float,
      palette: WidgetPalette,
      primaryLabel: String,
      secondaryLabel: String?,
    ): Bitmap {
      val density = context.resources.displayMetrics.density
      val sizePx = (sizeDp * density).roundToInt()
      val ringStrokeWidth = 8f * density
      val bitmap = Bitmap.createBitmap(sizePx, sizePx, Bitmap.Config.ARGB_8888)
      val canvas = Canvas(bitmap)
      val center = sizePx / 2f
      val radius = center - ringStrokeWidth / 2f - density

      val fillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = palette.ringFillColor
        style = Paint.Style.FILL
      }

      val trackPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = palette.progressTrackColor
        style = Paint.Style.STROKE
        strokeWidth = ringStrokeWidth
        strokeCap = Paint.Cap.ROUND
      }

      val sweepGradient = SweepGradient(
        center,
        center,
        intArrayOf(palette.progressColor, palette.glowSecondaryColor, palette.progressColor),
        floatArrayOf(0f, 0.65f, 1f),
      ).apply {
        val matrix = Matrix()
        matrix.preRotate(-90f, center, center)
        setLocalMatrix(matrix)
      }

      val progressPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        shader = sweepGradient
        style = Paint.Style.STROKE
        strokeWidth = ringStrokeWidth
        strokeCap = Paint.Cap.ROUND
      }

      canvas.drawCircle(center, center, center - density, fillPaint)
      canvas.drawCircle(center, center, radius, trackPaint)

      val arcBounds = RectF(center - radius, center - radius, center + radius, center + radius)
      canvas.drawArc(arcBounds, -90f, progress.coerceIn(0f, 1f) * 360f, false, progressPaint)

      val primaryPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = palette.titleColor
        textAlign = Paint.Align.CENTER
        textSize = sp(context, 16f)
        typeface = android.graphics.Typeface.create("sans-serif-black", android.graphics.Typeface.NORMAL)
      }

      val secondaryPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = palette.mutedColor
        textAlign = Paint.Align.CENTER
        textSize = sp(context, 7f)
        typeface = android.graphics.Typeface.create("sans-serif-medium", android.graphics.Typeface.NORMAL)
      }

      drawCenteredTextBlock(
        canvas = canvas,
        centerX = center,
        centerY = center,
        primaryText = primaryLabel,
        secondaryText = secondaryLabel?.uppercase(Locale.forLanguageTag(localeTag)),
        primaryPaint = primaryPaint,
        secondaryPaint = secondaryPaint,
        spacing = density,
      )

      return bitmap
    }

    private fun drawCenteredTextBlock(
      canvas: Canvas,
      centerX: Float,
      centerY: Float,
      primaryText: String,
      secondaryText: String?,
      primaryPaint: Paint,
      secondaryPaint: Paint,
      spacing: Float,
    ) {
      val primaryMetrics = primaryPaint.fontMetrics
      val primaryHeight = primaryMetrics.bottom - primaryMetrics.top
      if (secondaryText.isNullOrBlank()) {
        val primaryBaseline = centerY - (primaryMetrics.top + primaryMetrics.bottom) / 2f
        canvas.drawText(primaryText, centerX, primaryBaseline, primaryPaint)
        return
      }

      val secondaryMetrics = secondaryPaint.fontMetrics
      val secondaryHeight = secondaryMetrics.bottom - secondaryMetrics.top
      val totalHeight = primaryHeight + spacing + secondaryHeight

      val primaryBaseline = centerY - totalHeight / 2f - primaryMetrics.top
      val secondaryBaseline = primaryBaseline + primaryMetrics.bottom + spacing - secondaryMetrics.top

      canvas.drawText(primaryText, centerX, primaryBaseline, primaryPaint)
      canvas.drawText(secondaryText, centerX, secondaryBaseline, secondaryPaint)
    }

    private fun sp(context: Context, value: Float): Float {
      return value * context.resources.displayMetrics.scaledDensity
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
