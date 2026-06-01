import SwiftUI
import WidgetKit

private let appGroupId = "group.love.leaetzak.adventuretime"
private let snapshotKey = "stepQuestWidgetSnapshot"
private let widgetKind = "StepQuestWidget"
private let defaultDeepLink = "adventure-time://widget-quests?focus=steps"
private let themeNameKey = "stepQuestWidgetThemeName"
private let localeKey = "stepQuestWidgetLocale"

private struct StepQuestSnapshot: Decodable {
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

private struct StepQuestEntry: TimelineEntry {
  let date: Date
  let snapshot: StepQuestSnapshot?
  let themeName: String
}

private struct StepQuestPalette {
  let backgroundTop: Color
  let backgroundBottom: Color
  let glowPrimary: Color
  let glowSecondary: Color
  let ringFill: Color
  let title: Color
  let body: Color
  let muted: Color
  let progress: Color
  let progressTrack: Color
  let statusText: Color
  let statusBackground: Color

  static func forTheme(_ themeName: String, status: String) -> StepQuestPalette {
    switch themeName {
    case "ice":
      return StepQuestPalette.ice(status: status)
    case "nightosphere":
      return StepQuestPalette.nightosphere(status: status)
    default:
      return StepQuestPalette.candy(status: status)
    }
  }

  private static func candy(status: String) -> StepQuestPalette {
    switch status {
    case "completed":
      return StepQuestPalette(
        backgroundTop: Color(red: 0.91, green: 0.99, blue: 0.95),
        backgroundBottom: Color(red: 1.0, green: 0.98, blue: 0.82),
        glowPrimary: Color(red: 0.18, green: 0.83, blue: 0.75),
        glowSecondary: Color(red: 0.98, green: 0.86, blue: 0.35),
        ringFill: Color.white.opacity(0.55),
        title: Color(red: 0.21, green: 0.24, blue: 0.20),
        body: Color(red: 0.28, green: 0.39, blue: 0.34),
        muted: Color(red: 0.42, green: 0.50, blue: 0.47),
        progress: Color(red: 0.08, green: 0.72, blue: 0.57),
        progressTrack: Color(red: 0.78, green: 0.96, blue: 0.89),
        statusText: Color(red: 0.02, green: 0.37, blue: 0.28),
        statusBackground: Color(red: 0.80, green: 0.98, blue: 0.91)
      )
    case "claimed":
      return StepQuestPalette(
        backgroundTop: Color(red: 0.98, green: 0.95, blue: 1.0),
        backgroundBottom: Color(red: 1.0, green: 0.94, blue: 0.98),
        glowPrimary: Color(red: 0.75, green: 0.52, blue: 0.99),
        glowSecondary: Color(red: 0.96, green: 0.45, blue: 0.71),
        ringFill: Color.white.opacity(0.55),
        title: Color(red: 0.28, green: 0.20, blue: 0.31),
        body: Color(red: 0.43, green: 0.36, blue: 0.48),
        muted: Color(red: 0.55, green: 0.48, blue: 0.60),
        progress: Color(red: 0.60, green: 0.52, blue: 0.75),
        progressTrack: Color(red: 0.91, green: 0.87, blue: 0.97),
        statusText: Color(red: 0.42, green: 0.22, blue: 0.62),
        statusBackground: Color(red: 0.94, green: 0.88, blue: 1.0)
      )
    case "failed":
      return StepQuestPalette(
        backgroundTop: Color(red: 1.0, green: 0.94, blue: 0.95),
        backgroundBottom: Color(red: 1.0, green: 0.96, blue: 0.90),
        glowPrimary: Color(red: 0.98, green: 0.44, blue: 0.52),
        glowSecondary: Color(red: 0.98, green: 0.60, blue: 0.20),
        ringFill: Color.white.opacity(0.55),
        title: Color(red: 0.35, green: 0.17, blue: 0.18),
        body: Color(red: 0.46, green: 0.28, blue: 0.25),
        muted: Color(red: 0.62, green: 0.42, blue: 0.37),
        progress: Color(red: 0.92, green: 0.35, blue: 0.28),
        progressTrack: Color(red: 1.0, green: 0.87, blue: 0.88),
        statusText: Color(red: 0.68, green: 0.11, blue: 0.18),
        statusBackground: Color(red: 1.0, green: 0.88, blue: 0.90)
      )
    default:
      return StepQuestPalette(
        backgroundTop: Color(red: 1.0, green: 0.94, blue: 0.97),
        backgroundBottom: Color(red: 1.0, green: 0.98, blue: 0.86),
        glowPrimary: Color(red: 0.96, green: 0.45, blue: 0.71),
        glowSecondary: Color(red: 0.99, green: 0.82, blue: 0.16),
        ringFill: Color.white.opacity(0.55),
        title: Color(red: 0.29, green: 0.22, blue: 0.16),
        body: Color(red: 0.38, green: 0.31, blue: 0.24),
        muted: Color(red: 0.47, green: 0.39, blue: 0.33),
        progress: Color(red: 0.93, green: 0.29, blue: 0.60),
        progressTrack: Color(red: 0.98, green: 0.84, blue: 0.91),
        statusText: Color(red: 0.75, green: 0.09, blue: 0.42),
        statusBackground: Color(red: 0.99, green: 0.87, blue: 0.93)
      )
    }
  }

