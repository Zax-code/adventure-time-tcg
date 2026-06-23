import Foundation
import React
import WidgetKit

private let atStepQuestWidgetAppGroup = "group.love.leaetzak.adventuretime"
private let atStepQuestWidgetSnapshotKey = "stepQuestWidgetSnapshot"
private let atStepQuestWidgetKind = "StepQuestWidget"
private let atStepQuestWidgetApiBaseUrlKey = "stepQuestWidgetApiBaseUrl"
private let atStepQuestWidgetThemeNameKey = "stepQuestWidgetThemeName"
private let atStepQuestWidgetLocaleKey = "stepQuestWidgetLocale"
private let atStepQuestWidgetAccessTokenKey = "stepQuestWidgetAccessToken"
private let atStepQuestWidgetRefreshTokenKey = "stepQuestWidgetRefreshToken"
private let atStepQuestWidgetUserContextKey = "stepQuestWidgetUserContext"

@objc(WidgetSnapshotBridge)
final class WidgetSnapshotBridge: NSObject {
  @objc
  static func requiresMainQueueSetup() -> Bool {
    false
  }

  @objc(setStepQuestSnapshot:resolver:rejecter:)
  func setStepQuestSnapshot(
    _ snapshotJson: String,
    resolver resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    guard let defaults = UserDefaults(suiteName: atStepQuestWidgetAppGroup) else {
      reject("WIDGET_SNAPSHOT_WRITE_FAILED", "App group defaults are unavailable.", nil)
      return
    }

    defaults.set(snapshotJson, forKey: atStepQuestWidgetSnapshotKey)
    reloadWidgetTimeline()
    resolve(nil)
  }

  @objc(setStepQuestSyncContext:resolver:rejecter:)
  func setStepQuestSyncContext(
    _ contextJson: String,
    resolver resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    guard let defaults = UserDefaults(suiteName: atStepQuestWidgetAppGroup) else {
      reject("WIDGET_SYNC_CONTEXT_WRITE_FAILED", "App group defaults are unavailable.", nil)
      return
    }

    guard let data = contextJson.data(using: .utf8),
          let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
          let apiBaseUrl = json["apiBaseUrl"] as? String,
          !apiBaseUrl.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    else {
      reject("WIDGET_SYNC_CONTEXT_INVALID", "The widget sync context is invalid.", nil)
      return
    }

    let themeName = (json["themeName"] as? String) ?? "candy"
    let locale = normalizeWidgetLocale((json["locale"] as? String) ?? "en")
    defaults.set(apiBaseUrl, forKey: atStepQuestWidgetApiBaseUrlKey)
    defaults.set(themeName, forKey: atStepQuestWidgetThemeNameKey)
    defaults.set(locale, forKey: atStepQuestWidgetLocaleKey)
    defaults.set(json["accessToken"] as? String, forKey: atStepQuestWidgetAccessTokenKey)
    defaults.set(json["refreshToken"] as? String, forKey: atStepQuestWidgetRefreshTokenKey)

    if let user = json["user"] {
      let userData = try? JSONSerialization.data(withJSONObject: user)
      defaults.set(userData.flatMap { String(data: $0, encoding: .utf8) }, forKey: atStepQuestWidgetUserContextKey)
    } else {
      defaults.removeObject(forKey: atStepQuestWidgetUserContextKey)
    }

    startStepQuestBackgroundSync()
    reloadWidgetTimeline()
    resolve(nil)
  }

  @objc(clearStepQuestSyncContextWithResolver:rejecter:)
  func clearStepQuestSyncContext(
    withResolver resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    guard let defaults = UserDefaults(suiteName: atStepQuestWidgetAppGroup) else {
      reject("WIDGET_SYNC_CONTEXT_CLEAR_FAILED", "App group defaults are unavailable.", nil)
      return
    }

    defaults.removeObject(forKey: atStepQuestWidgetApiBaseUrlKey)
    defaults.removeObject(forKey: atStepQuestWidgetThemeNameKey)
    defaults.removeObject(forKey: atStepQuestWidgetLocaleKey)
    defaults.removeObject(forKey: atStepQuestWidgetAccessTokenKey)
    defaults.removeObject(forKey: atStepQuestWidgetRefreshTokenKey)
    defaults.removeObject(forKey: atStepQuestWidgetUserContextKey)
    resolve(nil)
  }

  @objc(startStepQuestBackgroundSyncWithResolver:rejecter:)
  func startStepQuestBackgroundSync(
    withResolver resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    startStepQuestBackgroundSync()
    resolve(nil)
  }

  @objc(clearStepQuestSnapshotWithResolver:rejecter:)
  func clearStepQuestSnapshot(
    withResolver resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    guard let defaults = UserDefaults(suiteName: atStepQuestWidgetAppGroup) else {
      reject("WIDGET_SNAPSHOT_CLEAR_FAILED", "App group defaults are unavailable.", nil)
      return
    }

    defaults.removeObject(forKey: atStepQuestWidgetSnapshotKey)
    reloadWidgetTimeline()
    resolve(nil)
  }

  private func reloadWidgetTimeline() {
    if #available(iOS 14.0, *) {
      WidgetCenter.shared.reloadTimelines(ofKind: atStepQuestWidgetKind)
    }
  }

  private func startStepQuestBackgroundSync() {
    Task {
      await StepQuestBackgroundSyncService.shared.configure()
    }
  }

  private func normalizeWidgetLocale(_ locale: String) -> String {
    switch locale {
    case "fr":
      return "fr"
    default:
      return "en"
    }
  }
}
