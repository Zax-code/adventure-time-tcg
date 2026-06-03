internal import Expo
import Foundation
import HealthKit
import React
import ReactAppDependencyProvider
import Security
import WidgetKit

@UIApplicationMain
class AppDelegate: ExpoAppDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ExpoReactNativeFactoryDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
  // Linking API
  override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    return super.application(app, open: url, options: options) || RCTLinkingManager.application(app, open: url, options: options)
  }

  // Universal Links
  override func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    let result = RCTLinkingManager.application(application, continue: userActivity, restorationHandler: restorationHandler)
    return super.application(application, continue: userActivity, restorationHandler: restorationHandler) || result
  }
}

class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {
  // Extension point for config-plugins

  override func sourceURL(for bridge: RCTBridge) -> URL? {
    #if DEBUG
      // In development builds expo-dev-client may provide a Metro URL here.
      bridge.bundleURL ?? bundleURL()
    #else
      // E2E and production-style builds should always boot from the embedded bundle.
      bundleURL()
    #endif
  }

  override func bundleURL() -> URL? {
#if DEBUG
    return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")
#else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}

private let atStepQuestWidgetAppGroup = "group.love.leaetzak.adventuretime"
private let atStepQuestWidgetSnapshotKey = "stepQuestWidgetSnapshot"
private let atStepQuestWidgetKind = "StepQuestWidget"
private let atStepQuestWidgetApiBaseUrlKey = "stepQuestWidgetApiBaseUrl"
private let atStepQuestWidgetThemeNameKey = "stepQuestWidgetThemeName"
private let atStepQuestWidgetLocaleKey = "stepQuestWidgetLocale"
private let atStepQuestSecureStorePrimaryService = "app:no-auth"
private let atStepQuestSecureStoreLegacyService = "app"
private let atStepQuestDefaultApiBaseUrl = "https://app.leaetzak.love"
private let atStepQuestDefaultDeepLink = "adventure-time://widget-quests?focus=steps"
private let atStepQuestDefaultTarget = 10_000
private let atStepQuestDefaultReward = 150

private struct NativeStoredAuthUser: Codable {
  let id: String
  let email: String
  let displayName: String?
  let avatarAssetId: String?
  let coins: Int
  let dust: Int
  let isAdmin: Bool
  let isSuperAdmin: Bool
  let preferredStepSource: String
  let preferredLanguage: String
  let timezone: String
}

private struct NativeAuthTokens: Decodable {
  let accessToken: String
  let refreshToken: String
}

private struct NativeAuthResponse: Decodable {
  let user: NativeStoredAuthUser
  let tokens: NativeAuthTokens
}

private struct NativeQuest: Decodable {
  let type: String
  let title: String
  let target: Int
  let progress: Int
  let completed: Bool
  let claimed: Bool
  let reward: Int
  let failed: Bool
}

private struct NativeQuestsResponse: Decodable {
  let quests: [NativeQuest]
}

private struct NativeStepQuestWidgetSnapshot: Codable {
  let themeName: String?
  let title: String
  let progress: Int
  let target: Int
  let reward: Int
  let status: String
  let recordedFor: String?
  let deepLink: String
  let updatedAt: String?
  let progressLabel: String
  let statusLabel: String
  let subtitle: String
}

private enum StepQuestBackgroundSyncError: Error {
  case invalidURL
  case invalidResponse
  case unauthorized
}

actor StepQuestBackgroundSyncService {
  static let shared = StepQuestBackgroundSyncService()

  private let healthStore = HKHealthStore()
  private var observerQuery: HKObserverQuery?
  private var isSyncing = false

  func configure() async {
    guard HKHealthStore.isHealthDataAvailable() else {
      return
    }

    if observerQuery == nil {
      registerObserverQuery()
    }

    await enableBackgroundDeliveryIfPossible()
  }

  private func registerObserverQuery() {
    guard let sampleType = HKObjectType.quantityType(forIdentifier: .stepCount) else {
      return
    }

    let query = HKObserverQuery(sampleType: sampleType, predicate: nil) { _, completionHandler, error in
      Task {
        await StepQuestBackgroundSyncService.shared.handleObserverUpdate(error: error)
        completionHandler()
      }
    }

    healthStore.execute(query)
    observerQuery = query
  }

  private func enableBackgroundDeliveryIfPossible() async {
    guard let sampleType = HKObjectType.quantityType(forIdentifier: .stepCount) else {
      return
    }

    do {
      let _: Bool = try await withCheckedThrowingContinuation {
        (continuation: CheckedContinuation<Bool, Error>) in
        self.healthStore.enableBackgroundDelivery(for: sampleType, frequency: .immediate) {
          success,
          error in
          if let error {
            continuation.resume(throwing: error)
            return
          }

          continuation.resume(returning: success)
        }
      }
    } catch {
      // Background widget updates still fall back to app-driven writes when this fails.
    }
  }

  private func handleObserverUpdate(error: Error?) async {
    guard error == nil, !isSyncing else {
      return
    }

    isSyncing = true
    defer {
      isSyncing = false
    }

    await syncFromHealthKit()
  }

  private func syncFromHealthKit() async {
    let now = Date()
    let recordedFor = formatLocalDate(now)
    let storedUser = loadStoredAuthUser()
    let locale = loadStoredWidgetLocale() ?? storedUser?.preferredLanguage ?? "en"
    let existingSnapshot = loadStoredSnapshot()

    guard let stepCount = await readTodayStepCount(now: now) else {
      return
    }

    let localSnapshot = buildLocalSnapshot(
      stepCount: stepCount,
      locale: locale,
      recordedFor: recordedFor,
      existingSnapshot: existingSnapshot
    )
    saveSnapshot(localSnapshot)

    guard storedUser?.preferredStepSource == "device_health" else {
      return
    }

    guard let accessToken = loadSecureStoreValue(for: "accessToken") else {
      return
    }

    let refreshToken = loadSecureStoreValue(for: "refreshToken")
    let apiBaseUrl = loadApiBaseUrl()

    var authorizedToken = accessToken

    do {
      try await postStepSync(
        baseUrl: apiBaseUrl,
        accessToken: authorizedToken,
        stepCount: stepCount,
        recordedFor: recordedFor
      )
    } catch StepQuestBackgroundSyncError.unauthorized {
      guard let refreshToken else {
        return
      }

      do {
        let refreshed = try await refreshSession(
          baseUrl: apiBaseUrl,
          refreshToken: refreshToken
        )
        persistSession(refreshed)
        authorizedToken = refreshed.tokens.accessToken

        try await postStepSync(
          baseUrl: apiBaseUrl,
          accessToken: authorizedToken,
          stepCount: stepCount,
          recordedFor: recordedFor
        )
      } catch {
        return
      }
    } catch {
      return
    }

    do {
      let questsResponse = try await fetchQuests(
        baseUrl: apiBaseUrl,
        accessToken: authorizedToken
      )

      if let syncedSnapshot = buildSnapshotFromQuests(
        questsResponse,
        locale: locale,
        recordedFor: recordedFor,
        existingSnapshot: existingSnapshot
      ) {
        saveSnapshot(syncedSnapshot)
      }
    } catch {
      // The widget already has a locally refreshed snapshot.
    }
  }

  private func readTodayStepCount(now: Date) async -> Int? {
    guard let sampleType = HKObjectType.quantityType(forIdentifier: .stepCount) else {
      return nil
    }

    let predicate = HKQuery.predicateForSamples(
      withStart: startOfLocalDay(now),
      end: now,
      options: .strictStartDate
    )

    return await withCheckedContinuation { continuation in
      let query = HKStatisticsQuery(
        quantityType: sampleType,
        quantitySamplePredicate: predicate,
        options: .cumulativeSum
      ) { _, result, _ in
        let value = result?.sumQuantity()?.doubleValue(for: HKUnit.count()) ?? 0
        continuation.resume(returning: max(0, Int(value.rounded())))
      }

      self.healthStore.execute(query)
    }
  }
}

private func loadStoredAuthUser() -> NativeStoredAuthUser? {
  guard let rawUser = loadSecureStoreValue(for: "user"),
        let data = rawUser.data(using: .utf8)
  else {
    return nil
  }

  return try? JSONDecoder().decode(NativeStoredAuthUser.self, from: data)
}

private func loadSecureStoreValue(for key: String) -> String? {
  for service in [atStepQuestSecureStorePrimaryService, atStepQuestSecureStoreLegacyService] {
    if let value = loadSecureStoreValue(for: key, service: service) {
      return value
    }
  }

  return nil
}

private func loadSecureStoreValue(for key: String, service: String) -> String? {
  let encodedKey = Data(key.utf8)
  let query: [String: Any] = [
    kSecClass as String: kSecClassGenericPassword,
    kSecAttrService as String: service,
    kSecAttrGeneric as String: encodedKey,
    kSecAttrAccount as String: encodedKey,
    kSecMatchLimit as String: kSecMatchLimitOne,
    kSecReturnData as String: kCFBooleanTrue as Any
  ]

  var item: CFTypeRef?
  let status = SecItemCopyMatching(query as CFDictionary, &item)

  switch status {
  case errSecSuccess:
    guard let data = item as? Data else {
      return nil
    }

    return String(data: data, encoding: .utf8)
  case errSecItemNotFound, errSecInteractionNotAllowed:
    return nil
  default:
    return nil
  }
}

@discardableResult
private func writeSecureStoreValue(_ value: String, for key: String) -> Bool {
  let encodedKey = Data(key.utf8)
  guard let valueData = value.data(using: .utf8) else {
    return false
  }

  let baseQuery: [String: Any] = [
    kSecClass as String: kSecClassGenericPassword,
    kSecAttrService as String: atStepQuestSecureStorePrimaryService,
    kSecAttrGeneric as String: encodedKey,
    kSecAttrAccount as String: encodedKey
  ]

  let addQuery = baseQuery.merging(
    [
      kSecValueData as String: valueData,
      kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock
    ],
    uniquingKeysWith: { _, new in new }
  )

  let addStatus = SecItemAdd(addQuery as CFDictionary, nil)
  if addStatus == errSecSuccess {
    return true
  }

  if addStatus == errSecDuplicateItem {
    let updateStatus = SecItemUpdate(
      baseQuery as CFDictionary,
      [kSecValueData as String: valueData] as CFDictionary
    )
    return updateStatus == errSecSuccess
  }

  return false
}

private func persistSession(_ response: NativeAuthResponse) {
  let encoder = JSONEncoder()
  guard let userData = try? encoder.encode(response.user),
        let userString = String(data: userData, encoding: .utf8)
  else {
    return
  }

  _ = writeSecureStoreValue(response.tokens.accessToken, for: "accessToken")
  _ = writeSecureStoreValue(response.tokens.refreshToken, for: "refreshToken")
  _ = writeSecureStoreValue(userString, for: "user")
}

private func loadApiBaseUrl() -> String {
  guard let defaults = UserDefaults(suiteName: atStepQuestWidgetAppGroup),
        let stored = defaults.string(forKey: atStepQuestWidgetApiBaseUrlKey),
        !stored.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
  else {
    return atStepQuestDefaultApiBaseUrl
  }

  return stored
}

private func loadStoredSnapshot() -> NativeStepQuestWidgetSnapshot? {
  guard let defaults = UserDefaults(suiteName: atStepQuestWidgetAppGroup),
        let snapshotJson = defaults.string(forKey: atStepQuestWidgetSnapshotKey),
        let data = snapshotJson.data(using: .utf8)
  else {
    return nil
  }

  return try? JSONDecoder().decode(NativeStepQuestWidgetSnapshot.self, from: data)
}

private func loadStoredWidgetLocale() -> String? {
  guard let defaults = UserDefaults(suiteName: atStepQuestWidgetAppGroup) else {
    return nil
  }

  return normalizeWidgetLocale(defaults.string(forKey: atStepQuestWidgetLocaleKey))
}

private func saveSnapshot(_ snapshot: NativeStepQuestWidgetSnapshot) {
  guard let defaults = UserDefaults(suiteName: atStepQuestWidgetAppGroup),
        let data = try? JSONEncoder().encode(snapshot),
        let snapshotJson = String(data: data, encoding: .utf8)
  else {
    return
  }

  defaults.set(snapshotJson, forKey: atStepQuestWidgetSnapshotKey)

  if #available(iOS 14.0, *) {
    WidgetCenter.shared.reloadTimelines(ofKind: atStepQuestWidgetKind)
  }
}

private func buildSnapshotFromQuests(
  _ response: NativeQuestsResponse,
  locale: String,
  recordedFor: String,
  existingSnapshot: NativeStepQuestWidgetSnapshot?
) -> NativeStepQuestWidgetSnapshot? {
  guard let quest = response.quests.first(where: { $0.type == "steps_10k" }) else {
    return nil
  }

  let status = questStatus(
    claimed: quest.claimed,
    completed: quest.completed,
    failed: quest.failed
  )
  let progress = max(quest.progress, 0)
  let rewardLabel = formatNumber(quest.reward, locale: locale)

  return NativeStepQuestWidgetSnapshot(
    themeName: resolveWidgetThemeName(existingSnapshot: existingSnapshot),
    title: localizedQuestTitle(locale: locale, titleKey: quest.title),
    progress: progress,
    target: max(quest.target, 1),
    reward: quest.reward,
    status: status,
    recordedFor: recordedFor,
    deepLink: existingSnapshot?.deepLink ?? atStepQuestDefaultDeepLink,
    updatedAt: isoTimestamp(Date()),
    progressLabel: "\(formatNumber(progress, locale: locale)) / \(formatNumber(max(quest.target, 1), locale: locale))",
    statusLabel: localizedStatusLabel(status: status, locale: locale),
    subtitle: localizedSubtitle(
      status: status,
      locale: locale,
      remaining: max(0, quest.target - progress),
      rewardLabel: rewardLabel
    )
  )
}

private func buildLocalSnapshot(
  stepCount: Int,
  locale: String,
  recordedFor: String,
  existingSnapshot: NativeStepQuestWidgetSnapshot?
) -> NativeStepQuestWidgetSnapshot {
  let baseSnapshot: NativeStepQuestWidgetSnapshot?
  if let existingSnapshot, existingSnapshot.recordedFor == recordedFor {
    baseSnapshot = existingSnapshot
  } else if let existingSnapshot {
    baseSnapshot = resetSnapshotForToday(existingSnapshot, locale: locale, recordedFor: recordedFor)
  } else {
    baseSnapshot = nil
  }

  let target = max(baseSnapshot?.target ?? atStepQuestDefaultTarget, 1)
  let reward = max(baseSnapshot?.reward ?? atStepQuestDefaultReward, 0)
  let progress = max(stepCount, 0)

  let status: String
  if baseSnapshot?.status == "claimed" {
    status = "claimed"
  } else if baseSnapshot?.status == "failed" {
    status = "failed"
  } else if progress >= target {
    status = "completed"
  } else {
    status = "active"
  }

  let rewardLabel = formatNumber(reward, locale: locale)

  return NativeStepQuestWidgetSnapshot(
    themeName: resolveWidgetThemeName(existingSnapshot: baseSnapshot),
    title: baseSnapshot?.title ?? localizedQuestTitle(locale: locale, titleKey: "steps_10k"),
    progress: progress,
    target: target,
    reward: reward,
    status: status,
    recordedFor: recordedFor,
    deepLink: baseSnapshot?.deepLink ?? atStepQuestDefaultDeepLink,
    updatedAt: isoTimestamp(Date()),
    progressLabel: "\(formatNumber(progress, locale: locale)) / \(formatNumber(target, locale: locale))",
    statusLabel: localizedStatusLabel(status: status, locale: locale),
    subtitle: localizedSubtitle(
      status: status,
      locale: locale,
      remaining: max(0, target - progress),
      rewardLabel: rewardLabel
    )
  )
}

private func resetSnapshotForToday(
  _ snapshot: NativeStepQuestWidgetSnapshot,
  locale: String,
  recordedFor: String
) -> NativeStepQuestWidgetSnapshot {
  NativeStepQuestWidgetSnapshot(
    themeName: resolveWidgetThemeName(existingSnapshot: snapshot),
    title: snapshot.title,
    progress: 0,
    target: max(snapshot.target, 1),
    reward: max(snapshot.reward, 0),
    status: "active",
    recordedFor: recordedFor,
    deepLink: snapshot.deepLink,
    updatedAt: isoTimestamp(Date()),
    progressLabel: "0 / \(formatNumber(max(snapshot.target, 1), locale: locale))",
    statusLabel: localizedStatusLabel(status: "active", locale: locale),
    subtitle: localizedSubtitle(
      status: "active",
      locale: locale,
      remaining: max(snapshot.target, 1),
      rewardLabel: formatNumber(max(snapshot.reward, 0), locale: locale)
    )
  )
}

private func questStatus(claimed: Bool, completed: Bool, failed: Bool) -> String {
  if claimed {
    return "claimed"
  }

  if completed {
    return "completed"
  }

  if failed {
    return "failed"
  }

  return "active"
}

private func localizedQuestTitle(locale: String, titleKey: String) -> String {
  switch locale {
  case "fr":
    if titleKey == "steps_10k" {
      return "Marcher 10 000 pas"
    }
  default:
    if titleKey == "steps_10k" {
      return "Walk 10,000 steps"
    }
  }

  return titleKey
}

private func resolveWidgetThemeName(existingSnapshot: NativeStepQuestWidgetSnapshot?) -> String {
  if let themeName = normalizeWidgetThemeName(existingSnapshot?.themeName) {
    return themeName
  }

  return loadStoredWidgetThemeName() ?? "candy"
}

private func loadStoredWidgetThemeName() -> String? {
  guard let defaults = UserDefaults(suiteName: atStepQuestWidgetAppGroup) else {
    return nil
  }

  return normalizeWidgetThemeName(defaults.string(forKey: atStepQuestWidgetThemeNameKey))
}

private func normalizeWidgetThemeName(_ themeName: String?) -> String? {
  switch themeName {
  case "candy", "ice", "nightosphere":
    return themeName
  default:
    return nil
  }
}

private func normalizeWidgetLocale(_ locale: String?) -> String? {
  switch locale {
  case "en", "fr":
    return locale
  default:
    return nil
  }
}

private func localizedStatusLabel(status: String, locale: String) -> String {
  switch status {
  case "completed", "claimed":
    return locale == "fr" ? "Réclamer" : "Claim"
  default:
    return locale == "fr" ? "Progression" : "Progress"
  }
}

private func localizedSubtitle(
  status: String,
  locale: String,
  remaining: Int,
  rewardLabel: String
) -> String {
  switch status {
  case "completed":
    return locale == "fr"
      ? "Récompense prête : \(rewardLabel) pièces"
      : "Reward ready: \(rewardLabel) coins"
  case "claimed":
    return locale == "fr" ? "Récupérée pour aujourd'hui" : "Claimed for today"
  case "failed":
    return locale == "fr" ? "Réessaie demain" : "Try again tomorrow"
  default:
    let remainingLabel = formatNumber(remaining, locale: locale)
    return locale == "fr"
      ? "\(remainingLabel) pas restants"
      : "\(remainingLabel) steps left"
  }
}

private func formatNumber(_ value: Int, locale: String) -> String {
  let formatter = NumberFormatter()
  formatter.locale = Locale(identifier: locale)
  formatter.numberStyle = .decimal
  return formatter.string(from: NSNumber(value: value)) ?? "\(value)"
}

private func isoTimestamp(_ date: Date) -> String {
  ISO8601DateFormatter().string(from: date)
}

private func formatLocalDate(_ date: Date) -> String {
  let components = Calendar.current.dateComponents([.year, .month, .day], from: date)
  let year = components.year ?? 0
  let month = components.month ?? 0
  let day = components.day ?? 0
  return String(format: "%04d-%02d-%02d", year, month, day)
}

private func startOfLocalDay(_ date: Date) -> Date {
  Calendar.current.startOfDay(for: date)
}

private func makeApiUrl(baseUrl: String, path: String) -> URL? {
  guard var components = URLComponents(string: baseUrl) else {
    return nil
  }

  let suffix = path.hasPrefix("/") ? path : "/\(path)"
  let currentPath = components.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
  components.path = currentPath.isEmpty ? suffix : "/\(currentPath)\(suffix)"
  return components.url
}

private func postStepSync(
  baseUrl: String,
  accessToken: String,
  stepCount: Int,
  recordedFor: String
) async throws {
  guard let url = makeApiUrl(baseUrl: baseUrl, path: "/health/steps") else {
    throw StepQuestBackgroundSyncError.invalidURL
  }

  let payload: [String: Any] = [
    "source": "device_health",
    "stepCount": stepCount,
    "recordedFor": recordedFor
  ]

  _ = try await performJsonRequest(
    url: url,
    method: "POST",
    accessToken: accessToken,
    payload: payload
  )
}

private func fetchQuests(baseUrl: String, accessToken: String) async throws -> NativeQuestsResponse {
  guard let url = makeApiUrl(baseUrl: baseUrl, path: "/quests") else {
    throw StepQuestBackgroundSyncError.invalidURL
  }

  let (data, _) = try await performJsonRequest(
    url: url,
    method: "GET",
    accessToken: accessToken,
    payload: nil
  )

  return try JSONDecoder().decode(NativeQuestsResponse.self, from: data)
}

private func refreshSession(
  baseUrl: String,
  refreshToken: String
) async throws -> NativeAuthResponse {
  guard let url = makeApiUrl(baseUrl: baseUrl, path: "/auth/refresh") else {
    throw StepQuestBackgroundSyncError.invalidURL
  }

  let (data, _) = try await performJsonRequest(
    url: url,
    method: "POST",
    accessToken: nil,
    payload: ["refreshToken": refreshToken]
  )

  return try JSONDecoder().decode(NativeAuthResponse.self, from: data)
}

private func performJsonRequest(
  url: URL,
  method: String,
  accessToken: String?,
  payload: [String: Any]?
) async throws -> (Data, HTTPURLResponse) {
  var request = URLRequest(url: url)
  request.httpMethod = method
  request.setValue("application/json", forHTTPHeaderField: "Accept")

  if let accessToken {
    request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
  }

  if let payload {
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.httpBody = try JSONSerialization.data(withJSONObject: payload)
  }

  let (data, response) = try await URLSession.shared.data(for: request)
  guard let httpResponse = response as? HTTPURLResponse else {
    throw StepQuestBackgroundSyncError.invalidResponse
  }

  if httpResponse.statusCode == 401 || httpResponse.statusCode == 403 {
    throw StepQuestBackgroundSyncError.unauthorized
  }

  guard (200 ..< 300).contains(httpResponse.statusCode) else {
    throw StepQuestBackgroundSyncError.invalidResponse
  }

  return (data, httpResponse)
}