  private static func ice(status: String) -> StepQuestPalette {
    switch status {
    case "completed":
      return StepQuestPalette(
        backgroundTop: Color(red: 0.90, green: 0.98, blue: 0.98),
        backgroundBottom: Color(red: 0.93, green: 0.99, blue: 1.0),
        glowPrimary: Color(red: 0.11, green: 0.77, blue: 0.74),
        glowSecondary: Color(red: 0.49, green: 0.83, blue: 1.0),
        ringFill: Color.white.opacity(0.55),
        title: Color(red: 0.09, green: 0.31, blue: 0.39),
        body: Color(red: 0.08, green: 0.37, blue: 0.46),
        muted: Color(red: 0.29, green: 0.42, blue: 0.49),
        progress: Color(red: 0.08, green: 0.72, blue: 0.65),
        progressTrack: Color(red: 0.80, green: 0.98, blue: 0.95),
        statusText: Color(red: 0.06, green: 0.46, blue: 0.43),
        statusBackground: Color(red: 0.82, green: 0.98, blue: 0.94)
      )
    case "claimed":
      return StepQuestPalette(
        backgroundTop: Color(red: 0.93, green: 0.96, blue: 1.0),
        backgroundBottom: Color(red: 0.95, green: 0.98, blue: 1.0),
        glowPrimary: Color(red: 0.51, green: 0.55, blue: 0.97),
        glowSecondary: Color(red: 0.40, green: 0.91, blue: 0.98),
        ringFill: Color.white.opacity(0.55),
        title: Color(red: 0.12, green: 0.23, blue: 0.54),
        body: Color(red: 0.20, green: 0.29, blue: 0.33),
        muted: Color(red: 0.39, green: 0.45, blue: 0.55),
        progress: Color(red: 0.51, green: 0.55, blue: 0.97),
        progressTrack: Color(red: 0.88, green: 0.91, blue: 1.0),
        statusText: Color(red: 0.26, green: 0.22, blue: 0.79),
        statusBackground: Color(red: 0.89, green: 0.92, blue: 1.0)
      )
    case "failed":
      return StepQuestPalette(
        backgroundTop: Color(red: 1.0, green: 0.96, blue: 0.93),
        backgroundBottom: Color(red: 0.99, green: 0.98, blue: 0.95),
        glowPrimary: Color(red: 0.98, green: 0.45, blue: 0.16),
        glowSecondary: Color(red: 0.97, green: 0.44, blue: 0.44),
        ringFill: Color.white.opacity(0.55),
        title: Color(red: 0.49, green: 0.18, blue: 0.07),
        body: Color(red: 0.60, green: 0.20, blue: 0.07),
        muted: Color(red: 0.63, green: 0.38, blue: 0.03),
        progress: Color(red: 0.98, green: 0.45, blue: 0.16),
        progressTrack: Color(red: 1.0, green: 0.93, blue: 0.84),
        statusText: Color(red: 0.73, green: 0.11, blue: 0.11),
        statusBackground: Color(red: 1.0, green: 0.89, blue: 0.89)
      )
    default:
      return StepQuestPalette(
        backgroundTop: Color(red: 0.92, green: 0.97, blue: 1.0),
        backgroundBottom: Color(red: 0.95, green: 0.99, blue: 1.0),
        glowPrimary: Color(red: 0.22, green: 0.74, blue: 0.97),
        glowSecondary: Color(red: 0.40, green: 0.91, blue: 0.98),
        ringFill: Color.white.opacity(0.55),
        title: Color(red: 0.12, green: 0.23, blue: 0.54),
        body: Color(red: 0.11, green: 0.31, blue: 0.85),
        muted: Color(red: 0.39, green: 0.45, blue: 0.55),
        progress: Color(red: 0.22, green: 0.74, blue: 0.97),
        progressTrack: Color(red: 0.86, green: 0.92, blue: 0.98),
        statusText: Color(red: 0.11, green: 0.31, blue: 0.85),
        statusBackground: Color(red: 0.86, green: 0.92, blue: 0.99)
      )
    }
  }

