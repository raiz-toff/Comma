# Development Setup

This guide gets you from zero to a running Comma development build.

---

## Prerequisites

- **Node.js** 20+ (`node --version`)
- **npm** 10+ (comes with Node)
- **Expo CLI** — `npm install -g expo`
- **Android Studio** (for Android development) with:
  - Android SDK
  - Android Emulator or a physical device with USB debugging
- **Xcode 15+** (for iOS development — macOS only)
- **CocoaPods** (for iOS) — `sudo gem install cocoapods`

---

## Clone and install

```bash
git clone https://github.com/raiz-toff/CommaApp.git
cd CommaApp
npm install
```

---

## Environment variables

Copy the example env file and fill in your Google OAuth client ID:

```bash
cp .env.example .env
```

Edit `.env`:
```
GOOGLE_WEB_CLIENT_ID=your-google-web-client-id.apps.googleusercontent.com
```

See [Environment Variables](./environment-variables.md) for full details on obtaining the client ID.

---

## Running on Android

### Using an emulator

```bash
npx expo start --android
```

Expo will open the Metro bundler and launch the Android emulator automatically (if one is running in Android Studio).

### Using a physical device

1. Enable Developer Options and USB Debugging on your Android device.
2. Connect via USB.
3. Run `npx expo start --android`.

### Building an APK

```bash
./build-android.sh
```

You need the Android SDK path set in `android/local.properties`:
```
sdk.dir=/path/to/android-sdk
```

On macOS, the SDK is typically at `~/Library/Android/sdk`.

---

## Running on iOS

### Using Simulator

```bash
npx expo start --ios
```

Expo will build and launch in the iOS Simulator.

### Using a physical device

A physical device requires a paid Apple Developer account for code signing.

1. Open the `ios/` folder in Xcode.
2. Set your Team in Signing & Capabilities.
3. Build and run on your device.

Or use EAS Build:
```bash
npx eas build --profile development --platform ios
```

---

## Running in Expo Go

Some features won't work in Expo Go (native modules, background GPS). For basic UI work, it's fine:

```bash
npx expo start
```

Scan the QR code with the Expo Go app on your device.

---

## Development build (recommended)

For full feature access (GPS, background services, Google Sign-In), use a development build:

```bash
npx expo run:android
# or
npx expo run:ios
```

This builds a native development binary with the Metro bundler attached. You get full native module support and fast refresh.

---

## iOS dependencies (CocoaPods)

After `npm install`, install CocoaPods:

```bash
cd ios
pod install
cd ..
```

If you add native packages, re-run `pod install` before building.

---

## TypeScript

The project uses **TypeScript 6 in strict mode**. Run the type checker:

```bash
npx tsc --noEmit
```

No `any` — the linter will reject it.

---

## Linting and formatting

```bash
npm run lint          # ESLint
npm run format        # Prettier
```

---

## Testing

```bash
npm test              # Jest unit tests
```

---

## Database inspection

To inspect the SQLite database on a running emulator:

**Android:**
```bash
adb shell
run-as app.comma.tracker
cd databases
sqlite3 comma.db
```

**iOS Simulator:**
Use the Simulator's file browser or a tool like [DB Browser for SQLite](https://sqlitebrowser.org/) to open the app container's database.

---

## Demo mode

Comma includes a demo mode with pre-populated sample data. Enable it in **Settings → Developer → Demo Mode**. This is useful for testing analytics and reports without logging real shifts.

---

## Troubleshooting

**Metro bundler won't start**
- Delete `.expo/` and `node_modules/.cache/`, then run `npm install` again.

**Build fails on Android**
- Verify `android/local.properties` has the correct SDK path.
- Ensure the Android SDK Build Tools version matches `build.gradle`.

**GPS not working in emulator**
- Emulators don't have real GPS. Use the emulator's "Location" control panel to feed fake coordinates, or test on a physical device.

**Google Sign-In crashes**
- Verify your `GOOGLE_WEB_CLIENT_ID` matches the OAuth client you configured in Google Cloud Console.
- The SHA-1 fingerprint of your debug keystore must be registered in the Google Cloud Console for Android.

**"Module not found" after adding a package**
- Run `npx expo install <package>` (not plain `npm install`) to get the Expo-compatible version.
- For packages with native code: run `pod install` (iOS) and rebuild the native binary.
