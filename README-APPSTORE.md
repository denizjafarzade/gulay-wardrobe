# Getting Gülay's Wardrobe onto her iPhone

The app is already a real iOS app (Capacitor wraps the web app in `public/` — the
native project lives in `ios/`). Everything — items, photos, planner, songs, chat —
is stored on **your server**, not on her phone, so her device's storage is barely
touched. That means the app needs your server reachable over the internet to work
at all; see "Point the app at your server" below before building.

Because iOS apps can only be *built* on a Mac, the GitHub Actions workflow in
`.github/workflows/ios-testflight.yml` builds it in the cloud and uploads it to
TestFlight, where Gülay installs it. Here is everything you need to do, in order.

## 0. Host the server, then point the app at it

1. Deploy `server.js` somewhere always-on and reachable over **HTTPS** (a plain
   HTTP address won't work — iOS blocks insecure connections from apps by default).
   Railway or Render are the easiest (git-push deploy, free HTTPS, no server
   administration); a Hostinger VPS works too but you manage Node/Nginx/certs
   yourself. Set the `GEMINI_API_KEY` env var on whichever host you pick — never
   commit it or ship it inside the app.
2. Edit `public/config.js` and set `apiBase` to that server's URL:
   ```js
   window.WARDROBE_CONFIG = { apiBase: 'https://your-server-url' };
   ```
3. Run `npx cap sync ios` so the native build picks up the change, then continue
   with the steps below.

Leave `apiBase` empty when just running `npm start` for local web development —
the site continues to work exactly as before, talking to whatever server served
the page.

## 1. Apple Developer account (~15 min, $99/year)

1. Go to https://developer.apple.com/programs/enroll/ and enroll with your Apple ID.
2. After approval, note your **Team ID** (Membership page) and put it into
   `ios/App/exportOptions.plist` (replace `YOUR_TEAM_ID`).

## 2. App Store Connect setup (~10 min)

1. At https://appstoreconnect.apple.com → Apps → **+** → New App:
   - Platform iOS, Name **Gülay's Wardrobe**, Bundle ID **com.deniz.gulaywardrobe**
     (register the bundle id first at developer.apple.com → Identifiers if asked).
2. Users and Access → Integrations → App Store Connect API → **Generate API Key**
   (role: App Manager). Save:
   - the **Issuer ID** → secret `APPSTORE_ISSUER_ID`
   - the **Key ID** → secret `APPSTORE_KEY_ID`
   - the downloaded `.p8` file's contents → secret `APPSTORE_PRIVATE_KEY`

## 3. Signing certificate + provisioning profile (~15 min, needs any Mac once — or use Codemagic/Appflow which can create them for you)

1. developer.apple.com → Certificates → create an **Apple Distribution** certificate.
   Export it as `.p12` with a password.
   - base64 of the `.p12` → secret `BUILD_CERTIFICATE_BASE64`
     (PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("cert.p12")) | Set-Clipboard`)
   - the password → secret `P12_PASSWORD`
2. developer.apple.com → Profiles → new **App Store** profile for
   `com.deniz.gulaywardrobe`, name it exactly **Gulay Wardrobe AppStore**.
   - base64 of the `.mobileprovision` → secret `PROVISIONING_PROFILE_BASE64`

## 4. Push this folder to GitHub and add the secrets

1. Create a private repo, push the `wardrobe` folder.
2. Repo → Settings → Secrets and variables → Actions → add the six secrets above.
3. Actions tab → **iOS TestFlight build** → Run workflow.

## 5. Install on Gülay's iPhone

1. When the build appears in App Store Connect → TestFlight, add Gülay as an
   internal tester (her Apple ID email).
2. She installs the **TestFlight** app, accepts your invite, and taps Install.
   TestFlight builds last 90 days — re-run the workflow to refresh, or submit
   the app for App Store review for a permanent install.

## Day-to-day development (on this PC)

- Website mode (data on the PC server): `npm start` → http://localhost:4477
- Phone-mode preview (data in the browser itself): http://localhost:4477/?local=1
- After changing anything in `public/`, run `npx cap sync ios` before building.
- After `npm install`-ing a new native plugin (like the local-notifications one
  used by the Planner), also run `npx cap sync ios` once so Xcode picks it up.
- App icon/splash: edit `make-icon.js`, then
  `node make-icon.js && npx capacitor-assets generate --ios && npx cap sync ios`.

## Home-screen widgets + lock-screen music controls

The Planner can show "Today's Look" and "Countdown" widgets on her home
screen, and the music player can show real play/pause/skip controls on the
lock screen. Both need one extra manual Xcode step (Xcode has to create the
widget's Xcode target itself) — see **WIDGET-SETUP.md** for the full
walkthrough. The app works completely fine without doing this; these are
optional extras.
