import Foundation
import React
import WidgetKit

private let atStepQuestWidgetAppGroup = "group.love.leaetzak.adventuretime"
private let atStepQuestWidgetSnapshotKey = "stepQuestWidgetSnapshot"
private let atStepQuestWidgetKind = "StepQuestWidget"

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
}
