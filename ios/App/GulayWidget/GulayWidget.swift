import WidgetKit
import SwiftUI

// Must match WidgetBridgePlugin.appGroupId on the app side.
let widgetAppGroupId = "group.com.deniz.gulaywardrobe"

struct PlanEntry: TimelineEntry {
    let date: Date
    let outfitName: String
    let note: String
    let briefing: String
    let hasPlan: Bool
}

struct GulayTimelineProvider: TimelineProvider {
    func placeholder(in context: Context) -> PlanEntry {
        PlanEntry(date: Date(), outfitName: "Golden hour mood", note: "", briefing: "Have a beautiful day, Gülay", hasPlan: true)
    }

    func getSnapshot(in context: Context, completion: @escaping (PlanEntry) -> Void) {
        completion(readTodayEntry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<PlanEntry>) -> Void) {
        let entry = readTodayEntry()
        let calendar = Calendar.current
        let nextMidnight = calendar.nextDate(after: Date(), matching: DateComponents(hour: 0, minute: 1), matchingPolicy: .nextTime) ?? Date().addingTimeInterval(3600)
        // Reloads automatically at the next midnight; the app also forces an
        // immediate reload via WidgetCenter whenever the plan changes.
        completion(Timeline(entries: [entry], policy: .after(nextMidnight)))
    }

    private func readTodayEntry() -> PlanEntry {
        let defaults = UserDefaults(suiteName: widgetAppGroupId)
        guard let plan = defaults?.dictionary(forKey: "todayPlan") else {
            return PlanEntry(date: Date(), outfitName: "", note: "", briefing: "", hasPlan: false)
        }
        let planDate = plan["date"] as? String ?? ""
        let todayStr = isoToday()
        // Stale data from a previous day (app hasn't been opened yet today) → show empty state.
        guard planDate == todayStr else {
            return PlanEntry(date: Date(), outfitName: "", note: "", briefing: "", hasPlan: false)
        }
        let outfitName = plan["outfitName"] as? String ?? ""
        let note = plan["note"] as? String ?? ""
        let briefing = plan["briefing"] as? String ?? ""
        return PlanEntry(date: Date(), outfitName: outfitName, note: note, briefing: briefing, hasPlan: !outfitName.isEmpty || !note.isEmpty)
    }

    private func isoToday() -> String {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.timeZone = .current
        return f.string(from: Date())
    }
}

struct GulayWidgetView: View {
    var entry: PlanEntry
    @Environment(\.widgetFamily) var family

    var body: some View {
        ZStack {
            LinearGradient(colors: [Color(red: 0.98, green: 0.96, blue: 0.94), Color(red: 0.95, green: 0.86, blue: 0.85)],
                            startPoint: .topLeading, endPoint: .bottomTrailing)
            VStack(alignment: .leading, spacing: 6) {
                Text("GÜLAY'S WARDROBE")
                    .font(.system(size: 10, weight: .semibold))
                    .tracking(1.2)
                    .foregroundColor(Color(red: 0.66, green: 0.42, blue: 0.47))
                if entry.hasPlan {
                    if !entry.outfitName.isEmpty {
                        Text(entry.outfitName)
                            .font(.system(size: family == .systemSmall ? 15 : 17, weight: .bold, design: .serif))
                            .foregroundColor(Color(red: 0.26, green: 0.19, blue: 0.23))
                            .lineLimit(2)
                    }
                    let detail = entry.briefing.isEmpty ? entry.note : entry.briefing
                    if !detail.isEmpty {
                        Text(detail)
                            .font(.system(size: 12))
                            .foregroundColor(Color(red: 0.49, green: 0.40, blue: 0.44))
                            .lineLimit(family == .systemSmall ? 3 : 4)
                    }
                } else {
                    Spacer()
                    Text("Nothing planned yet")
                        .font(.system(size: 14, weight: .semibold, design: .serif))
                        .foregroundColor(Color(red: 0.26, green: 0.19, blue: 0.23))
                    Text("Tap to plan today's look")
                        .font(.system(size: 12))
                        .foregroundColor(Color(red: 0.49, green: 0.40, blue: 0.44))
                }
                Spacer()
            }
            .padding(14)
        }
        .widgetURL(URL(string: "gulaywardrobe://planner"))
    }
}

struct GulayWidget: Widget {
    let kind = "GulayWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: GulayTimelineProvider()) { entry in
            GulayWidgetView(entry: entry)
        }
        .configurationDisplayName("Today's Look")
        .description("Shows what Gülay's planned to wear (and do) today.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
