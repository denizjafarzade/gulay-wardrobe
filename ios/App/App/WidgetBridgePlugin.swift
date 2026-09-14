import Foundation
import Capacitor
import WidgetKit

/// Bridges "today's plan" from the web app into the shared App Group container
/// so the GulayWidget home-screen widget can read it, and nudges WidgetKit to
/// redraw. See WIDGET-SETUP.md for the one-time Xcode setup this depends on.
@objc(WidgetBridgePlugin)
public class WidgetBridgePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "WidgetBridgePlugin"
    public let jsName = "WidgetBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setToday", returnType: CAPPluginReturnPromise)
    ]

    // Must match the App Group ID you create in Xcode's Signing & Capabilities
    // (added to BOTH the App target and the GulayWidget target).
    static let appGroupId = "group.com.deniz.gulaywardrobe"

    @objc func setToday(_ call: CAPPluginCall) {
        guard let defaults = UserDefaults(suiteName: WidgetBridgePlugin.appGroupId) else {
            call.reject("App Group \(WidgetBridgePlugin.appGroupId) is not configured yet — see WIDGET-SETUP.md")
            return
        }
        let payload: [String: Any] = [
            "date": call.getString("date") ?? "",
            "outfitName": call.getString("outfitName") ?? "",
            "note": call.getString("note") ?? "",
            "briefing": call.getString("briefing") ?? "",
            "countdownLabel": call.getString("countdownLabel") ?? "",
            "countdownDays": call.getString("countdownDays") ?? "",
            "updatedAt": Date().timeIntervalSince1970,
        ]
        defaults.set(payload, forKey: "todayPlan")
        if #available(iOS 14.0, *) {
            WidgetCenter.shared.reloadAllTimelines()
        }
        call.resolve()
    }
}
