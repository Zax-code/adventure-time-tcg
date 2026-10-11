import SwiftUI
import WidgetKit

private let appGroupId = "group.love.leaetzak.adventuretime"
private let snapshotKey = "stepQuestWidgetSnapshot"
private let widgetKind = "StepQuestWidget"
private let defaultDeepLink = "adventure-time://quests?focus=steps"
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

// Theme tokens mirrored from packages/theme/src/index.ts (THEME_COLORS).
// Keep these values aligned with that file when the app tokens change.
private struct StepQuestTokens {
  let fg: Color
  let fgMuted: Color
  let bg: Color
  let surface: Color
  let surfaceMuted: Color
  let primary: Color
  let primaryText: Color
  let primaryBorder: Color
  let primaryTint: Color
  let secondaryText: Color
  let secondaryTint: Color
  let secondaryBorder: Color
  let success: Color
  let successText: Color
  let successTint: Color
  let successBorder: Color

  static func forTheme(_ themeName: String) -> StepQuestTokens {
    switch themeName {
    case "ice":
      return .ice
    case "nightosphere":
      return .nightosphere
    default:
      return .candy
    }
  }

  static let candy = StepQuestTokens(
    fg: Color(hex: 0x4A3728),
    fgMuted: Color(hex: 0x6B7280),
    bg: Color(hex: 0xFFF0F5),
    surface: Color(hex: 0xFFFFFF, alpha: 0.96),
    surfaceMuted: Color(hex: 0xFFFFFF, alpha: 0.9),
    primary: Color(hex: 0xF472B6),
    primaryText: Color(hex: 0xDB2777),
    primaryBorder: Color(hex: 0xF9A8D4),
    primaryTint: Color(hex: 0xFCE7F3),
    secondaryText: Color(hex: 0x894B00),
    secondaryTint: Color(hex: 0xFEF9C3),
    secondaryBorder: Color(hex: 0xFEF08A),
    success: Color(hex: 0x2DD4BF),
    successText: Color(hex: 0x005F5A),
    successTint: Color(hex: 0xCCFBF1),
    successBorder: Color(hex: 0x96F7E4)
  )

  static let ice = StepQuestTokens(
    fg: Color(hex: 0x1F2937),
    fgMuted: Color(hex: 0x6B7280),
    bg: Color(hex: 0xF0F7FF),
    surface: Color(hex: 0xFFFFFF, alpha: 0.98),
    surfaceMuted: Color(red: 240 / 255, green: 247 / 255, blue: 1, opacity: 0.95),
    primary: Color(hex: 0x60A5FA),
    primaryText: Color(hex: 0x1D4ED8),
    primaryBorder: Color(hex: 0xBFDBFE),
    primaryTint: Color(hex: 0xDBEAFE),
    secondaryText: Color(hex: 0x0E7490),
    secondaryTint: Color(hex: 0xCFFAFE),
    secondaryBorder: Color(hex: 0xA5F3FC),
    success: Color(hex: 0x34D399),
    successText: Color(hex: 0x065F46),
    successTint: Color(hex: 0xD1FAE5),
    successBorder: Color(hex: 0x6EE7B7)
  )

  static let nightosphere = StepQuestTokens(
    fg: Color(hex: 0xF0C0C0),
    fgMuted: Color(hex: 0x9CA3AF),
    bg: Color(hex: 0x0D0010),
    surface: Color(hex: 0x1A0B15),
    surfaceMuted: Color(hex: 0x120813),
    primary: Color(hex: 0xEF4444),
    primaryText: Color(hex: 0xFCA5A5),
    primaryBorder: Color(hex: 0x7F1D1D),
    primaryTint: Color(hex: 0x2D0F0F),
    secondaryText: Color(hex: 0xFDBA74),
    secondaryTint: Color(hex: 0x1C0D05),
    secondaryBorder: Color(hex: 0x7C2D12),
    success: Color(hex: 0x34D399),
    successText: Color(hex: 0x6EE7B7),
    successTint: Color(hex: 0x022C22),
    successBorder: Color(hex: 0x064E3B)
  )
}

