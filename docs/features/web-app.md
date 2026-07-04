# Web App (PWA)

Comma runs as an installable Progressive Web App (PWA) in the browser at **[comma-psi.vercel.app](https://comma-psi.vercel.app)** — a companion to the native phone app for logging and reviewing your work from a laptop or desktop. It shares Comma's data model, look, and features, with the differences noted below.

For how it compares to the phone app at a glance, see the [FAQ](../getting-started/faq.md#web-app-vs-phone-app).

---

## Installing the web app

Open the Comma web app at [comma-psi.vercel.app](https://comma-psi.vercel.app) in a modern browser, then install it so it runs in its own window and works offline:

- **Chrome / Edge (desktop):** click the install icon in the address bar, or menu → **Install Comma**.
- **Chrome (Android):** menu → **Add to Home screen** / **Install app**.
- **Safari (iOS):** Share button → **Add to Home Screen**.

You can also start the install from **Settings → About → Install COMMA**.

Once installed, Comma launches like a native app, keeps its own window, and loads instantly even offline.

---

## What works the same

Everything you'd expect from the phone app's non-GPS features works in the browser:

- Live shift timers and manual shift logging
- Expenses and categorization
- Tax Center estimates
- Goals, streaks, and gamification
- Analytics, reports, and platform breakdowns
- Multiple vehicles and platforms
- Google Drive backup and restore

---

## What's different from the phone app

### GPS mileage tracking

The native background GPS engine does **not** run in a browser — browsers throttle or suspend location access for backgrounded tabs, so continuous tracking isn't reliable. In the web app, **enter mileage manually** when you save a shift (odometer start/end, or a known trip distance).

If you want automatic route tracking, use the phone app for driving and the web app for review. See [Mileage Tracking](./mileage-tracking.md).

### Data storage

The web app stores your vault in the browser (IndexedDB / local storage) rather than an on-device SQLite file. It's still local-first and private — nothing is sent to a server. Because it lives in the browser, clearing site data or switching browsers means that vault won't follow you; keep a [Google Drive backup](../backup-and-sync/overview.md).

### Separate vault from the phone app

The web app and phone app are **separate local vaults** and don't sync automatically yet. Move data between them with a backup/restore or export/import. Continuous [Cloud Sync](../backup-and-sync/cloud-sync.md) is in development.

---

## Web-only conveniences

### Offline support

Once loaded, the PWA works fully offline. Updates apply on reload — if you see an old version, close all Comma windows and reopen (see [Troubleshooting](../getting-started/troubleshooting.md#the-web-app-is-showing-an-old-version-web-app)).

### Deferred exports (background sync)

If you export while offline, the web app queues the export and completes it automatically once you're back online.

### Keyboard shortcuts

The web app supports keyboard shortcuts for power users — for example **Ctrl/Cmd + K** or **/** to open search, and **Esc** to close overlays. See the full list in **Settings → About → Keyboard shortcuts**.

### Fullscreen & focus modes

On supported browsers you can go fullscreen and toggle focus ("Zen") mode to cut distractions while you review your numbers.

### Notifications

Where the browser permits, the web app can show notifications (e.g. goal reminders). Grant the permission when prompted to enable them.

---

## Moving data between web and phone

Both apps read the same backup format:

1. On the source app, make a [Google Drive backup](../backup-and-sync/google-drive-backup.md) (or export a vault file).
2. On the target app, restore that backup (or import the file).

Remember a restore **replaces** the target's data, so restore onto a fresh install or one you're happy to overwrite.

---

## Next steps

- [FAQ](../getting-started/faq.md) — Common questions about both apps
- [Troubleshooting](../getting-started/troubleshooting.md) — Web-specific fixes
- [Backup & Sync Overview](../backup-and-sync/overview.md) — Protect and move your data
