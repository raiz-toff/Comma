# Releasing

How a new version of Comma gets built, published to GitHub, shipped to Google Play, and pushed over the air.

This page is for maintainers. You need the release keystore and the Play service-account key — neither is in the repository, and neither can be recreated from it.

<StepFlow accent="amber" steps={[{ title: "Bump", body: "node scripts/version.mjs bump 1.4.0 — never hand-edit a version." }, { title: "Build", body: "./build.sh — then install the real artifact on a real device." }, { title: "Publish", body: "GitHub release, Play upload, then OTA for JS-only fixes." }]} caption="versionCode must increase on every Play upload, and the release keystore cannot be recreated. A release build is not a debug build." />

---

## What a release consists of

| Artifact | Goes to | Built by |
|---|---|---|
| **APK** (`comma-vX.Y.Z.apk`) | GitHub Releases — the sideload download | `./build.sh` → option 2 |
| **AAB** (`app-release.aab`) | Google Play | `./build.sh` → option 3 |
| **OTA update** (JS + assets only) | Installed apps, on next launch | `eas update` |
| **Web app** | Vercel (`comma-psi.vercel.app`) | Automatic on push to `main` |
| **Docs** | Vercel (`comma-docs.vercel.app`) | Automatic on push to `main` |

The web app and docs need nothing from you — they deploy from `main`. Everything below is about the Android app.

---

## Prerequisites (one time per machine)

Three things live outside the repository and must be present:

1. **The release keystore** — `~/comma-release.keystore`. Every APK Comma has ever shipped is signed with it. Android refuses to install an update signed by a different key, so **losing this file means no existing sideload user can ever update again.** Keep an offline backup.