private extension Color {
  init(hex: UInt32, alpha: Double = 1) {
    self.init(
      red: Double((hex >> 16) & 0xFF) / 255,
      green: Double((hex >> 8) & 0xFF) / 255,
      blue: Double(hex & 0xFF) / 255,
      opacity: alpha
    )
  }
}

private struct ChipStyle {
  let background: Color
  let border: Color
  let foreground: Color
}

/// Visual state of the widget, derived from the snapshot status
/// (`active`, `completed`, `claimed`, `failed`) plus the not-synced fallback.
private struct StepQuestStyle {
  let background: Color
  let tile: ChipStyle
  let status: ChipStyle
  let reward: ChipStyle
  let barTrack: Color
  let barFill: Color
  let statusIcon: LucideIcon
  let tokens: StepQuestTokens

  static func make(themeName: String, status: String?) -> StepQuestStyle {
    let t = StepQuestTokens.forTheme(themeName)
    let primaryChip = ChipStyle(background: t.primaryTint, border: t.primaryBorder, foreground: t.primaryText)
    let reward = ChipStyle(background: t.secondaryTint, border: t.secondaryBorder, foreground: t.secondaryText)

    func style(
      background: Color,
      tile: ChipStyle,
      status: ChipStyle,
      fill: Color,
      icon: LucideIcon
    ) -> StepQuestStyle {
      StepQuestStyle(
        background: background,
        tile: tile,
        status: status,
        reward: reward,
        barTrack: t.surface,
        barFill: fill,
        statusIcon: icon,
        tokens: t
      )
    }

    switch status {
    case "completed":
      return style(
        background: t.successTint,
        tile: ChipStyle(background: t.surface, border: t.successBorder, foreground: t.successText),
        status: ChipStyle(background: t.successTint, border: t.successBorder, foreground: t.successText),
        fill: t.success,
        icon: .gift
      )
    case "claimed":
      return style(
        background: t.bg,
        tile: ChipStyle(background: t.surfaceMuted, border: t.primaryBorder, foreground: t.fgMuted),
        status: ChipStyle(background: t.surface, border: t.primaryBorder, foreground: t.fgMuted),
        fill: t.success,
        icon: .check
      )
    case "failed":
      return style(
        background: t.surfaceMuted,
        tile: ChipStyle(background: t.surfaceMuted, border: t.primaryBorder, foreground: t.fgMuted),
        status: ChipStyle(background: t.surface, border: t.primaryBorder, foreground: t.fgMuted),
        fill: t.fgMuted,
        icon: .moon
      )
    default:
      return style(
        background: t.bg,
        tile: primaryChip,
        status: primaryChip,
        fill: t.primary,
        icon: .footprints
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
        reward: 75,
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

    let refreshDate = Calendar.current.date(byAdding: .minute, value: 15, to: now)
      ?? now.addingTimeInterval(900)
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
  guard let raw = themeName?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(), !raw.isEmpty else {
    return nil
  }

  switch raw {
  case "candy", "ice", "nightosphere":
    return raw
  default:
    // Map legacy or unknown theme names to the closest current theme.
    if raw.contains("night") || raw.contains("dark") || raw.contains("marceline") {
      return "nightosphere"
    }
    if raw.contains("ice") || raw.contains("frost") || raw.contains("snow") || raw.contains("blue") {
      return "ice"
    }
    return "candy"
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

  private var style: StepQuestStyle {
    let themeName = entry.snapshot.flatMap { normalizeThemeName($0.themeName) } ?? entry.themeName
    return StepQuestStyle.make(themeName: themeName, status: entry.snapshot?.status)
  }

  var body: some View {
    let style = self.style

    Group {
      if #available(iOSApplicationExtension 17.0, *) {
        widgetContent(style: style)
          .containerBackground(for: .widget) {
            style.background
          }
      } else {
        ZStack {
          style.background
          widgetContent(style: style)
        }
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .widgetURL(URL(string: entry.snapshot?.deepLink ?? defaultDeepLink))
  }

  @ViewBuilder
  private func widgetContent(style: StepQuestStyle) -> some View {
    if let snapshot = entry.snapshot {
      if family == .systemSmall {
        StepQuestSmallLayout(snapshot: snapshot, style: style)
      } else {
        StepQuestMediumLayout(snapshot: snapshot, style: style)
      }
    } else {
      StepQuestFallbackLayout(style: style, family: family)
    }
  }
}

private struct StepQuestSmallLayout: View {
  let snapshot: StepQuestSnapshot
  let style: StepQuestStyle

  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      HStack(alignment: .center, spacing: 8) {
        IconTile(style: style.tile)
        Spacer(minLength: 0)
        RewardChip(reward: snapshot.reward, style: style.reward)
      }
      Spacer(minLength: 6)
      StepCount(snapshot: snapshot, tokens: style.tokens)
      Spacer(minLength: 6)
      ProgressBar(progress: progressRatio(for: snapshot), style: style)
      Spacer(minLength: 6)
      StatusChip(text: statusLabel(for: snapshot), icon: style.statusIcon, style: style.status)
    }
    .padding(14)
  }
}

private struct StepQuestMediumLayout: View {
  let snapshot: StepQuestSnapshot
  let style: StepQuestStyle

  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      HStack(alignment: .center, spacing: 10) {
        IconTile(style: style.tile)
        Text(questTitle(for: snapshot))
          .font(.system(size: 15, weight: .heavy, design: .rounded))
          .foregroundStyle(style.tokens.fg)
          .lineLimit(1)
          .minimumScaleFactor(0.8)
          .frame(maxWidth: .infinity, alignment: .leading)
        RewardChip(reward: snapshot.reward, style: style.reward)
      }
      Spacer(minLength: 8)
      HStack(alignment: .bottom, spacing: 10) {
        StepCount(snapshot: snapshot, tokens: style.tokens)
        Spacer(minLength: 0)
        StatusChip(text: statusLabel(for: snapshot), icon: style.statusIcon, style: style.status)
      }
      Spacer(minLength: 8)
      ProgressBar(progress: progressRatio(for: snapshot), style: style)
      Spacer(minLength: 8)
      Text(footnote(for: snapshot))
        .font(.system(size: 12, weight: .semibold, design: .rounded))
        .foregroundStyle(style.tokens.fgMuted)
        .lineLimit(1)
        .minimumScaleFactor(0.85)
    }
    .padding(16)
  }
}

private struct StepQuestFallbackLayout: View {
  let style: StepQuestStyle
  let family: WidgetFamily

  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      IconTile(style: style.tile)
      Spacer(minLength: 8)
      VStack(alignment: .leading, spacing: 2) {
        Text(localized(en: "Step quest", fr: "Quête de pas"))
          .font(.system(size: 17, weight: .heavy, design: .rounded))
          .foregroundStyle(style.tokens.fg)
          .lineLimit(1)
        Text(localized(
          en: "Open the app to sync today's steps.",
          fr: "Ouvre l'app pour synchroniser tes pas du jour."
        ))
        .font(.system(size: 12, weight: .semibold, design: .rounded))
        .foregroundStyle(style.tokens.fgMuted)
        .lineLimit(family == .systemSmall ? 3 : 2)
        .fixedSize(horizontal: false, vertical: true)
      }
      Spacer(minLength: 8)
      ProgressBar(progress: 0, style: style)
    }
    .padding(family == .systemSmall ? 14 : 16)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
  }
}

