package love.leaetzak.adventuretime

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.time.TimeRangeFilter
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import java.net.HttpURLConnection
import java.net.URL
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.util.Locale
import java.util.UUID
import java.util.concurrent.TimeUnit
import kotlin.math.max
import org.json.JSONArray
import org.json.JSONObject

private const val STEP_GOAL = 10_000
private const val DEFAULT_REWARD = 150
private const val SERVER_SYNC_THROTTLE_MS = 15 * 60 * 1000L
private const val WORK_NAME = "step-quest-widget-health-connect-sync"
private const val ONE_TIME_WORK_NAME = "step-quest-widget-health-connect-sync-now"
private const val STEP_NOTIFICATION_CHANNEL_ID = "step-goals"

object StepQuestWidgetBackgroundSync {
  fun enqueueOneTime(context: Context) {
    WorkManager.getInstance(context).enqueueUniqueWork(
      ONE_TIME_WORK_NAME,
      ExistingWorkPolicy.REPLACE,
      OneTimeWorkRequestBuilder<StepQuestWidgetBackgroundSyncWorker>().build(),
    )
  }

  fun schedulePeriodic(context: Context) {
    WorkManager.getInstance(context).enqueueUniquePeriodicWork(
      WORK_NAME,
      ExistingPeriodicWorkPolicy.UPDATE,
      PeriodicWorkRequestBuilder<StepQuestWidgetBackgroundSyncWorker>(
        15,
        TimeUnit.MINUTES,
      ).build(),
    )
  }

  fun cancel(context: Context) {
    WorkManager.getInstance(context).cancelUniqueWork(ONE_TIME_WORK_NAME)
    WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
  }
}