2. **Keystore passwords** — in `~/.gradle/gradle.properties` (not the repo's):

   ```properties
   MYAPP_UPLOAD_STORE_FILE=/home/you/comma-release.keystore
   MYAPP_UPLOAD_KEY_ALIAS=comma
   MYAPP_UPLOAD_STORE_PASSWORD=…
   MYAPP_UPLOAD_KEY_PASSWORD=…
   ```

3. **The Play service-account key** — `secrets/play-service-account.json` (git-ignored). Create it in Google Cloud Console → **IAM & Admin → Service Accounts** → *Keys → Add key → JSON*, with the **Google Play Android Developer API** enabled on the project, then invite that service-account email under Play Console → **Users and permissions** with release permission on the app.

   Mint a **separate key per machine** rather than copying one around, so a lost laptop can be revoked on its own.

Verify the key without touching anything live:

```bash
node scripts/submit-play.mjs --dry-run
```

---

## Step 1 — Bump the version

One command, from the machine you'll build on:

```bash
node scripts/version.mjs bump 1.4.0
```

It rewrites every place that states a version, increments `versionCode`, and opens a
`CHANGELOG.md` entry for you to fill in:

| File | Field |
|---|---|
| `app.json` | `expo.version` — the source of truth every other file follows |
| `package.json` | `version` |
| `web/src/modules/changelog/changelog.js` | `APP_VERSION` — the web "What's New" modal and support reports |
| `android/app/build.gradle` | `versionName`, and `versionCode` (**integer, must increase every Play upload**) |
| `CHANGELOG.md` | a new `## [1.4.0]` entry |

Do not edit these by hand. They drifted to 1.3.1 / 1.0.0 / 1.3.0 across four files while this
page said "kept in step by hand", which is why the script exists. Verify any time with:

```bash
node scripts/version.mjs check
```

`android/` is untracked in git (Expo-managed), so `versionCode` lives only on the build
machine — run `bump` there, or bump it yourself before building. Check what the last release
used:

```bash
gh release view --json tagName
```

Then **write the CHANGELOG entry** (the GitHub release notes are written from it, and the docs
site publishes it at `/changelog`), and refresh the web "What's New" highlights in
`web/src/modules/changelog/changelog.js` so they describe the version you're shipping.

> `runtimeVersion` follows `appVersion` (`app.json`). Changing the version name **starts a new OTA lineage**: updates published for `1.3.1` will not reach `1.3.0` binaries. That's intended — it stops a JS bundle from landing on a binary whose native code it doesn't match.

---

## Step 2 — Build

```bash
./build.sh
```

Pick **2** for a sideload APK or **3** for a Play AAB. Both do a clean release build, sign with the keystore above, and offer to serve the file over HTTP with a QR code so you can install it on a phone.

Then test the artifact on a real device before publishing it. A release build is not a debug build:

> **Never re-enable `EXPO_UNSTABLE_TREE_SHAKING` / `EXPO_UNSTABLE_METRO_OPTIMIZE_GRAPH`.** They shrink the JS bundle by ~1.4 MB and strip NativeWind's runtime style registration along with it. Every `className`-styled element renders unstyled — most text becomes near-invisible. Debug builds are unaffected, so this only appears in the artifact you ship. Version 1.3.0 (versionCode 5) went out broken this way. `build.sh` carries a comment saying the same thing; believe it.

Confirm what you actually built:

```bash
aapt dump badging android/app/build/outputs/apk/release/app-release.apk | head -1
# package: name='app.comma.tracker' versionCode='7' versionName='1.3.1' …
```

---

## Step 3 — Publish to GitHub

Tag the commit and attach the APK under the name users expect:

```bash
git tag v1.3.1 && git push origin v1.3.1

cp android/app/build/outputs/apk/release/app-release.apk /tmp/comma-v1.3.1.apk
gh release create v1.3.1 /tmp/comma-v1.3.1.apk \
  --title "v1.3.1" \
  --notes "…Added / Fixed sections, mirroring CHANGELOG.md…"
```

To replace the binary on a release that is already out (a bad build), overwrite the asset in place rather than cutting a new tag:

```bash
gh release upload v1.3.1 /tmp/comma-v1.3.1.apk --clobber
```

---

## Step 4 — Publish to Google Play

```bash
node scripts/submit-play.mjs
```

This talks straight to the Google Play Developer API — no EAS, no fastlane, no dependencies. It authenticates with the service-account key, creates an edit, uploads the AAB, assigns it to a track, and commits.

| Flag | Default | Notes |
|---|---|---|
| `--track` | `internal` | `internal` · `alpha` · `beta` · `production` |
| `--aab` | `android/app/build/outputs/bundle/release/app-release.aab` | Path to the bundle |
| `--dry-run` | — | Auth + permissions check. Creates an edit, deletes it, changes nothing. |

The default is deliberately the **internal** track. Promoting to production is an explicit act:

```bash
node scripts/submit-play.mjs --track production
```

Play rejects a `versionCode` it has already seen, so each upload needs Step 1's bump.

`eas submit -p android` still works as a fallback (configured in `eas.json`), but it isn't needed.

---

## Step 5 — Ship JS-only fixes over the air

Once a binary is installed, most fixes never need another one. An OTA update replaces the JavaScript bundle and assets:

```bash
npx eas-cli update --channel production --message "fix: correct HST rate for ON"
```

Installed apps fetch it on next launch. No store review, no reinstall.

**What OTA cannot do:** anything native. New native modules, permission changes, `build.gradle` edits, SDK upgrades, or a `versionCode` bump all require a real build and a store/APK release. If in doubt: if your change touches `android/`, `package.json` native deps, or app config, it is not an OTA.

**What OTA will not reach:** builds shipped before versionCode 7. The update channel is baked into the binary at build time (`app.json` → `updates.requestHeaders`, mirrored in `AndroidManifest.xml`), and earlier builds shipped without one. Those users pick up OTA capability when they next update through Play or the APK.

---

## Working from another machine

Clone the repo, then bring the pieces that aren't in it:

1. Copy the keystore and add the four `MYAPP_UPLOAD_*` lines to `~/.gradle/gradle.properties`, fixing the path.
2. Mint a fresh Play service-account key into `secrets/`.
3. Install the Android SDK (set `ANDROID_HOME`), JDK 17+, Node 20+, then `npm install`.
4. `gh auth login` for GitHub releases.

`secrets/` and `*.keystore` are git-ignored. Nothing secret is in the repository, and nothing about a public clone lets anyone sign as Comma or publish to its Play listing — see [Contributing](./contributing.md).

---

## Checklist

```
[ ] node scripts/version.mjs bump X.Y.Z   (then: node scripts/version.mjs check)
[ ] CHANGELOG.md entry written  (publishes to the docs site at /changelog)
[ ] Web "What's New" highlights refreshed for this version
[ ] ./build.sh → APK and/or AAB
[ ] Installed the artifact on a real device and opened it (styles render? text visible?)
[ ] git tag vX.Y.Z && push
[ ] gh release create with comma-vX.Y.Z.apk
[ ] node scripts/submit-play.mjs  (internal → promote when happy)
[ ] Play Console: promote track, once review passes
```
