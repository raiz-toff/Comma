/**
 * Google OAuth client IDs (Google Cloud project number 438513486290).
 *
 * - WEB client ID is the only one referenced in code: it's GoogleSignin's
 *   `webClientId` on native, and the expo-auth-session `clientId` on web.
 * - The ANDROID client (package `app.comma.tracker` + signing SHA-1) is verified
 *   by Google Play Services automatically and is NOT referenced in code — it's listed
 *   here for documentation only. The SHA-1 on file in Cloud Console must include the
 *   Play App Signing key's fingerprint (Play Console → Setup → App signing), not just
 *   the local upload key — Play re-signs the app before delivering it to users, so an
 *   Android OAuth client registered with only the upload key's SHA-1 will fail sign-in
 *   for anyone who installed from the Play Store.
 * - The iOS client ID is added once an iOS OAuth client is created (it also provides
 *   the `iosUrlScheme` for app.json).
 */
export const GOOGLE_WEB_CLIENT_ID =
  "438513486290-hvsmc82435unb6t9gvmgddngk0p92g1m.apps.googleusercontent.com";

/** Documentation only — Google checks the app's package + SHA-1 directly. */
export const GOOGLE_ANDROID_CLIENT_ID =
  "438513486290-7vh8ed7qnpradulqabtnaklajfk29c5k.apps.googleusercontent.com";

/** Set once an iOS OAuth client exists. */
export const GOOGLE_IOS_CLIENT_ID = "";

/**
 * Drive "app data folder" scope — a hidden, app-private folder. Backups never touch
 * the user's visible Drive files, and the app can't see anything else in their Drive.
 */
export const GOOGLE_DRIVE_SCOPES = ["https://www.googleapis.com/auth/drive.appdata"];
