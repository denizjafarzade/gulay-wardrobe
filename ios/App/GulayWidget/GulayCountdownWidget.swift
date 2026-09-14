import WidgetKit
import SwiftUI

struct CountdownEntry: TimelineEntry {
    let date: Date
    let label: String
    let days: Int
    let hasCountdown: Bool
}

struct CountdownTimelineProvider: TimelineProvider {
    func placeholder(in context: Context) -> CountdownEntry {
        CountdownEntry(date: Date(), label: "Birthday", days: 12, hasCountdown: true)
    }

    func getSnapshot(in context: Context, completion: @escaping (CountdownEntry) -> Void) {
        completion(readEntry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<CountdownEntry>) -> Void) {
        let entry = readEntry()
        let calendar = Calendar.current
        let nextMidnight = calendar.nextDate(after: Date(), matching: DateComponents(hour: 0, minute: 1), matchingPolicy: .nextTime) ?? Date().addingTimeInterval(3600)
        completion(Timeline(entries: [entry], policy: .after(nextMidnight)))
    }

    private func readEntry() -> CountdownEntry {
        let defaults = UserDefaults(suiteName: widgetAppGroupId)
        guard let plan = defaults?.dictionary(forKey: "todayPlan"),
              let label = plan["countdownLabel"] as? String, !label.isEmpty,
              let daysStr = plan["countdownDays"] as? String, let days = Int(daysStr)
        else {
            return CountdownEntry(date: Date(), label: "", days: 0, hasCountdown: false)
        }
        return CountdownEntry(date: Date(), label: label, days: days, hasCountdown: true)
    }
}

struct GulayCountdownWidgetView: View {
    var entry: CountdownEntry

    var body: some View {
        ZStack {
            LinearGradient(colors: [Color(red: 0.98, green: 0.96, blue: 0.94), Color(red: 0.95, green: 0.86, blue: 0.85)],
                            startPoint: .topLeading, endPoint: .bottomTrailing)
            VStack(spacing: 4) {
                if entry.hasCountdown {
                    Text(entry.days == 0 ? "Today" : "\(abs(entry.days))")
                        .font(.system(size: entry.days == 0 ? 22 : 40, weight: .bold, design: .serif))
                        .foregroundColor(Color(red: 0.26, green: 0.19, blue: 0.23))
                    if entry.days != 0 {
                        Text(entry.days > 0 ? "days to go" : "days ago")
                            .font(.system(size: 11))
                            .foregroundColor(Color(red: 0.66, green: 0.42, blue: 0.47))
                    }
                    Text(entry.label)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(Color(red: 0.49, green: 0.40, blue: 0.44))
                        .lineLimit(1)
                        .padding(.top, 2)
                } else {
                    Text("No countdown pinned")
                        .font(.system(size: 12, weight: .semibold, design: .serif))
                        .foregroundColor(Color(red: 0.26, green: 0.19, blue: 0.23))
                    Text("Pin one in the Planner")
                        .font(.system(size: 11))
                        .foregroundColor(Color(red: 0.49, green: 0.40, blue: 0.44))
                }
            }
            .padding(12)
        }
        .widgetURL(URL(string: "gulaywardrobe://planner"))
    }
}

struct GulayCountdownWidget: Widget {
    let kind = "GulayCountdownWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: CountdownTimelineProvider()) { entry in
            GulayCountdownWidgetView(entry: entry)
        }
        .configurationDisplayName("Countdown")
        .description("Days left until whatever she's pinned — a birthday, school ending, a trip.")
        .supportedFamilies([.systemSmall])
    }
}
