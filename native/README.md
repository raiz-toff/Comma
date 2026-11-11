# Comma Simple

A small native Android app: Kotlin, Jetpack Compose, Material 3. It is separate from the
React Native app in the rest of this repository and shares no code with it.

It records shifts with GPS distance, keeps expenses, shows weekly, monthly and yearly reports,
and backs up to the driver's own Google Drive or to a file.

## Build

```bash
cd native
./gradlew assembleRelease     # app/build/outputs/apk/release/app-release.apk
./gradlew assembleDebug       # installs beside the release app as app.comma.tracker.debug
```

Needs JDK 17 and the Android SDK (`sdk.dir` in `native/local.properties`, or `ANDROID_HOME`).

A release build is signed only if `~/.gradle/gradle.properties` defines the
`MYAPP_UPLOAD_STORE_FILE`, `MYAPP_UPLOAD_STORE_PASSWORD`, `MYAPP_UPLOAD_KEY_ALIAS` and
`MYAPP_UPLOAD_KEY_PASSWORD` properties, the same ones the React Native build uses.

## Things to know before changing it

- **Google Drive sign-in works only for builds signed with the release keystore.** The OAuth
  client is registered for the package `app.comma.tracker` and that certificate. A debug build,
  or a build with another package name, cannot connect to Drive.
- **Same package name as Comma.** Installed over the React Native app it is an update, so its
  `versionCode` must stay higher. On first launch it copies shifts and expenses out of the old
  app's database (`data/LegacyImport.kt`); the old file is only read.
- **Test the release build, not just debug.** The release build is shrunk by R8.
- **A database change needs a migration.** Raising the Room version in `data/Db.kt` without
  one wipes existing installs.
- **The backup is one JSON file** (`data/Backup.kt`). Readers ignore unknown fields and every
  field has a default, so add fields rather than renaming or removing them.
- **The look** is stock Material 3 with the phone app's colours and the system font
  (`ui/Theme.kt`).