class StepQuestWidgetBackgroundSyncWorker(
  appContext: Context,
  workerParams: WorkerParameters,
) : CoroutineWorker(appContext, workerParams) {
  override suspend fun doWork(): Result {
    val syncContext = StepQuestWidgetStore.readSyncContext(applicationContext)
      ?: return Result.success()

    if (syncContext.preferredStepSource != "device_health") {
      return Result.success()
    }

    val stepCount = readTodaySteps() ?: return Result.success()
    val recordedFor = currentLocalDate()
    val existingSnapshot = StepQuestWidgetStore.readSnapshot(applicationContext)
    val localSnapshot = buildLocalSnapshot(
      context = syncContext,
      existingSnapshot = existingSnapshot,
      recordedFor = recordedFor,
      stepCount = stepCount,
    )

    StepQuestWidgetStore.writeSnapshot(applicationContext, localSnapshot.toString())
    StepQuestWidgetProvider.updateAllWidgets(applicationContext)
    notifyStepGoalReachedIfNeeded(syncContext, localSnapshot, recordedFor)

    if (!shouldAttemptServerSync(localSnapshot, recordedFor)) {
      return Result.success()
    }

    markServerSyncAttempt(localSnapshot, recordedFor)
    syncServerBestEffort(syncContext, localSnapshot, recordedFor)
    return Result.success()
  }

  private suspend fun readTodaySteps(): Int? {
    if (
      HealthConnectClient.getSdkStatus(applicationContext) !=
        HealthConnectClient.SDK_AVAILABLE
    ) {
      return null
    }

    val client = HealthConnectClient.getOrCreate(applicationContext)
    val grantedPermissions = client.permissionController.getGrantedPermissions()
    if (!grantedPermissions.contains(HealthPermission.getReadPermission(StepsRecord::class))) {
      return null
    }

    val now = Instant.now()
    val start = LocalDate.now().atStartOfDay(ZoneId.systemDefault()).toInstant()
    val result = client.aggregate(
      AggregateRequest(
        metrics = setOf(StepsRecord.COUNT_TOTAL),
        timeRangeFilter = TimeRangeFilter.between(start, now),
      ),
    )

    return max(0, result[StepsRecord.COUNT_TOTAL]?.toInt() ?: 0)
  }

  private fun buildLocalSnapshot(
    context: StepQuestWidgetSyncContext,
    existingSnapshot: StepQuestWidgetSnapshot?,
    recordedFor: String,
    stepCount: Int,
  ): JSONObject {
    val sameDaySnapshot = existingSnapshot?.takeIf { it.recordedFor == recordedFor }
    val target = max(sameDaySnapshot?.target ?: STEP_GOAL, 1)
    val reward = max(sameDaySnapshot?.reward ?: DEFAULT_REWARD, 0)
    val progress = max(max(stepCount, 0), sameDaySnapshot?.progress ?: 0)
    val status = when {
      sameDaySnapshot?.status == "claimed" -> "claimed"
      sameDaySnapshot?.status == "failed" -> "failed"
      progress >= target -> "completed"
      else -> "active"
    }

    return buildSnapshotJson(
      locale = context.preferredLanguage,
      themeName = sameDaySnapshot?.themeName ?: StepQuestWidgetStore.readThemeName(applicationContext),
      progress = progress,
      target = target,
      reward = reward,
      status = status,
      recordedFor = recordedFor,
      deepLink = sameDaySnapshot?.deepLink ?: "adventure-time://widget-quests?focus=steps",
    )
  }

  private fun buildSnapshotJson(
    locale: String,
    themeName: String,
    progress: Int,
    target: Int,
    reward: Int,
    status: String,
    recordedFor: String,
    deepLink: String,
  ): JSONObject {
    val rewardLabel = formatNumber(reward, locale)
    val remaining = max(0, target - progress)

    return JSONObject()
      .put("questType", "steps_10k")
      .put("themeName", StepQuestWidgetStore.normalizeThemeName(themeName))
      .put("title", if (locale == "fr") "Marcher 10 000 pas" else "Walk 10,000 steps")
      .put("progress", progress)
      .put("target", target)
      .put("reward", reward)
      .put("status", status)
      .put("recordedFor", recordedFor)
      .put("deepLink", deepLink)
      .put("updatedAt", Instant.now().toString())
      .put("progressLabel", "${formatNumber(progress, locale)} / ${formatNumber(target, locale)}")
      .put("statusLabel", if (status == "completed" || status == "claimed") {
        if (locale == "fr") "Réclamer" else "Claim"
      } else {
        if (locale == "fr") "Progression" else "Progress"
      })
      .put("subtitle", subtitle(locale, status, remaining, rewardLabel))
  }

  private fun subtitle(
    locale: String,
    status: String,
    remaining: Int,
    rewardLabel: String,
  ): String {
    return when (status) {
      "completed" ->
        if (locale == "fr") "Récompense prête : $rewardLabel pièces" else "Reward ready: $rewardLabel coins"
      "claimed" -> if (locale == "fr") "Récupérée pour aujourd'hui" else "Claimed for today"
      "failed" -> if (locale == "fr") "Réessaie demain" else "Try again tomorrow"
      else -> {
        val remainingLabel = formatNumber(remaining, locale)
        if (locale == "fr") "$remainingLabel pas restants" else "$remainingLabel steps left"
      }
    }
  }

  private fun notifyStepGoalReachedIfNeeded(
    context: StepQuestWidgetSyncContext,
    snapshot: JSONObject,
    recordedFor: String,
  ) {
    val userId = context.userId ?: return
    if (!context.notifyStepGoal || snapshot.optInt("progress") < snapshot.optInt("target")) {
      return
    }

    if (StepQuestWidgetStore.notificationDelivered(applicationContext, userId, recordedFor)) {
      return
    }

    if (
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
      ContextCompat.checkSelfPermission(
        applicationContext,
        Manifest.permission.POST_NOTIFICATIONS,
      ) != PackageManager.PERMISSION_GRANTED
    ) {
      return
    }

    val notificationManager =
      applicationContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      notificationManager.createNotificationChannel(
        NotificationChannel(
          STEP_NOTIFICATION_CHANNEL_ID,
          "Step goals",
          NotificationManager.IMPORTANCE_DEFAULT,
        ),
      )
    }

    val notification = NotificationCompat.Builder(applicationContext, STEP_NOTIFICATION_CHANNEL_ID)
      .setSmallIcon(applicationContext.applicationInfo.icon)
      .setContentTitle(if (context.preferredLanguage == "fr") "Objectif de pas atteint" else "Step goal reached")
      .setContentText(
        if (context.preferredLanguage == "fr") {
          "Tu as atteint 10 000 pas. Ta quête du jour est prête à être réclamée."
        } else {
          "You hit 10,000 steps. Your daily quest is ready to claim."
        },
      )
      .setAutoCancel(true)
      .setPriority(NotificationCompat.PRIORITY_DEFAULT)
      .build()

    NotificationManagerCompat.from(applicationContext).notify(
      UUID.nameUUIDFromBytes("step-goal-$userId-$recordedFor".toByteArray()).hashCode(),
      notification,
    )
    StepQuestWidgetStore.markNotificationDelivered(applicationContext, userId, recordedFor)
  }

  private fun shouldAttemptServerSync(snapshot: JSONObject, recordedFor: String): Boolean {
    val state = StepQuestWidgetStore.readServerSyncState(applicationContext)
    val progress = snapshot.optInt("progress", 0)
    val target = snapshot.optInt("target", STEP_GOAL)

    if (progress >= target) {
      return state?.completionAttemptedFor != recordedFor
    }

    if (state == null || state.recordedFor != recordedFor || state.lastAttemptAt <= 0L) {
      return true
    }

    return System.currentTimeMillis() - state.lastAttemptAt >= SERVER_SYNC_THROTTLE_MS
  }

  private fun markServerSyncAttempt(snapshot: JSONObject, recordedFor: String) {
    val existing = StepQuestWidgetStore.readServerSyncState(applicationContext)
    val progress = snapshot.optInt("progress", 0)
    val target = snapshot.optInt("target", STEP_GOAL)

    StepQuestWidgetStore.writeServerSyncState(
      applicationContext,
      StepQuestWidgetServerSyncState(
        recordedFor = recordedFor,
        lastAttemptAt = System.currentTimeMillis(),
        completionAttemptedFor = if (progress >= target) {
          recordedFor
        } else if (existing?.recordedFor == recordedFor) {
          existing.completionAttemptedFor
        } else {
          null
        },
      ),
    )
  }

  private fun syncServerBestEffort(
    context: StepQuestWidgetSyncContext,
    snapshot: JSONObject,
    recordedFor: String,
  ) {
    val accessToken = context.accessToken ?: return
    val baseUrl = context.apiBaseUrl.ifBlank { return }

    runCatching {
      performJsonRequest(
        baseUrl = baseUrl,
        path = "/health/steps",
        method = "POST",
        accessToken = accessToken,
        payload = JSONObject()
          .put("source", "device_health")
          .put("stepCount", snapshot.optInt("progress", 0))
          .put("recordedFor", recordedFor),
      )

      val quests = performJsonRequest(
        baseUrl = baseUrl,
        path = "/quests",
        method = "GET",
        accessToken = accessToken,
        payload = null,
      )
      val reconciled = buildSnapshotFromQuests(quests, snapshot, context.preferredLanguage, recordedFor)
        ?: return@runCatching

      StepQuestWidgetStore.writeSnapshot(applicationContext, reconciled.toString())
      StepQuestWidgetProvider.updateAllWidgets(applicationContext)
    }
  }

  private fun buildSnapshotFromQuests(
    questsResponse: JSONObject,
    localSnapshot: JSONObject,
    locale: String,
    recordedFor: String,
  ): JSONObject? {
    val quests = questsResponse.optJSONArray("quests") ?: return null
    val quest = findStepQuest(quests) ?: return null
    val target = max(quest.optInt("target", STEP_GOAL), 1)
    val serverProgress = max(quest.optInt("progress", 0), 0)
    val serverClaimed = quest.optBoolean("claimed", false)
    val serverFailed = quest.optBoolean("failed", false)
    val progress = if (serverClaimed || serverFailed) {
      serverProgress
    } else {
      max(serverProgress, localSnapshot.optInt("progress", 0))
    }
    val status = when {
      serverClaimed -> "claimed"
      serverFailed -> "failed"
      quest.optBoolean("completed", false) || progress >= target -> "completed"
      else -> "active"
    }

    return buildSnapshotJson(
      locale = locale,
      themeName = localSnapshot.optString("themeName", StepQuestWidgetStore.readThemeName(applicationContext)),
      progress = progress,
      target = target,
      reward = quest.optInt("reward", DEFAULT_REWARD),
      status = status,
      recordedFor = recordedFor,
      deepLink = localSnapshot.optString("deepLink", "adventure-time://widget-quests?focus=steps"),
    )
  }

  private fun findStepQuest(quests: JSONArray): JSONObject? {
    for (index in 0 until quests.length()) {
      val quest = quests.optJSONObject(index) ?: continue
      if (quest.optString("type") == "steps_10k") {
        return quest
      }
    }

    return null
  }

  private fun performJsonRequest(
    baseUrl: String,
    path: String,
    method: String,
    accessToken: String,
    payload: JSONObject?,
  ): JSONObject {
    val normalizedPath = if (path.startsWith("/")) path else "/$path"
    val url = URL("${baseUrl.trimEnd('/')}$normalizedPath")
    val connection = (url.openConnection() as HttpURLConnection).apply {
      requestMethod = method
      setRequestProperty("Accept", "application/json")
      setRequestProperty("Authorization", "Bearer $accessToken")
      connectTimeout = 10_000
      readTimeout = 10_000

      if (payload != null) {
        doOutput = true
        setRequestProperty("Content-Type", "application/json")
        outputStream.use { output ->
          output.write(payload.toString().toByteArray())
        }
      }
    }

    val responseCode = connection.responseCode
    val body = if (responseCode in 200..299) {
      connection.inputStream.bufferedReader().use { it.readText() }
    } else {
      throw IllegalStateException("Request failed with status $responseCode")
    }

    return if (body.isBlank()) JSONObject() else JSONObject(body)
  }

  private fun currentLocalDate(): String {
    return SimpleDateFormat("yyyy-MM-dd", Locale.US).format(java.util.Date())
  }

  private fun formatNumber(value: Int, locale: String): String {
    return NumberFormat.getIntegerInstance(Locale.forLanguageTag(locale)).format(value)
  }
}