private struct StepCount: View {
  let snapshot: StepQuestSnapshot
  let tokens: StepQuestTokens

  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      Text(formatNumber(max(snapshot.progress, 0)))
        .font(.system(size: 28, weight: .heavy, design: .rounded))
        .foregroundStyle(tokens.fg)
        .lineLimit(1)
        .minimumScaleFactor(0.7)
      Text(localized(
        en: "of \(formatNumber(max(snapshot.target, 1))) steps",
        fr: "sur \(formatNumber(max(snapshot.target, 1))) pas"
      ))
      .font(.system(size: 12, weight: .semibold, design: .rounded))
      .foregroundStyle(tokens.fgMuted)
      .lineLimit(1)
    }
  }
}

private struct IconTile: View {
  let style: ChipStyle

  var body: some View {
    LucideIconView(icon: .footprints, size: 18, color: style.foreground)
      .frame(width: 32, height: 32)
      .background(Circle().fill(style.background))
      .overlay(Circle().strokeBorder(style.border, lineWidth: 1))
  }
}

private struct ChipView: View {
  let text: String
  let icon: LucideIcon
  let style: ChipStyle

  var body: some View {
    HStack(spacing: 6) {
      LucideIconView(icon: icon, size: 14, color: style.foreground)
      Text(text)
        .font(.system(size: 12, weight: .bold, design: .rounded))
        .foregroundStyle(style.foreground)
        .lineLimit(1)
        .minimumScaleFactor(0.8)
    }
    .padding(.horizontal, 12)
    .frame(height: 28)
    .background(Capsule(style: .continuous).fill(style.background))
    .overlay(Capsule(style: .continuous).strokeBorder(style.border, lineWidth: 1))
  }
}