  private static func nightosphere(status: String) -> StepQuestPalette {
    switch status {
    case "completed":
      return StepQuestPalette(
        backgroundTop: Color(red: 0.14, green: 0.05, blue: 0.08),
        backgroundBottom: Color(red: 0.08, green: 0.02, blue: 0.05),
        glowPrimary: Color(red: 0.98, green: 0.45, blue: 0.09),
        glowSecondary: Color(red: 0.75, green: 0.52, blue: 0.99),
        ringFill: Color.white.opacity(0.78),
        title: Color(red: 1.0, green: 0.81, blue: 0.80),
        body: Color(red: 0.99, green: 0.65, blue: 0.65),
        muted: Color(red: 0.99, green: 0.73, blue: 0.45),
        progress: Color(red: 0.98, green: 0.45, blue: 0.09),
        progressTrack: Color(red: 0.29, green: 0.11, blue: 0.07),
        statusText: Color(red: 0.99, green: 0.89, blue: 0.54),
        statusBackground: Color(red: 0.34, green: 0.16, blue: 0.04)
      )
    case "claimed":
      return StepQuestPalette(
        backgroundTop: Color(red: 0.11, green: 0.03, blue: 0.16),
        backgroundBottom: Color(red: 0.05, green: 0.00, blue: 0.09),
        glowPrimary: Color(red: 0.75, green: 0.52, blue: 0.99),
        glowSecondary: Color(red: 0.98, green: 0.44, blue: 0.52),
        ringFill: Color.white.opacity(0.78),
        title: Color(red: 0.96, green: 0.82, blue: 0.99),
        body: Color(red: 0.91, green: 0.84, blue: 1.0),
        muted: Color(red: 0.77, green: 0.71, blue: 0.99),
        progress: Color(red: 0.75, green: 0.52, blue: 0.99),
        progressTrack: Color(red: 0.23, green: 0.07, blue: 0.31),
        statusText: Color(red: 0.91, green: 0.84, blue: 1.0),
        statusBackground: Color(red: 0.28, green: 0.11, blue: 0.39)
      )
    case "failed":
      return StepQuestPalette(
        backgroundTop: Color(red: 0.15, green: 0.03, blue: 0.07),
        backgroundBottom: Color(red: 0.08, green: 0.01, blue: 0.03),
        glowPrimary: Color(red: 0.94, green: 0.27, blue: 0.27),
        glowSecondary: Color(red: 0.98, green: 0.45, blue: 0.09),
        ringFill: Color.white.opacity(0.78),
        title: Color(red: 1.0, green: 0.81, blue: 0.80),
        body: Color(red: 0.99, green: 0.65, blue: 0.65),
        muted: Color(red: 0.99, green: 0.73, blue: 0.45),
        progress: Color(red: 0.94, green: 0.27, blue: 0.27),
        progressTrack: Color(red: 0.25, green: 0.04, blue: 0.07),
        statusText: Color(red: 0.99, green: 0.65, blue: 0.65),
        statusBackground: Color(red: 0.34, green: 0.07, blue: 0.10)
      )
    default:
      return StepQuestPalette(
        backgroundTop: Color(red: 0.10, green: 0.02, blue: 0.08),
        backgroundBottom: Color(red: 0.05, green: 0.00, blue: 0.06),
        glowPrimary: Color(red: 0.98, green: 0.44, blue: 0.52),
        glowSecondary: Color(red: 0.75, green: 0.52, blue: 0.99),
        ringFill: Color.white.opacity(0.78),
        title: Color(red: 0.96, green: 0.82, blue: 0.99),
        body: Color(red: 0.98, green: 0.81, blue: 0.91),
        muted: Color(red: 0.77, green: 0.71, blue: 0.99),
        progress: Color(red: 0.98, green: 0.44, blue: 0.52),
        progressTrack: Color(red: 0.20, green: 0.07, blue: 0.14),
        statusText: Color(red: 0.98, green: 0.66, blue: 0.83),
        statusBackground: Color(red: 0.28, green: 0.07, blue: 0.17)
      )
    }
  }
}

private struct StepQuestProvider: TimelineProvider {
  func placeholder(in context: Context) -> StepQuestEntry {
    StepQuestEntry(
      date: Date(),
      snapshot: StepQuestSnapshot(
        themeName: "candy",
        title: localized(en: "Walk 10,000 steps", fr: "Marcher 10 000 pas"),
        progress: 7421,
        target: 10_000,
        reward: 150,
        status: "active",
        recordedFor: currentLocalDateString(),
        deepLink: defaultDeepLink,
        updatedAt: ISO8601DateFormatter().string(from: Date()),
        progressLabel: "7,421 / 10,000",
        statusLabel: localized(en: "Progress", fr: "Progression"),
        subtitle: localized(en: "2,579 steps left", fr: "2 579 pas restants")
      ),
      themeName: "candy"
    )
  }

