# Tracklab Scan

The phone app for Tracklab IM. Sign in with your Tracklab email and password, then:

- **Book in / Book out**: scan a reel or item label (supplier 2D codes, LCSC QR, barcodes) or
  type a stock code, check the item, enter the quantity and place, and send. The scan waits on
  the website under **Sales > Scanner** until someone approves it; only then does stock change.
  **My scans** shows each one turning Approved or Rejected, and Cancel on those still waiting.
- **Pick photo**: photograph picked stock against a sales order or delivery note number. It shows
  on the website under Sales > Scanner > Pick scans.

With no signal, scans are kept on the phone and sent when signal comes back (or press
**Send now**). Nothing is lost by closing the app.

The API it uses is described in `SCANNER_APP_API.md` in the Tracklab repo. Tracklab's own
browser version of the same screens is at `https://tracklab-im.fly.dev/scan` (no install needed).

## Run it during development

```bash
npm install
npx expo start
```

Open it in **Expo Go** on the phone (scan the QR code shown). It talks to the live Tracklab at
`https://tracklab-im.fly.dev`; to point it elsewhere set `EXPO_PUBLIC_API_URL` before starting.

## Build an installable Android app (APK)

Needs a free Expo account (`npx eas-cli login`).

```bash
npx eas-cli build --platform android --profile preview
```

When the build finishes, EAS gives a link and QR code; open it on the phone to download and
install the APK (allow "install unknown apps" for the browser once). `--profile production`
makes a Play Store bundle instead. iPhones need an Apple developer account
(`--platform ios`); until then, iPhone users can add `https://tracklab-im.fly.dev/scan` to
the home screen.

## Layout

| | |
|---|---|
| `App.js` | Sign-in gate and the two screens |
| `screens/StockScreen.js` | Book in / out and My scans |
| `screens/PickScreen.js` | Pick photos |
| `screens/SignInScreen.js` | Sign in |
| `components/CodeScanner.js` | Camera barcode scanner |
| `components/PlacePicker.js` | Choose a stock location |
| `components/QueueBar.js` | Scans waiting for signal, and refused ones |
| `lib/api.js` | Calls to Tracklab; the token lives in the phone's secure store |
| `lib/auth.js` | Who is signed in |
| `lib/queue.js` | The offline queue |