private struct RewardChip: View {
  let reward: Int
  let style: ChipStyle

  var body: some View {
    ChipView(text: formatNumber(reward), icon: .coins, style: style)
      .fixedSize()
  }
}

private struct StatusChip: View {
  let text: String
  let icon: LucideIcon
  let style: ChipStyle

  var body: some View {
    ChipView(text: text, icon: icon, style: style)
  }
}

private struct ProgressBar: View {
  let progress: Double
  let style: StepQuestStyle

  var body: some View {
    GeometryReader { geometry in
      ZStack(alignment: .leading) {
        Capsule(style: .continuous)
          .fill(style.barTrack)

        if progress > 0 {
          Capsule(style: .continuous)
            .fill(style.barFill)
            .frame(width: max(geometry.size.width * min(progress, 1), geometry.size.height))
        }
      }
    }
    .frame(height: 8)
  }
}

// MARK: - Lucide icons (stroke paths copied from lucide-react-native, 24x24 viewBox)

private enum LucideIcon {
  case footprints
  case coins
  case gift
  case check
  case moon

  var paths: [String] {
    switch self {
    case .footprints:
      return [
        "M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z",
        "M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z",
        "M16 17h4",
        "M4 13h4",
      ]
    case .coins:
      return [
        "M13.744 17.736a6 6 0 1 1-7.48-7.48",
        "M15 6h1v4",
        "m6.134 14.768.866-.5 2 3.464",
        "M10 8a6 6 0 1 0 12 0a6 6 0 1 0-12 0Z",
      ]
    case .gift:
      return [
        "M12 7v14",
        "M20 11v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8",
        "M7.5 7a1 1 0 0 1 0-5A4.8 8 0 0 1 12 7a4.8 8 0 0 1 4.5-5 1 1 0 0 1 0 5",
        "M4 7h16a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z",
      ]
    case .check:
      return ["M20 6 9 17l-5-5"]
    case .moon:
      return [
        "M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401",
      ]
    }
  }
}

private struct LucideShape: Shape {
  let icon: LucideIcon

  func path(in rect: CGRect) -> Path {
    var combined = Path()
    for data in icon.paths {
      combined.addPath(SVGPathParser.parse(data))
    }
    let scale = min(rect.width, rect.height) / 24
    return combined.applying(
      CGAffineTransform(translationX: rect.minX, y: rect.minY).scaledBy(x: scale, y: scale)
    )
  }
}

