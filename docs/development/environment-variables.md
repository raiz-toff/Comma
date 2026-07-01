# Environment Variables

Comma uses a `.env` file for configuration that varies between development and production builds.

---

## Setup

```bash
cp .env.example .env
```

Then edit `.env` with your values. The file is gitignored — never commit it.

---

## Variables

### `GOOGLE_WEB_CLIENT_ID`

**Required for Google Drive backup and cloud sync.**

```
GOOGLE_WEB_CLIENT_ID=123456789-abcdefghijklmnop.apps.googleusercontent.com
```

This is the client ID for your Web OAuth client in Google Cloud Console. It is used:
- On web (Expo web builds) for the OAuth redirect flow
- On Android as the `webClientId` in `@react-native-google-signin/google-signin`'s configuration

---

## Getting the Google OAuth client ID

### Step 1 — Create a Google Cloud project

1. Go to [Google Cloud Console](https://console.cloud.google.com).
2. Create a new project (or use an existing one).
3. Navigate to **APIs & Services → Library**.
4. Enable the **Google Drive API**.

### Step 2 — Configure the OAuth consent screen

1. Go to **APIs & Services → OAuth consent screen**.
2. Choose **External** user type.
3. Fill in app name (e.g. "Comma") and your email.
4. Under **Scopes**, add:
   - `https://www.googleapis.com/auth/drive.appdata`
5. Add test users if you're in development (before publishing).

### Step 3 — Create OAuth credentials

You need credentials for each platform you're targeting:

#### Web client (always required)

1. Go to **APIs & Services → Credentials → Create Credentials → OAuth Client ID**.
2. Type: **Web application**.
3. Add `http://localhost` to Authorized JavaScript origins (for Expo dev).
4. Copy the **Client ID** → this is your `GOOGLE_WEB_CLIENT_ID`.

#### Android client

1. Create Credentials → OAuth Client ID → **Android**.
2. Package name: `com.comma.app` (or your bundle ID from `app.json`).
3. SHA-1 fingerprint: get your debug keystore SHA-1:
   ```bash
   cd android && ./gradlew signingReport
   ```
   For release, use your upload keystore SHA-1.
4. Copy the **Client ID** — you don't need this in `.env`, but it must exist in the Google Cloud project for Android sign-in to work.

#### iOS client

1. Create Credentials → OAuth Client ID → **iOS**.
2. Bundle ID: `com.comma.app` (or your bundle ID).
3. Copy the **Client ID** — not needed in `.env`, but must exist for iOS sign-in.

---

## `.env.example` reference

```bash
# Google OAuth Web Client ID
# Required for Google Drive backup and cloud sync on all platforms.
# Create at: console.cloud.google.com → APIs & Services → Credentials
GOOGLE_WEB_CLIENT_ID=

# Optional: override the default log level (debug | info | warn | error)
# LOG_LEVEL=info
```

---

## How env vars are loaded

Expo loads `.env` automatically via `dotenv`. Values are available in JavaScript as `process.env.GOOGLE_WEB_CLIENT_ID`.

In `src/config/google.ts`:
```ts
export const GOOGLE_WEB_CLIENT_ID = process.env.GOOGLE_WEB_CLIENT_ID ?? ''
```

This is the only file that reads the env var — all other files import from `src/config/google.ts`.

---

## EAS Build (CI/CD)

If you use Expo Application Services (EAS Build), set secrets in the EAS dashboard rather than committing a `.env` file:

```bash
eas secret:create --scope project --name GOOGLE_WEB_CLIENT_ID --value "your-client-id"
```

EAS injects these as environment variables during the build.