  func getSnapshot(in context: Context, completion: @escaping (StepQuestEntry) -> Void) {
    completion(loadEntry())
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<StepQuestEntry>) -> Void) {
    let now = Date()
    let entry = loadEntry(for: now)
    var entries = [entry]

    if let rolloverEntry = makeMidnightRolloverEntry(from: entry, after: now) {
      entries.append(rolloverEntry)
    }

    let refreshBaseDate = entries.last?.date ?? now
    let refreshDate = Calendar.current.date(byAdding: .minute, value: 15, to: refreshBaseDate)
      ?? refreshBaseDate.addingTimeInterval(900)
    completion(Timeline(entries: entries, policy: .after(refreshDate)))
  }

  private func loadEntry(for date: Date = Date()) -> StepQuestEntry {
    let defaults = UserDefaults(suiteName: appGroupId)
    let snapshotJson = defaults?.string(forKey: snapshotKey)
    let snapshot = snapshotJson
      .flatMap { $0.data(using: .utf8) }
      .flatMap { try? JSONDecoder().decode(StepQuestSnapshot.self, from: $0) }
      .map { normalizeSnapshot($0, for: formatLocalDate(date)) }

    let resolvedThemeName = normalizeThemeName(snapshot?.themeName) ?? loadStoredThemeName() ?? "candy"

    return StepQuestEntry(date: date, snapshot: snapshot, themeName: resolvedThemeName)
  }

  private func makeMidnightRolloverEntry(from entry: StepQuestEntry, after date: Date) -> StepQuestEntry? {
    guard let snapshot = entry.snapshot else {
      return nil
    }

    let nextMidnight = startOfNextLocalDay(after: date)
    let rolloverSnapshot = normalizeSnapshot(snapshot, for: formatLocalDate(nextMidnight))
    return StepQuestEntry(date: nextMidnight, snapshot: rolloverSnapshot, themeName: entry.themeName)
  }
}

private func normalizeSnapshotForToday(_ snapshot: StepQuestSnapshot) -> StepQuestSnapshot {
  normalizeSnapshot(snapshot, for: currentLocalDateString())
}

private func normalizeSnapshot(_ snapshot: StepQuestSnapshot, for localDateString: String) -> StepQuestSnapshot {
  guard snapshot.recordedFor != localDateString else {
    return snapshot
  }

  let target = max(snapshot.target, 1)
  let progressLabel = "0 / \(localizedNumber(target))"

  return StepQuestSnapshot(
    themeName: normalizeThemeName(snapshot.themeName) ?? "candy",
    title: snapshot.title,
    progress: 0,
    target: target,
    reward: snapshot.reward,
    status: "active",
    recordedFor: localDateString,
    deepLink: snapshot.deepLink,
    updatedAt: ISO8601DateFormatter().string(from: Date()),
    progressLabel: progressLabel,
    statusLabel: localized(en: "Progress", fr: "Progression"),
    subtitle: localized(
      en: "\(formatNumber(target)) steps left",
      fr: "\(formatNumber(target)) pas restants"
    )
  )
}

private func loadStoredThemeName() -> String? {
  let defaults = UserDefaults(suiteName: appGroupId)
  return normalizeThemeName(defaults?.string(forKey: themeNameKey))
}

private func loadStoredLocaleCode() -> String? {
  let defaults = UserDefaults(suiteName: appGroupId)
  return normalizeLocaleCode(defaults?.string(forKey: localeKey))
}

private func normalizeThemeName(_ themeName: String?) -> String? {
  switch themeName {
  case "candy", "ice", "nightosphere":
    return themeName
  default:
    return nil
  }
}

private func normalizeLocaleCode(_ localeCode: String?) -> String? {
  switch localeCode {
  case "en", "fr":
    return localeCode
  default:
    return nil
  }
}

private func currentLocalDateString() -> String {
  formatLocalDate(Date())
}

private func formatLocalDate(_ date: Date) -> String {
  let components = Calendar.current.dateComponents([.year, .month, .day], from: date)
  let year = components.year ?? 0
  let month = components.month ?? 0
  let day = components.day ?? 0
  return String(format: "%04d-%02d-%02d", year, month, day)
}

private func startOfNextLocalDay(after date: Date) -> Date {
  let startOfToday = Calendar.current.startOfDay(for: date)
  return Calendar.current.date(byAdding: .day, value: 1, to: startOfToday) ?? date.addingTimeInterval(86_400)
}

private func formatNumber(_ value: Int) -> String {
  let formatter = NumberFormatter()
  formatter.locale = widgetLocale()
  formatter.numberStyle = .decimal
  return formatter.string(from: NSNumber(value: value)) ?? "\(value)"
}