private struct LucideIconView: View {
  let icon: LucideIcon
  let size: CGFloat
  let color: Color

  var body: some View {
    LucideShape(icon: icon)
      .stroke(color, style: StrokeStyle(lineWidth: 2 * size / 24, lineCap: .round, lineJoin: .round))
      .frame(width: size, height: size)
  }
}

/// Minimal SVG path-data parser (M, L, H, V, C, S, A, Z and their relative forms),
/// enough for the Lucide icons above.
private enum SVGPathParser {
  static func parse(_ data: String) -> Path {
    var path = Path()
    var scanner = Tokenizer(data)
    var command: Character = "M"
    var current = CGPoint.zero
    var start = CGPoint.zero
    var lastControl: CGPoint?

    while let next = scanner.nextCommandOrNumber() {
      if case .command(let c) = next {
        command = c
        if c == "Z" || c == "z" {
          path.closeSubpath()
          current = start
          lastControl = nil
          continue
        }
      } else {
        scanner.pushBack()
      }

      let relative = command.isLowercase
      let base = relative ? current : .zero

      switch command.uppercased().first! {
      case "M":
        let point = scanner.point(offset: base)
        path.move(to: point)
        current = point
        start = point
        lastControl = nil
        command = relative ? "l" : "L"
      case "L":
        let point = scanner.point(offset: base)
        path.addLine(to: point)
        current = point
        lastControl = nil
      case "H":
        let x = scanner.number() + (relative ? current.x : 0)
        current = CGPoint(x: x, y: current.y)
        path.addLine(to: current)
        lastControl = nil
      case "V":
        let y = scanner.number() + (relative ? current.y : 0)
        current = CGPoint(x: current.x, y: y)
        path.addLine(to: current)
        lastControl = nil
      case "C":
        let c1 = scanner.point(offset: base)
        let c2 = scanner.point(offset: base)
        let end = scanner.point(offset: base)
        path.addCurve(to: end, control1: c1, control2: c2)
        lastControl = c2
        current = end
      case "S":
        let c1 = lastControl.map { CGPoint(x: 2 * current.x - $0.x, y: 2 * current.y - $0.y) } ?? current
        let c2 = scanner.point(offset: base)
        let end = scanner.point(offset: base)
        path.addCurve(to: end, control1: c1, control2: c2)
        lastControl = c2
        current = end
      case "A":
        let rx = scanner.number()
        let ry = scanner.number()
        let rotation = scanner.number()
        let largeArc = scanner.flag()
        let sweep = scanner.flag()
        let end = scanner.point(offset: base)
        addArc(to: &path, from: current, to: end, rx: rx, ry: ry, rotation: rotation, largeArc: largeArc, sweep: sweep)
        current = end
        lastControl = nil
      default:
        return path
      }
    }

    return path
  }

  // SVG endpoint arc -> center parameterization (SVG 1.1 F.6.5), approximated with cubic curves.
  private static func addArc(
    to path: inout Path,
    from p0: CGPoint,
    to p1: CGPoint,
    rx rxIn: CGFloat,
    ry ryIn: CGFloat,
    rotation: CGFloat,
    largeArc: Bool,
    sweep: Bool
  ) {
    var rx = abs(rxIn)
    var ry = abs(ryIn)
    if rx == 0 || ry == 0 || p0 == p1 {
      path.addLine(to: p1)
      return
    }

    let phi = rotation * .pi / 180
    let cosPhi = cos(phi)
    let sinPhi = sin(phi)
    let dx = (p0.x - p1.x) / 2
    let dy = (p0.y - p1.y) / 2
    let x1p = cosPhi * dx + sinPhi * dy
    let y1p = -sinPhi * dx + cosPhi * dy

    let lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry)
    if lambda > 1 {
      rx *= sqrt(lambda)
      ry *= sqrt(lambda)
    }

