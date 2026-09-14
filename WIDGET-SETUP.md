# Adding the home-screen widgets + lock-screen music controls

iOS home-screen widgets are a separate mini-app (a **Widget Extension**) inside
your Xcode project, written in Swift/SwiftUI. Xcode has to *create* that target
itself — it's not something that can be added by editing files by hand, so this
is the one part of the app that needs a few minutes of manual clicking in Xcode
on a Mac. Everything else (the Swift source code, the plugins that feed it data,
the deep link, the CI build config) is already written and sitting in the repo,
waiting for the target to exist.

Budget about 25 minutes, once, on any Mac with Xcode installed.

## 1. Create the widget extension target

1. Open `ios/App/App.xcworkspace` in Xcode.
2. File → New → Target… → **Widget Extension**.
3. Product Name: **GulayWidget** (must match exactly — the code assumes this).
4. Uncheck "Include Configuration Intent" and "Include Live Activity". Team: your
   Apple Developer team. Finish, and **don't** activate the new scheme if asked
   (doesn't matter either way).
5. Xcode creates a `GulayWidget/` folder with a few starter files
   (`GulayWidget.swift`, `GulayWidgetBundle.swift`, `Assets.xcassets`, `Info.plist`).
   **Delete** the generated `GulayWidget.swift` and `GulayWidgetBundle.swift` —
   we already wrote real versions of both (plus a third file, `GulayCountdownWidget.swift`,
   for the countdown widget), sitting right next to them in this repo's
   `ios/App/GulayWidget/` folder. Drag all three files from Finder into the
   `GulayWidget` group in Xcode (check "Copy items if needed" and target
   membership = GulayWidget only). This one target ships *two* widgets — "Today's
   Look" and "Countdown" — she can add either or both to her home screen.

## 2. Add the app↔widget and app↔music bridges to the main app target

`ios/App/App/WidgetBridgePlugin.swift` and `ios/App/App/MusicBridgePlugin.swift`
are already in that folder on disk, but since they were added outside Xcode
they may not be in the project yet:

1. In Xcode, right-click the **App** group (not GulayWidget) → Add Files to "App"…
2. Select both `WidgetBridgePlugin.swift` and `MusicBridgePlugin.swift`.
   Target membership = **App** only for both.

## 3. Turn on App Groups (this is what lets the app and widget share data)

1. Select the **App** target → Signing & Capabilities → **+ Capability** → **App Groups**.
2. Click **+** under App Groups, add: `group.com.deniz.gulaywardrobe`
   (Xcode will register this with your Apple Developer account automatically
   if "Automatically manage signing" is on).
3. Select the **GulayWidget** target → Signing & Capabilities → **+ Capability** → **App Groups**.
4. Check the *same* group: `group.com.deniz.gulaywardrobe`.

If you're managing signing manually instead (like the CI build does), create
the App Group at developer.apple.com → Identifiers → App Groups, then attach it
to both the `com.deniz.gulaywardrobe` and `com.deniz.gulaywardrobe.GulayWidget`
App IDs before regenerating their provisioning profiles.

## 4. Turn on Background Modes → Audio (for lock-screen music controls)

This lets play/pause/skip on the lock screen and Control Center keep working
once the app isn't in the foreground.

1. Select the **App** target → Signing & Capabilities → **+ Capability** → **Background Modes**.
2. Check **Audio, AirPlay, and Picture in Picture**.

(`Info.plist` already has the matching `UIBackgroundModes: [audio]` entry —
this capability toggle is what actually provisions/signs it.)

## 5. Build & try it

1. Run the **App** scheme on your iPhone or a simulator (not the GulayWidget
   scheme — widgets aren't run directly).
2. Open the app, go to Planner, and set today's outfit/note, and pin a countdown.
3. Long-press the home screen → **+** → search "Gülay's Wardrobe" → add the
   **Today's Look** widget and/or the **Countdown** widget.
4. Both should show what you just set — tapping either opens the app to the Planner.
5. Add a song in the music player, play it, then lock the phone — the lock
   screen should show a Now Playing card with working play/pause/skip.

## 6. Wiring it into the TestFlight pipeline (CI)

The GitHub Actions workflow already builds whatever targets exist in the Xcode
project, so once the target above exists, it'll build automatically. It just
needs its own signing:

1. developer.apple.com → Identifiers → register `com.deniz.gulaywardrobe.GulayWidget`
   (App Groups capability enabled, same group as above).
2. developer.apple.com → Profiles → new **App Store** profile for that bundle id,
   name it exactly **Gulay Widget AppStore** (this name is already referenced
   in `ios/App/exportOptions.plist`).
3. Base64-encode the downloaded `.mobileprovision` and add it as the GitHub repo
   secret `WIDGET_PROVISIONING_PROFILE_BASE64` (same method as the main app's
   profile — see README-APPSTORE.md step 3).

That's the last piece — after that, `git push` a `v*` tag (or run the workflow
manually) and the widgets + music controls ship to TestFlight along with the app.

## How it works, briefly

**Widgets:**
- `public/app.js` calls the native `WidgetBridge.setToday(...)` plugin (only
  exists on-device, no-ops harmlessly in the browser) whenever today's plan or
  a pinned countdown changes, or the app opens.
- `WidgetBridgePlugin.swift` writes that into `UserDefaults(suiteName:
  "group.com.deniz.gulaywardrobe")` — the shared App Group container — and
  tells WidgetKit to redraw.
- `GulayWidget.swift` and `GulayCountdownWidget.swift`'s `TimelineProvider`s
  read that same shared storage and render it. Both also refresh on their own
  at midnight so a stale "today" never lingers if the app isn't opened.
- Tapping either widget opens `gulaywardrobe://planner`, which `Info.plist`
  registers as a URL scheme the app already listens for (see `setupDeepLinks()`
  in `app.js`) to jump straight to the Planner.

**Music:**
- Playback itself is a plain HTML5 `<audio>` element in `app.js` — that part
  works today, no native code needed, on web and native alike.
- `app.js` calls `MusicBridge.nowPlaying({title, artist, playing})` whenever
  the current song or play state changes.
- `MusicBridgePlugin.swift` mirrors that into `MPNowPlayingInfoCenter` (the
  lock screen / Control Center card) and listens for `MPRemoteCommandCenter`
  taps (play/pause/next/previous), forwarding them back to `app.js` as a
  `remoteCommand` event, which then drives the real `<audio>` element.
- What's *not* included: interactive buttons on the widget itself (tapping
  play directly on the home screen tile). That needs iOS 17+ App Intents
  wired into the widget's button, which is a meaningfully bigger, harder-to-
  verify-blind piece of native work — left as a follow-up if she wants it.
  Today, the widgets are tap-to-open; the lock screen card has the real
  play/pause/skip controls.