struct StepQuestWidget: Widget {
  var body: some WidgetConfiguration {
    makeConfiguration()
  }
}

private extension StepQuestWidget {
  func makeConfiguration() -> some WidgetConfiguration {
    let configuration = StaticConfiguration(kind: widgetKind, provider: StepQuestProvider()) { entry in
      StepQuestWidgetView(entry: entry)
    }
    .configurationDisplayName(localized(en: "Step Quest", fr: "Quête de pas"))
    .description(localized(en: "Follow your daily step quest progress.", fr: "Suis la progression de ta quête de pas."))
    .supportedFamilies([.systemSmall, .systemMedium])

    if #available(iOSApplicationExtension 17.0, *) {
      return configuration.contentMarginsDisabled()
    }

    return configuration
  }
}

private struct StepQuestWidgetView: View {
  @Environment(\.widgetFamily) private var family

  let entry: StepQuestEntry

  private var palette: StepQuestPalette {
    let themeName = entry.snapshot.flatMap { normalizeThemeName($0.themeName) } ?? entry.themeName
    return StepQuestPalette.forTheme(themeName, status: entry.snapshot?.status ?? "active")
  }

  var body: some View {
    Group {
      if #available(iOSApplicationExtension 17.0, *) {
        widgetContent
          .containerBackground(for: .widget) {
            StepQuestBackground(palette: palette)
          }
      } else {
        ZStack {
          StepQuestBackground(palette: palette)
          widgetContent
        }
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .clipShape(ContainerRelativeShape())
    .widgetURL(URL(string: entry.snapshot?.deepLink ?? defaultDeepLink))
  }

  @ViewBuilder
  private var widgetContent: some View {
    if let snapshot = entry.snapshot {
      if family == .systemSmall {
        StepQuestSmallLayout(snapshot: snapshot, palette: palette)
      } else {
        StepQuestMediumLayout(snapshot: snapshot, palette: palette)
      }
    } else {
      StepQuestFallbackLayout(palette: palette, family: family)
    }
  }
}

private struct StepQuestSmallLayout: View {
  let snapshot: StepQuestSnapshot
  let palette: StepQuestPalette

  private var progressRatio: Double {
    let total = Double(max(snapshot.target, 1))
    return min(max(Double(snapshot.progress) / total, 0), 1)
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      HStack(alignment: .center, spacing: 8) {
        WidgetBadge(text: localized(en: "STEP QUEST", fr: "QUÊTE"), palette: palette)
        Spacer(minLength: 8)
        RewardChip(reward: snapshot.reward, compact: true)
      }
      HStack(alignment: .center, spacing:0)
      {
        Spacer(minLength: 0)
      
        VStack(alignment: .center, spacing:5){
          Text(localized(en: "10 000 Steps", fr: "10 000 pas"))
            .font(.system(size: 16, weight: .heavy, design: .rounded))
            .foregroundStyle(palette.title)
            .lineLimit(1)
            .minimumScaleFactor(0.9)
          VStack(alignment: .center, spacing: 6) {
            StatusPill(text: statusHeadline(for: snapshot.status), palette: palette, compact: true)
            
            ProgressRing(
              progress: progressRatio,
              palette: palette,
              primaryLabel: percentText(for: snapshot),
              secondaryLabel: compactRingProgressLabel(for: snapshot)
            )
            .frame(width: 70, height: 70)
            
          }
        }
        Spacer(minLength: 0)

      }
    }
    .padding(.horizontal, 12)
    .padding(.vertical, 10)
  }
}

private struct StepQuestMediumLayout: View {
  let snapshot: StepQuestSnapshot
  let palette: StepQuestPalette

  private var progressRatio: Double {
    let total = Double(max(snapshot.target, 1))
    return min(max(Double(snapshot.progress) / total, 0), 1)
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      VStack(alignment: .leading, spacing: 4){
        HStack(alignment: .center, spacing: 10) {
          WidgetBadge(text: localized(en: "STEP QUEST", fr: "QUÊTE DE PAS"), palette: palette)
          Spacer(minLength: 6)
          StatusPill(text: statusHeadline(for: snapshot.status), palette: palette, compact: true)
          RewardChip(reward: snapshot.reward, compact: true)
        }
        
        Text(localized(en: "Walk 10,000 steps today", fr: "Marche 10 000 pas aujourd'hui"))
          .font(.system(size: 16, weight: .heavy, design: .rounded))
          .foregroundStyle(palette.title)
          .lineLimit(1)
          .minimumScaleFactor(0.8)
      }
      HStack(alignment: .bottom, spacing: 20) {
        ProgressRing(
          progress: progressRatio,
          palette: palette,
          primaryLabel: percentText(for: snapshot),
          secondaryLabel: nil
        )
        .frame(width: 68, height: 68)

        VStack(alignment: .leading, spacing: 4) {
          Text(snapshot.progressLabel)
            .font(.system(size: 12, weight: .bold, design: .rounded))
            .foregroundStyle(palette.title)
            .lineLimit(1)

          Text(progressFootnote(for: snapshot))
            .font(.system(size: 11, weight: .semibold, design: .rounded))
            .foregroundStyle(palette.muted)
            .lineLimit(2)
            .minimumScaleFactor(0.85)
        }.padding(.bottom, 6)

      }

    }
    .padding(.vertical, 15)
    .padding(.horizontal, 20)
  }
}

