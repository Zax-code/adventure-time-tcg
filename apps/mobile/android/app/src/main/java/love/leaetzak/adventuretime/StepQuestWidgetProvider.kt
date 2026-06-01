package love.leaetzak.adventuretime

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
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
import java.util.Locale
import java.util.Date
import kotlin.math.floor
import kotlin.math.roundToInt

private const val DEFAULT_WIDGET_DEEP_LINK = "adventure-time://widget-quests?focus=steps"
private const val REWARD_TEXT_COLOR = 0xFF8A4A00.toInt()
private const val RING_FILL_COLOR = 0x8CFFFFFF.toInt()

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
      val snapshot = StepQuestWidgetStore
        .readSnapshot(context)
        ?.let { normalizeSnapshotForToday(context, it) }
      val palette = paletteForStatus(snapshot?.status)
      val views = RemoteViews(context.packageName, layout.layoutRes)

      applyBaseStyling(context, views, layout, palette)

      if (snapshot == null) {
        bindFallback(context, views, layout, palette)
      } else {
        bindSnapshot(context, views, snapshot, layout, palette)
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
          sizeDp = layout.ringSizeDp,
          progress = 0.24f,
          palette = palette,
          primaryLabel = "--",
          secondaryLabel = context.getString(R.string.step_quest_widget_sync_short),
        ),
      )
    }

    private fun bindSnapshot(
      context: Context,
      views: RemoteViews,
      snapshot: StepQuestWidgetSnapshot,
      layout: WidgetLayout,
      palette: WidgetPalette,
    ) {
      val progress = snapshot.progress.coerceAtLeast(0)
      val progressRatio = progress.coerceAtMost(snapshot.target.coerceAtLeast(1)).toFloat() /
        snapshot.target.coerceAtLeast(1).toFloat()

      views.setTextViewText(R.id.widget_title, titleText(context, layout))
      views.setTextViewText(R.id.widget_reward, formatNumber(snapshot.reward))
      views.setTextViewText(R.id.widget_status_pill, statusHeadline(context, snapshot.status))
      views.setViewVisibility(R.id.widget_reward_chip, View.VISIBLE)
      views.setViewVisibility(R.id.widget_status_pill, View.VISIBLE)
      views.setViewVisibility(R.id.widget_fallback_body, View.GONE)

      val secondaryRingLabel = compactRingProgressLabel(snapshot)

      views.setImageViewBitmap(
        R.id.widget_ring,
        buildRingBitmap(
          context = context,
          sizeDp = layout.ringSizeDp,
          progress = progressRatio,
          palette = palette,
          primaryLabel = percentText(snapshot),
          secondaryLabel = secondaryRingLabel,
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
            snapshot.progressLabel.ifBlank { fullProgressLabel(snapshot) },
          )
          views.setTextViewText(R.id.widget_detail_body, progressFootnote(context, snapshot.status))
        }
      }
    }

    private fun normalizeSnapshotForToday(
      context: Context,
      snapshot: StepQuestWidgetSnapshot,
    ): StepQuestWidgetSnapshot {
      val recordedFor = snapshot.recordedFor
      if (recordedFor == null || recordedFor == currentLocalDateString()) {
        return snapshot
      }

      val target = snapshot.target.coerceAtLeast(1)
      val targetLabel = formatNumber(target)

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

    private fun resolveLayout(options: Bundle): WidgetLayout {
      val minWidth = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH)
      val maxHeight = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT)

      return if (minWidth >= 180 && minWidth > maxHeight + 24) {
        WidgetLayout.MEDIUM
      } else {
        WidgetLayout.SMALL
      }
    }

    private fun paletteForStatus(status: String?): WidgetPalette {
      return when (status) {
        "completed" -> WidgetPalette(
          backgroundSmallRes = R.drawable.step_quest_widget_background_small_completed,
          backgroundMediumRes = R.drawable.step_quest_widget_background_medium_completed,
          statusBackgroundRes = R.drawable.step_quest_widget_status_completed,
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

    private fun fullProgressLabel(snapshot: StepQuestWidgetSnapshot): String {
      return "${formatNumber(snapshot.progress)} / ${formatNumber(snapshot.target)}"
    }

    private fun compactRingProgressLabel(snapshot: StepQuestWidgetSnapshot): String {
      return "${abbreviatedStepCount(snapshot.progress)} / ${abbreviatedStepCount(snapshot.target)}"
    }

    private fun abbreviatedStepCount(value: Int): String {
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

      return formatNumber(value)
    }

    private fun trimmedSingleDecimal(value: Double): String {
      val rounded = (value * 10).roundToInt() / 10.0
      return if (rounded == floor(rounded)) {
        rounded.toInt().toString()
      } else {
        String.format(Locale.US, "%.1f", rounded)
      }
    }

    private fun formatNumber(value: Int): String {
      return NumberFormat.getIntegerInstance().format(value)
    }

    private fun buildRingBitmap(
      context: Context,
      sizeDp: Float,
      progress: Float,
      palette: WidgetPalette,
      primaryLabel: String,
      secondaryLabel: String,
    ): Bitmap {
      val density = context.resources.displayMetrics.density
      val sizePx = (sizeDp * density).roundToInt()
      val ringStrokeWidth = 8f * density
      val bitmap = Bitmap.createBitmap(sizePx, sizePx, Bitmap.Config.ARGB_8888)
      val canvas = Canvas(bitmap)
      val center = sizePx / 2f
      val radius = center - ringStrokeWidth / 2f - density

      val fillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = RING_FILL_COLOR
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
        secondaryText = secondaryLabel.uppercase(Locale.getDefault()),
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
      secondaryText: String,
      primaryPaint: Paint,
      secondaryPaint: Paint,
      spacing: Float,
    ) {
      val primaryMetrics = primaryPaint.fontMetrics
      val secondaryMetrics = secondaryPaint.fontMetrics
      val primaryHeight = primaryMetrics.bottom - primaryMetrics.top
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
  }
}
