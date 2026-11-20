# Tracklab Scan

The phone app for Tracklab IM. Sign in with your Tracklab email and password, then:

- **Book in / Book out**: scan a reel or item label (supplier 2D codes, LCSC QR, barcodes) or
  type a stock code, check the item, enter the quantity and place, and send. The scan waits on
  the website under **Sales > Scanner** until someone approves it; only then does stock change.
  **My scans** shows each one turning Approved or Rejected, and Cancel on those still waiting.
  Booking in a label that isn't in Tracklab offers **Add as a new item** (stock code, name, maker
  part number from the label) or **Link to an existing item** (the label is remembered on it, so the
  next scan finds it). Both happen only when the scan is approved on the website.
  My scans loads older scans as you scroll down (with a Top button to come back up).
- **Scan BOM items** (the **BOM** button, or the banner that appears when a BOM is waiting): the
  phone's half of **Book Out Entire BOM** on the website. Open a waiting BOM, see where each item
  is kept, and scan them. A wrong part is refused; an item kept on reels is taken a whole reel at a
  time; anything else must match what the BOM still needs. Lines go green on the phone and on the
  website as they're picked, and a scan can be undone. The website does the final check and books
  it out. This needs signal (the website watches it live), so it isn't queued offline.
- **Scan a bill** (the **Bill** button): photograph each page of a supplier's invoice and send it.
  It waits on the website under Purchases > Bills > From the scanner, already read (supplier, VAT
  number, invoice number, dates, lines); a bill is only made when someone creates it there.
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
| `App.js` | Sign-in gate and the screens |
| `screens/StockScreen.js` | Book in / out, My scans (pages load as you scroll), the BOM banner |
| `screens/BomPickScreen.js` | Scan BOM items |
| `screens/BillScanScreen.js` | Scan a bill |
| `screens/PickScreen.js` | Pick photos |
| `screens/SignInScreen.js` | Sign in |
| `components/CodeScanner.js` | Camera barcode scanner |
| `components/PlacePicker.js` | Choose a stock location |
| `components/QueueBar.js` | Scans waiting for signal, and refused ones |
| `lib/api.js` | Calls to Tracklab; the token lives in the phone's secure store |
| `lib/auth.js` | Who is signed in |
| `lib/queue.js` | The offline queue |
| `lib/bomPick.js` | BOM picking rules: which line a scan is for, which place, what to tell the picker |
| `lib/scans.js` | My scans paging |