private struct StepQuestFallbackLayout: View {
  let palette: StepQuestPalette
  let family: WidgetFamily

  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      HStack(alignment: .top, spacing: 8) {
        WidgetBadge(text: localized(en: "DAILY STEPS", fr: "PAS DU JOUR"), palette: palette)
        Spacer(minLength: 8)
        CoinToken(size: family == .systemSmall ? 26 : 30)
      }

      Text(localized(en: "Step quest", fr: "Quête de pas"))
        .font(.system(size: family == .systemSmall ? 16 : 18, weight: .heavy, design: .rounded))
        .foregroundStyle(palette.title)
        .lineLimit(2)

      Text(localized(
        en: "Open the app to load today's progress.",
        fr: "Ouvre l'application pour charger la progression du jour."
      ))
      .font(.system(size: 12, weight: .semibold, design: .rounded))
      .foregroundStyle(palette.body)
      .lineLimit(family == .systemSmall ? 4 : 2)

      Spacer(minLength: 0)

      ProgressBar(progress: 0.24, palette: palette)
        .frame(height: family == .systemSmall ? 10 : 12)

      Text(localized(en: "Tap to sync your daily quest.", fr: "Ouvre l'app pour synchroniser ta quête."))
        .font(.system(size: 11, weight: .semibold, design: .rounded))
        .foregroundStyle(palette.muted)
        .lineLimit(1)
    }
    .padding(family == .systemSmall ? 14 : 16)
  }
}

private struct StepQuestBackground: View {
  let palette: StepQuestPalette

  var body: some View {
    GeometryReader { geometry in
      ZStack {
        LinearGradient(
          colors: [palette.backgroundTop, palette.backgroundBottom],
          startPoint: .topLeading,
          endPoint: .bottomTrailing
        )

        Circle()
          .fill(palette.glowPrimary.opacity(0.28))
          .frame(width: geometry.size.width * 0.60)
          .offset(x: geometry.size.width * 0.26, y: -geometry.size.height * 0.20)
          .blur(radius: 18)

        Circle()
          .fill(palette.glowSecondary.opacity(0.24))
          .frame(width: geometry.size.width * 0.50)
          .offset(x: -geometry.size.width * 0.22, y: geometry.size.height * 0.26)
          .blur(radius: 18)

        WidgetSparkle()
          .fill(.white.opacity(0.55))
          .frame(width: 14, height: 14)
          .offset(x: geometry.size.width * 0.28, y: -geometry.size.height * 0.20)

        WidgetSparkle()
          .fill(palette.glowSecondary.opacity(0.90))
          .frame(width: 10, height: 10)
          .offset(x: -geometry.size.width * 0.24, y: -geometry.size.height * 0.04)
      }
      .clipShape(ContainerRelativeShape())
    }
  }
}

private struct WidgetBadge: View {
  let text: String
  let palette: StepQuestPalette

  var body: some View {
    Text(text)
      .font(.system(size: 9, weight: .black, design: .rounded))
      .foregroundStyle(palette.title.opacity(0.88))
      .padding(.horizontal, 9)
      .padding(.vertical, 5)
      .background(
        Capsule(style: .continuous)
          .fill(Color.white.opacity(0.42))
      )
  }
}

private struct StatusPill: View {
  let text: String
  let palette: StepQuestPalette
  var compact: Bool = false

  var body: some View {
    Text(text)
      .font(.system(size: compact ? 10 : 11, weight: .bold, design: .rounded))
      .foregroundStyle(palette.statusText)
      .lineLimit(1)
      .minimumScaleFactor(0.85)
      .padding(.horizontal, compact ? 8 : 10)
      .padding(.vertical, compact ? 5 : 6)
      .background(
        Capsule(style: .continuous)
          .fill(palette.statusBackground.opacity(compact ? 0.86 : 1.0))
      )
  }
}

private struct RewardChip: View {
  let reward: Int
  var compact: Bool = false