    let numerator = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p
    let denominator = rx * rx * y1p * y1p + ry * ry * x1p * x1p
    var coefficient = sqrt(max(numerator / denominator, 0))
    if largeArc == sweep {
      coefficient = -coefficient
    }
    let cxp = coefficient * rx * y1p / ry
    let cyp = -coefficient * ry * x1p / rx
    let cx = cosPhi * cxp - sinPhi * cyp + (p0.x + p1.x) / 2
    let cy = sinPhi * cxp + cosPhi * cyp + (p0.y + p1.y) / 2

    func angle(_ ux: CGFloat, _ uy: CGFloat, _ vx: CGFloat, _ vy: CGFloat) -> CGFloat {
      let sign: CGFloat = ux * vy - uy * vx < 0 ? -1 : 1
      let dot = ux * vx + uy * vy
      let length = sqrt(ux * ux + uy * uy) * sqrt(vx * vx + vy * vy)
      return sign * acos(min(max(dot / length, -1), 1))
    }

    let theta1 = angle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry)
    var deltaTheta = angle((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry)
    if !sweep && deltaTheta > 0 {
      deltaTheta -= 2 * .pi
    } else if sweep && deltaTheta < 0 {
      deltaTheta += 2 * .pi
    }

    let segments = max(Int(ceil(abs(deltaTheta) / (.pi / 2))), 1)
    let step = deltaTheta / CGFloat(segments)
    let t = 4 / 3 * tan(step / 4)

    func point(_ theta: CGFloat) -> CGPoint {
      let x = rx * cos(theta)
      let y = ry * sin(theta)
      return CGPoint(x: cx + cosPhi * x - sinPhi * y, y: cy + sinPhi * x + cosPhi * y)
    }

    func derivative(_ theta: CGFloat) -> CGPoint {
      let x = -rx * sin(theta)
      let y = ry * cos(theta)
      return CGPoint(x: cosPhi * x - sinPhi * y, y: sinPhi * x + cosPhi * y)
    }

    var theta = theta1
    for index in 0..<segments {
      let next = theta + step
      let start = point(theta)
      let end = index == segments - 1 ? p1 : point(next)
      let d1 = derivative(theta)
      let d2 = derivative(next)
      path.addCurve(
        to: end,
        control1: CGPoint(x: start.x + t * d1.x, y: start.y + t * d1.y),
        control2: CGPoint(x: end.x - t * d2.x, y: end.y - t * d2.y)
      )
      theta = next
    }
  }

  private enum Token {
    case command(Character)
    case number(CGFloat)
  }

  private struct Tokenizer {
    private let chars: [Character]
    private var index = 0
    private var previousIndex = 0

    init(_ data: String) {
      chars = Array(data)
    }

    mutating func pushBack() {
      index = previousIndex
    }

    private mutating func skipSeparators() {
      while index < chars.count, chars[index] == " " || chars[index] == "," || chars[index] == "\n" {
        index += 1
      }
    }

    mutating func nextCommandOrNumber() -> Token? {
      skipSeparators()
      previousIndex = index
      guard index < chars.count else { return nil }
      let c = chars[index]
      if c.isLetter && c != "e" && c != "E" {
        index += 1
        return .command(c)
      }
      return .number(number())
    }

    mutating func flag() -> Bool {
      skipSeparators()
      guard index < chars.count else { return false }
      let value = chars[index] == "1"
      index += 1
      return value
    }

    mutating func point(offset: CGPoint) -> CGPoint {
      let x = number()
      let y = number()
      return CGPoint(x: x + offset.x, y: y + offset.y)
    }

    mutating func number() -> CGFloat {
      skipSeparators()
      var text = ""
      var seenDot = false
      var seenExponent = false
      while index < chars.count {
        let c = chars[index]
        if c == "-" || c == "+" {
          if !text.isEmpty && !(text.last == "e" || text.last == "E") { break }
        } else if c == "." {
          if seenDot || seenExponent { break }
          seenDot = true
        } else if c == "e" || c == "E" {
          if seenExponent { break }
          seenExponent = true
        } else if !c.isNumber {
          break
        }
        text.append(c)
        index += 1
      }
      return CGFloat(Double(text) ?? 0)
    }
  }
}

