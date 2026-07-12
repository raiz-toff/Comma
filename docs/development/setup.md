# Development Setup

This guide gets all three parts of the monorepo running locally: the phone app, the web app, and this documentation site.

---

## Prerequisites

- **Node.js** 20 or newer (`node --version`)
- **npm** 10 or newer (bundled with Node)
- For the **phone app** only:
  - **JDK 17** or newer
  - **Android SDK** (via Android Studio), with `ANDROID_HOME` set and a device or emulator available

The web app and the docs site need only Node.

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

## Web app

The web app is a dependency-light PWA built with esbuild. It has its own `package.json` under `web/`:

```bash
cd web
npm install
npm run dev     # esbuild dev build + local serve
```

For a production build:

```bash
npm run build   # writes web/dist/
npm run preview # serve the built output
```

The web app stores its data in the browser (IndexedDB), so nothing else is required to run it.

---

## Docs site

These pages are authored as Markdown in `docs/` and rendered by a Fumadocs (Next.js) app in `docs-site/`. The content is generated from `docs/` by `scripts/sync-content.mjs`, which runs automatically before `dev` and `build`.

```bash
cd docs-site
npm install
npm run dev     # runs the content sync, then next dev
```

To edit a page, change the Markdown under `docs/` and re-run (or keep `dev` running); the sync step copies it into the site. `npm run build` produces the production site.

---

## Quality gates (phone app)

Run from the repository root:

```bash
npx tsc --noEmit   # TypeScript, strict mode — no `any`
npm run lint       # ESLint
npm test           # Jest
```

---

## Demo mode

To explore either app without entering real data, load demo mode from the welcome gate ("try the demo") or from Settings. It seeds sample shifts, expenses, vehicles, and goals so analytics and reports have something to show. Sync is disabled while demo data is loaded, so nothing sample ever reaches a real Drive.

---

## Troubleshooting

**Metro won't start** — delete `.expo/` and `node_modules/.cache/`, then `npm install` again.

**Android build fails** — check the SDK path in `android/local.properties` and that `ANDROID_HOME` is set.

**GPS does nothing in an emulator** — emulators have no real GPS. Feed coordinates from the emulator's Location panel, or test on a physical device.

**Google Sign-In crashes** — confirm `GOOGLE_WEB_CLIENT_ID` matches the OAuth client, and that your debug keystore's SHA-1 is registered in Google Cloud Console.

**"Module not found" after adding a package** — use `npx expo install <package>` for phone dependencies so you get an Expo-compatible version; rebuild the native binary if the package has native code.