  var body: some View {
    HStack(spacing: compact ? 4 : 6) {
      CoinToken(size: compact ? 18 : 22)
      Text(localizedNumber(reward))
        .font(.system(size: compact ? 11 : 12, weight: .black, design: .rounded))
        .foregroundStyle(Color(red: 0.54, green: 0.29, blue: 0.00))
        .lineLimit(1)
        .minimumScaleFactor(0.8)
    }
    .padding(.horizontal, compact ? 0 : 4)
  }
}

private struct ProgressRing: View {
  let progress: Double
  let palette: StepQuestPalette
  let primaryLabel: String
  let secondaryLabel: String?

  var body: some View {
    ZStack {
      Circle()
        .fill(palette.ringFill)

      Circle()
        .stroke(palette.progressTrack, style: StrokeStyle(lineWidth: 8, lineCap: .round))

      Circle()
        .trim(from: 0, to: progress)
        .stroke(
          AngularGradient(
            colors: [palette.progress, palette.glowSecondary, palette.progress],
            center: .center
          ),
          style: StrokeStyle(lineWidth: 8, lineCap: .round)
        )
        .rotationEffect(.degrees(-90))

      VStack(spacing: 1) {
        Text(primaryLabel)
          .font(.system(size: 16, weight: .black, design: .rounded))
          .foregroundStyle(palette.title)

        if let secondaryLabel, !secondaryLabel.isEmpty {
          Text(secondaryLabel.uppercased(with: widgetLocale()))
            .font(.system(size: 7, weight: .bold, design: .rounded))
            .foregroundStyle(palette.muted)
        }
      }
    }
  }
}

private struct ProgressBar: View {
  let progress: Double
  let palette: StepQuestPalette

  var body: some View {
    GeometryReader { geometry in
      ZStack(alignment: .leading) {
        Capsule(style: .continuous)
          .fill(Color.white.opacity(0.34))
          .overlay(
            Capsule(style: .continuous)
              .fill(palette.progressTrack)
              .opacity(0.95)
          )

        Capsule(style: .continuous)
          .fill(
            LinearGradient(
              colors: [palette.progress, palette.glowSecondary],
              startPoint: .leading,
              endPoint: .trailing
            )
          )
          .frame(width: max(geometry.size.width * progress, 10))
      }
    }
  }
}

private struct CoinToken: View {
  let size: CGFloat

  var body: some View {
    ZStack {
      Circle()
        .fill(
          LinearGradient(
            colors: [
              Color(red: 1.0, green: 0.89, blue: 0.49),
              Color(red: 0.96, green: 0.66, blue: 0.17),
              Color(red: 0.77, green: 0.42, blue: 0.04),
            ],
            startPoint: .top,
            endPoint: .bottom
          )
        )
        .overlay(
          Circle()
            .stroke(Color(red: 0.23, green: 0.13, blue: 0.03), lineWidth: size * 0.08)
        )

      Circle()
        .inset(by: size * 0.16)
        .fill(
          RadialGradient(
            colors: [
              Color(red: 1.0, green: 0.97, blue: 0.66),
              Color(red: 0.99, green: 0.84, blue: 0.35),
              Color(red: 0.93, green: 0.67, blue: 0.19),
            ],
            center: .topLeading,
            startRadius: 2,
            endRadius: size * 0.52
          )
        )
        .overlay(
          Circle()
            .inset(by: size * 0.16)
            .stroke(Color(red: 0.23, green: 0.13, blue: 0.03), lineWidth: size * 0.06)
        )

      HStack(spacing: size * 0.18) {
        Circle().fill(Color(red: 0.10, green: 0.07, blue: 0.03))
          .frame(width: size * 0.10, height: size * 0.10)
        Circle().fill(Color(red: 0.10, green: 0.07, blue: 0.03))
          .frame(width: size * 0.10, height: size * 0.10)
      }
      .offset(y: -size * 0.06)

      SmileShape()
        .stroke(Color(red: 0.10, green: 0.07, blue: 0.03), style: StrokeStyle(lineWidth: size * 0.08, lineCap: .round))
        .frame(width: size * 0.34, height: size * 0.18)
        .offset(y: size * 0.16)

      HStack(spacing: size * 0.40) {
        Circle().fill(Color(red: 1.0, green: 0.49, blue: 0.71).opacity(0.28))
          .frame(width: size * 0.16, height: size * 0.12)
        Circle().fill(Color(red: 1.0, green: 0.49, blue: 0.71).opacity(0.28))
          .frame(width: size * 0.16, height: size * 0.12)
      }
      .offset(y: size * 0.08)

      Ellipse()
        .fill(Color.white.opacity(0.52))
        .frame(width: size * 0.28, height: size * 0.42)
        .rotationEffect(.degrees(-28))
        .offset(x: -size * 0.18, y: -size * 0.18)
    }
    .frame(width: size, height: size)
    .shadow(color: Color.black.opacity(0.12), radius: size * 0.06, x: 0, y: size * 0.04)
  }
}