// MARK: - Copy

private func progressRatio(for snapshot: StepQuestSnapshot) -> Double {
  let total = Double(max(snapshot.target, 1))
  return min(max(Double(snapshot.progress) / total, 0), 1)
}

private func percentValue(for snapshot: StepQuestSnapshot) -> Int {
  Int((progressRatio(for: snapshot) * 100).rounded())
}

private func questTitle(for snapshot: StepQuestSnapshot) -> String {
  let title = snapshot.title.trimmingCharacters(in: .whitespacesAndNewlines)
  return title.isEmpty ? localized(en: "Walk 10,000 steps", fr: "Marcher 10 000 pas") : title
}

private func statusLabel(for snapshot: StepQuestSnapshot) -> String {
  switch snapshot.status {
  case "completed":
    return localized(en: "Reward ready", fr: "Récompense prête")
  case "claimed":
    return localized(en: "Claimed today", fr: "Récupérée aujourd'hui")
  case "failed":
    return localized(en: "Back tomorrow", fr: "Retour demain")
  default:
    let percent = percentValue(for: snapshot)
    return localized(en: "On track · \(percent)%", fr: "En bonne voie · \(percent) %")
  }
}

private func footnote(for snapshot: StepQuestSnapshot) -> String {
  switch snapshot.status {
  case "completed":
    let reward = formatNumber(snapshot.reward)
    return localized(en: "Tap to claim your \(reward) coins", fr: "Touche pour récupérer tes \(reward) pièces")
  case "claimed":
    return localized(en: "Nice walk. See you tomorrow.", fr: "Belle marche. À demain !")
  case "failed":
    return localized(en: "A fresh quest starts at midnight", fr: "Une nouvelle quête commence à minuit")
  default:
    let remaining = formatNumber(max(snapshot.target - snapshot.progress, 0))
    return localized(en: "\(remaining) steps to go", fr: "Encore \(remaining) pas")
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

#if DEBUG
private func previewEntry(themeName: String, status: String?, progress: Int) -> StepQuestEntry {
  let snapshot = status.map { status in
    StepQuestSnapshot(
      themeName: themeName,
      title: "Walk 10,000 steps",
      progress: progress,
      target: 10_000,
      reward: 75,
      status: status,
      recordedFor: currentLocalDateString(),
      deepLink: defaultDeepLink,
      updatedAt: nil,
      progressLabel: "",
      statusLabel: "",
      subtitle: ""
    )
  }
  return StepQuestEntry(date: Date(), snapshot: snapshot, themeName: themeName)
}

private let previewStates: [(String?, Int)] = [
  ("active", 6_240),
  ("completed", 10_412),
  ("claimed", 10_412),
  ("failed", 4_980),
  (nil, 0),
]

struct StepQuestWidget_Previews: PreviewProvider {
  static var previews: some View {
    Group {
      ForEach(["candy", "nightosphere", "ice"], id: \.self) { theme in
        ForEach(previewStates.indices, id: \.self) { index in
          let state = previewStates[index]
          StepQuestWidgetView(entry: previewEntry(themeName: theme, status: state.0, progress: state.1))
            .previewContext(WidgetPreviewContext(family: .systemSmall))
            .previewDisplayName("\(theme) small \(state.0 ?? "not synced")")
          StepQuestWidgetView(entry: previewEntry(themeName: theme, status: state.0, progress: state.1))
            .previewContext(WidgetPreviewContext(family: .systemMedium))
            .previewDisplayName("\(theme) medium \(state.0 ?? "not synced")")
        }
      }
    }
  }
}
#endif
