import SwiftUI
import WidgetKit

private let appGroupId = "group.love.leaetzak.adventuretime"
private let snapshotKey = "stepQuestWidgetSnapshot"
private let widgetKind = "StepQuestWidget"
private let defaultDeepLink = "adventure-time://widget-quests?focus=steps"

private struct StepQuestSnapshot: Decodable {
  let title: String
  let progress: Int
  let target: Int
  let reward: Int
  let status: String
  let deepLink: String
  let progressLabel: String
  let statusLabel: String
  let subtitle: String
}

private struct StepQuestEntry: TimelineEntry {
  let date: Date
  let snapshot: StepQuestSnapshot?
}

private struct StepQuestProvider: TimelineProvider {
  func placeholder(in context: Context) -> StepQuestEntry {
    StepQuestEntry(
      date: Date(),
      snapshot: StepQuestSnapshot(
        title: localized(en: "Walk 10,000 steps", fr: "Marcher 10 000 pas"),
        progress: 7421,
        target: 10_000,
        reward: 150,
        status: "active",
        deepLink: defaultDeepLink,
        progressLabel: "7,421 / 10,000",
        statusLabel: localized(en: "Progress", fr: "Progression"),
        subtitle: localized(en: "2,579 steps left", fr: "2 579 pas restants")
      )
    )
  }

  func getSnapshot(in context: Context, completion: @escaping (StepQuestEntry) -> Void) {
    completion(loadEntry())
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<StepQuestEntry>) -> Void) {
    let entry = loadEntry()
    let refreshDate = Calendar.current.date(byAdding: .minute, value: 15, to: Date()) ?? Date().addingTimeInterval(900)
    completion(Timeline(entries: [entry], policy: .after(refreshDate)))
  }

  private func loadEntry() -> StepQuestEntry {
    let defaults = UserDefaults(suiteName: appGroupId)
    let snapshotJson = defaults?.string(forKey: snapshotKey)
    let snapshot = snapshotJson
      .flatMap { $0.data(using: .utf8) }
      .flatMap { try? JSONDecoder().decode(StepQuestSnapshot.self, from: $0) }

    return StepQuestEntry(date: Date(), snapshot: snapshot)
  }
}

struct StepQuestWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: widgetKind, provider: StepQuestProvider()) { entry in
      StepQuestWidgetView(entry: entry)
    }
    .configurationDisplayName(localized(en: "Step Quest", fr: "Quete de pas"))
    .description(localized(en: "Follow your daily step quest progress.", fr: "Suis la progression de ta quete de pas."))
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}

private struct StepQuestWidgetView: View {
  @Environment(\.widgetFamily) private var family

  let entry: StepQuestEntry

  var body: some View {
    ZStack {
      RoundedRectangle(cornerRadius: 24, style: .continuous)
        .fill(Color(red: 1.0, green: 0.968, blue: 0.929))

      if let snapshot = entry.snapshot {
        content(snapshot: snapshot)
      } else {
        fallback
      }
    }
    .widgetURL(URL(string: entry.snapshot?.deepLink ?? defaultDeepLink))
  }

  @ViewBuilder
  private func content(snapshot: StepQuestSnapshot) -> some View {
    VStack(alignment: .leading, spacing: family == .systemSmall ? 8 : 10) {
      HStack(alignment: .top, spacing: 8) {
        Text(snapshot.title)
          .font(.system(size: family == .systemSmall ? 15 : 17, weight: .bold))
          .foregroundStyle(Color(red: 0.122, green: 0.161, blue: 0.216))
          .lineLimit(2)

        Spacer(minLength: 8)

        Text("🪙 \(snapshot.reward)")
          .font(.system(size: family == .systemSmall ? 12 : 13, weight: .bold))
          .foregroundStyle(Color(red: 0.706, green: 0.325, blue: 0.035))
      }

      Text(snapshot.statusLabel)
        .font(.system(size: 12, weight: .semibold))
        .foregroundStyle(Color(red: 0.859, green: 0.153, blue: 0.475))
        .lineLimit(1)

      if family == .systemMedium {
        Text(snapshot.subtitle)
          .font(.system(size: 12))
          .foregroundStyle(Color(red: 0.42, green: 0.451, blue: 0.502))
          .lineLimit(2)
      }

      ProgressView(
        value: Double(snapshot.progress),
        total: Double(max(snapshot.target, 1))
      )
      .tint(progressTint(for: snapshot.status))

      VStack(alignment: .leading, spacing: 2) {
        if family == .systemSmall {
          Text(snapshot.subtitle)
            .font(.system(size: 11))
            .foregroundStyle(Color(red: 0.42, green: 0.451, blue: 0.502))
            .lineLimit(2)
        }

        Text(snapshot.progressLabel)
          .font(.system(size: 12, weight: .semibold))
          .foregroundStyle(Color(red: 0.216, green: 0.255, blue: 0.318))
      }
    }
    .padding(16)
  }

  private var fallback: some View {
    VStack(alignment: .leading, spacing: 8) {
      Text(localized(en: "Step quest", fr: "Quete de pas"))
        .font(.system(size: 16, weight: .bold))
        .foregroundStyle(Color(red: 0.122, green: 0.161, blue: 0.216))

      Text(localized(en: "Open the app to load today's progress.", fr: "Ouvre l'application pour charger la progression du jour."))
        .font(.system(size: 12))
        .foregroundStyle(Color(red: 0.42, green: 0.451, blue: 0.502))
        .lineLimit(3)

      Spacer(minLength: 0)
    }
    .padding(16)
  }

  private func progressTint(for status: String) -> Color {
    switch status {
    case "completed":
      return Color(red: 0.067, green: 0.62, blue: 0.345)
    case "claimed":
      return Color(red: 0.596, green: 0.647, blue: 0.702)
    case "failed":
      return Color(red: 0.863, green: 0.153, blue: 0.204)
    default:
      return Color(red: 0.973, green: 0.451, blue: 0.09)
    }
  }
}

private func localized(en: String, fr: String) -> String {
  let preferredLanguage = Locale.preferredLanguages.first ?? "en"
  return preferredLanguage.hasPrefix("fr") ? fr : en
}