private struct SmileShape: Shape {
  func path(in rect: CGRect) -> Path {
    var path = Path()
    path.move(to: CGPoint(x: rect.minX, y: rect.minY + rect.height * 0.30))
    path.addCurve(
      to: CGPoint(x: rect.maxX, y: rect.minY + rect.height * 0.30),
      control1: CGPoint(x: rect.minX + rect.width * 0.28, y: rect.maxY),
      control2: CGPoint(x: rect.minX + rect.width * 0.72, y: rect.maxY)
    )
    return path
  }
}

private struct WidgetSparkle: Shape {
  func path(in rect: CGRect) -> Path {
    var path = Path()
    let center = CGPoint(x: rect.midX, y: rect.midY)
    let outer = min(rect.width, rect.height) / 2
    let inner = outer * 0.42
    var angle = -Double.pi / 2
    let step = Double.pi / 4

    path.move(to: CGPoint(
      x: center.x + CGFloat(cos(angle)) * outer,
      y: center.y + CGFloat(sin(angle)) * outer
    ))

    for index in 0..<8 {
      let radius = index.isMultiple(of: 2) ? inner : outer
      path.addLine(to: CGPoint(
        x: center.x + CGFloat(cos(angle + step / 2)) * radius,
        y: center.y + CGFloat(sin(angle + step / 2)) * radius
      ))
      angle += step
      path.addLine(to: CGPoint(
        x: center.x + CGFloat(cos(angle)) * outer,
        y: center.y + CGFloat(sin(angle)) * outer
      ))
    }

    path.closeSubpath()
    return path
  }
}

private func percentText(for snapshot: StepQuestSnapshot) -> String {
  let target = max(snapshot.target, 1)
  let percent = Int(round((Double(snapshot.progress) / Double(target)) * 100))
  return "\(min(max(percent, 0), 100))%"
}

private func compactSubtitle(for snapshot: StepQuestSnapshot) -> String {
  switch snapshot.status {
  case "completed":
    return localized(en: "Reward ready", fr: "Récompense prête")
  case "claimed":
    return localized(en: "Claimed today", fr: "Récupérée")
  case "failed":
    return localized(en: "Back tomorrow", fr: "Retour demain")
  default:
    return snapshot.subtitle
  }
}

private func fullProgressLabel(for snapshot: StepQuestSnapshot) -> String {
  "\(localizedNumber(snapshot.progress)) / \(localizedNumber(snapshot.target))"
}

private func compactRingProgressLabel(for snapshot: StepQuestSnapshot) -> String {
  "\(abbreviatedStepCount(snapshot.progress)) / \(abbreviatedStepCount(snapshot.target))"
}

private func abbreviatedStepCount(_ value: Int) -> String {
  if value >= 10_000 {
    let rounded = Double(value) / 1_000
    if value % 1_000 == 0 {
      return "\(Int(rounded))K"
    }

    return "\(trimmedSingleDecimal(rounded))K"
  }

  if value >= 1_000 {
    let rounded = Double(value) / 1_000
    return "\(trimmedSingleDecimal(rounded))K"
  }

  return localizedNumber(value)
}

private func trimmedSingleDecimal(_ value: Double) -> String {
  let rounded = (value * 10).rounded() / 10

  if rounded == floor(rounded) {
    return String(Int(rounded))
  }

  return String(format: "%.1f", rounded)
}

private func progressFootnote(for snapshot: StepQuestSnapshot) -> String {
  switch snapshot.status {
  case "completed":
    return localized(en: "Reward is ready to claim.", fr: "La récompense est prête.")
  case "claimed":
    return localized(en: "You already grabbed today's reward.", fr: "Récompense déjà récupérée.")
  case "failed":
    return localized(en: "A fresh quest will appear tomorrow.", fr: "Nouvelle quête demain.")
  default:
    return localized(
      en: "Keep walking to finish today's quest.",
      fr: "Continue à marcher pour terminer la quête du jour."
    )
  }
}

private func statusHeadline(for status: String) -> String {
  switch status {
  case "completed":
    return localized(en: "Claim now", fr: "À réclamer")
  case "claimed":
    return localized(en: "Claimed", fr: "Récupérée")
  case "failed":
    return localized(en: "Tomorrow", fr: "Demain")
  default:
    return localized(en: "On track", fr: "En cours")
  }
}

private func localizedNumber(_ value: Int) -> String {
  formatNumber(value)
}

private func localized(en: String, fr: String) -> String {
  widgetLocaleCode() == "fr" ? fr : en
}

private func widgetLocaleCode() -> String {
  loadStoredLocaleCode() ?? "en"
}

private func widgetLocale() -> Locale {
  Locale(identifier: widgetLocaleCode())
}
