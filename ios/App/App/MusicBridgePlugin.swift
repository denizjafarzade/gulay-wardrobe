import Foundation
import Capacitor
import MediaPlayer
import AVFoundation

/// Mirrors whatever song is playing in the web app's <audio> element into
/// iOS's lock screen / Control Center "Now Playing" card, and forwards taps
/// on those controls (play/pause/next/previous) back to JS as a
/// "remoteCommand" event so app.js can drive the actual <audio> element.
///
/// Needs Background Modes → Audio enabled on the App target (Signing &
/// Capabilities) so playback and remote commands keep working once the app
/// is backgrounded / the screen is locked. See WIDGET-SETUP.md.
@objc(MusicBridgePlugin)
public class MusicBridgePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "MusicBridgePlugin"
    public let jsName = "MusicBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "nowPlaying", returnType: CAPPluginReturnPromise)
    ]

    private var commandsRegistered = false

    override public func load() {
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .default, options: [])
        try? AVAudioSession.sharedInstance().setActive(true, options: [])
        registerRemoteCommandsOnce()
    }

    @objc func nowPlaying(_ call: CAPPluginCall) {
        let title = call.getString("title") ?? ""
        let artist = call.getString("artist") ?? ""
        let playing = call.getBool("playing") ?? false

        let info: [String: Any] = [
            MPMediaItemPropertyTitle: title.isEmpty ? "Gülay's Wardrobe" : title,
            MPMediaItemPropertyArtist: artist,
            MPNowPlayingInfoPropertyPlaybackRate: playing ? 1.0 : 0.0,
        ]
        MPNowPlayingInfoCenter.default().nowPlayingInfo = info
        call.resolve()
    }

    private func registerRemoteCommandsOnce() {
        guard !commandsRegistered else { return }
        commandsRegistered = true
        let center = MPRemoteCommandCenter.shared()

        center.playCommand.addTarget { [weak self] _ in
            self?.notifyListeners("remoteCommand", data: ["command": "play"])
            return .success
        }
        center.pauseCommand.addTarget { [weak self] _ in
            self?.notifyListeners("remoteCommand", data: ["command": "pause"])
            return .success
        }
        center.nextTrackCommand.addTarget { [weak self] _ in
            self?.notifyListeners("remoteCommand", data: ["command": "next"])
            return .success
        }
        center.previousTrackCommand.addTarget { [weak self] _ in
            self?.notifyListeners("remoteCommand", data: ["command": "previous"])
            return .success
        }
    }
}
