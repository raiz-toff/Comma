# Comma

Earnings tracker for gig workers. Tracks shifts, mileage, expenses, and gives tax estimates. Everything stays on your phone — no account, no cloud unless you want it.

Built for DoorDash, Uber Eats, SkipTheDishes, Instacart, Amazon Flex, and others.

## Stack

- Expo SDK 56 + Expo Router
- SQLite via Drizzle ORM
- Zustand + TanStack React Query
- NativeWind v4

## Running locally

```bash
npm install
npx expo start
```

For an Android APK:

```bash
./build-android.sh
```

You need the Android SDK. Set the path in `android/local.properties`:

```
sdk.dir=/path/to/android-sdk
```

## Google Drive backup (optional)

Create a Web OAuth client in Google Cloud Console and add your client ID to `.env`:

```
GOOGLE_WEB_CLIENT_ID=your-client-id
```

See `.env.example`.

## Contributing

Fix a bug, open a PR. Keep TypeScript strict — no `any`. DB queries go through Drizzle, no JS array processing on DB results.

## License

MIT
