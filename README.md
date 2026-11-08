<p align="center">
  <img src="marketing/final/web/github-banner-1280x400.png" alt="Comma — track every shift, keep every byte" width="100%" />
</p>

# Comma

[![Latest release](https://img.shields.io/github/v/release/raiz-toff/CommaApp)](https://github.com/raiz-toff/CommaApp/releases/latest)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

Android earnings tracker for gig drivers in Canada. Tracks shifts, mileage, expenses, and gives tax estimates. Everything stays on your phone — no account, no cloud unless you want it.

Built for DoorDash, Uber Eats, SkipTheDishes, Instacart, Amazon Flex, and others.

**[Download for Android](https://github.com/raiz-toff/CommaApp/releases/latest)** · **[Privacy policy](https://comma-docs.vercel.app/privacy)**

## Screenshots

<table width="100%">
  <tr>
    <td width="33%" align="center">
      <strong>Dashboard</strong><br/>
      <img src="docs/images/phone/dashboard.jpg" alt="Dashboard showing weekly net earnings, shift time, distance driven and hourly rate" /><br/>
      <em>Weekly net at a glance — earnings, hours, kilometres, and your real hourly rate.</em>
    </td>
    <td width="33%" align="center">
      <strong>Shift Details</strong><br/>
      <img src="docs/images/phone/shift-details.jpg" alt="Shift details with GPS route map, duration, hourly rate and distance" /><br/>
      <em>Every tracked shift keeps its GPS route, duration, rate, distance, and tips.</em>
    </td>
    <td width="33%" align="center">
      <strong>Platforms &amp; Vehicles</strong><br/>
      <img src="docs/images/phone/platform-switcher.jpg" alt="Platform and vehicle switcher with DoorDash selected" /><br/>
      <em>Filter everything by platform, and switch between your car, scooter, or e-bike.</em>
    </td>
  </tr>
  <tr>
    <td width="33%" align="center">
      <strong>Expenses</strong><br/>
      <img src="docs/images/phone/expenses.jpg" alt="Expenses screen with monthly total, weekly chart and tax-deductible transactions" /><br/>
      <em>Log costs as you go — deductible items are flagged and totalled for tax time.</em>
    </td>
    <td width="33%" align="center">
      <strong>Goals</strong><br/>
      <img src="docs/images/phone/goals.jpg" alt="Weekly revenue goal thermometer with monthly and yearly goals" /><br/>
      <em>Weekly, monthly, and yearly revenue targets with live progress.</em>
    </td>
    <td width="33%" align="center">
      <strong>Reports &amp; Export</strong><br/>
      <img src="docs/images/phone/reports-export.jpg" alt="Monthly report with gross revenue, net earnings, shifts and CSV export actions" /><br/>
      <em>Monthly summaries, plus one-tap CSV exports of shifts and expenses.</em>
    </td>
  </tr>
  <tr>
    <td width="33%" align="center">
      <strong>Vehicles</strong><br/>
      <img src="docs/images/phone/vehicles.jpg" alt="Vehicle list with a car, scooter and e-bike" /><br/>
      <em>Manage your fleet — mileage and costs are tracked per vehicle.</em>
    </td>
  </tr>
</table>

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
./build.sh
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

Fix a bug, open a PR. Keep TypeScript strict — no `any`. DB queries go through Drizzle, no JS array processing on DB results. Details in [CONTRIBUTING.md](CONTRIBUTING.md) and [docs/development/](docs/development/).

## License

[MIT](LICENSE)
