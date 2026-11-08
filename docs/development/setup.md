# Development Setup

This guide gets the Comma Android app running locally.


---

## Prerequisites

- **Node.js** 20 or newer (`node --version`)
- **npm** 10 or newer (bundled with Node)
- **JDK 17** or newer
- **Android SDK** (via Android Studio), with `ANDROID_HOME` set and a device or emulator available

---

## Clone

```bash
git clone https://github.com/raiz-toff/Comma.git
cd Comma
```

Each app installs its own dependencies from its own directory, described below.

---

## Phone app

Install from the repository root:

```bash
npm install
```

Then set up the Google OAuth client id used for Drive sign-in:

```bash
cp .env.example .env
# edit .env and set GOOGLE_WEB_CLIENT_ID
```

See [Environment Variables](./environment-variables.md) for how to obtain it.

### Run a development build

The GPS feature depends on the native `comma-tracker` module, and **there is no working Expo Go path for it** — Expo Go cannot load a custom native module, so GPS, the foreground service, and Google Sign-In will not work there. Build and run a development build instead:

```bash
npx expo run:android
```

This compiles a native development binary and attaches the Metro bundler, so you get the native module plus fast refresh. Use this, not `expo start` against Expo Go, whenever you touch tracking.

> iOS is not a shipping target — releases are Android APKs and AABs (see [Releasing](./releasing.md)) — but a macOS machine with Xcode can run `npx expo run:ios` for UI work.

### Build an installable APK

```bash
./build.sh
```

`build.sh` produces a signed APK or AAB. It needs the Android SDK path in `android/local.properties` (`sdk.dir=/path/to/android-sdk`) and the release keystore for a publishable build; see [Releasing](./releasing.md).

### Inspect the database

```bash
adb shell
run-as app.comma.tracker
cd databases
sqlite3 comma.db
```

---

## Quality gates

Run from the repository root:

```bash
npx tsc --noEmit   # TypeScript, strict mode — no `any`
npm run lint       # ESLint
npm test           # Jest
```

---

## Demo mode

To explore the app without entering real data, load demo mode from the welcome gate ("try the demo") or from Settings. It seeds sample shifts, expenses, vehicles, and goals so analytics and reports have something to show. Sync is disabled while demo data is loaded, so nothing sample ever reaches a real Drive.

---

## Troubleshooting

**Metro won't start** — delete `.expo/` and `node_modules/.cache/`, then `npm install` again.

**Android build fails** — check the SDK path in `android/local.properties` and that `ANDROID_HOME` is set.

**GPS does nothing in an emulator** — emulators have no real GPS. Feed coordinates from the emulator's Location panel, or test on a physical device.

**Google Sign-In crashes** — confirm `GOOGLE_WEB_CLIENT_ID` matches the OAuth client, and that your debug keystore's SHA-1 is registered in Google Cloud Console.

**"Module not found" after adding a package** — use `npx expo install <package>` so you get an Expo-compatible version; rebuild the native binary if the package has native code.
