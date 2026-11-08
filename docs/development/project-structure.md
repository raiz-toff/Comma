# Project Structure

An annotated map of the Comma repository: an Android app built with Expo, plus the static legal pages the Play Store links to.


---

## Top level

```
Comma/
├── app/                 # Expo Router routes (screens)
├── components/          # top-level shared components
├── src/                 # application source
├── store/               # Zustand stores
├── hooks/               # cross-cutting hooks
├── providers/           # React context providers
├── modules/             # native Expo modules (Kotlin/Swift)
├── utils/               # shared utilities
├── assets/              # icons, fonts, images
├── android/             # Generated native Android project (untracked)
├── ios/                 # Generated native iOS project (untracked)
│
├── docs/development/    # Developer notes (this folder)
├── legal/               # Privacy policy + data-deletion pages (served at /privacy, /delete-data)
├── scripts/             # Repo scripts (versioning, Play upload)
├── plans/               # Internal implementation plans
│
├── app.json             # Expo config: bundle id, version, plugins, permissions
├── build.sh             # Android APK/AAB build script
├── eas.json             # EAS build/submit profiles
├── package.json         # Phone app dependencies and scripts
├── tsconfig.json        # TypeScript (strict)
├── tailwind.config.js   # NativeWind theme
├── metro.config.js      # Metro bundler config
└── .env.example         # Environment variable template
```

---

## `app/` — phone routes

Expo Router maps this folder to screens. See [Navigation](../architecture/navigation.md) for the full route table.

```
app/
├── _layout.tsx          # Root layout (providers, global init)
├── (tabs)/              # Main shell: drawer + hidden tabs + Reports overlay
│   ├── index.tsx        # Dashboard + onboarding gate
│   ├── shifts/          # Shifts list
│   ├── expenses/        # Expenses list
│   ├── analytics.tsx    # Analytics (plain number list)
│   ├── tax/             # Tax center
│   └── more.tsx
├── setup/               # Activation-checklist screens (platforms, vehicle, goal)
├── shift/, shifts/      # Create and detail/edit a shift
├── expense/             # Create and detail/edit an expense
├── vehicles/, goals/, tax/, reports/
├── settings/            # index, backup, profile, import
├── about/, notifications.tsx
└── docs/                # Internal design notes (Markdown, not routes)
```

---

## `components/` — phone top-level components

```
components/
├── ActivationChecklist.tsx  # Deferred-setup card on the dashboard
├── OnboardingWizard.tsx     # Welcome gate + two-step onboarding
├── OnboardingSteps.tsx      # The onboarding step screens
└── ErrorBoundary.tsx        # Global React error boundary
```

---

## `src/` — phone application source

```
src/
├── database/
│   ├── schema.ts            # Drizzle table definitions (source of truth)
│   ├── client.ts            # SQLite init + migrations
│   ├── queries/             # Query helpers, grouped by domain
│   ├── syncedWrites.ts      # syncedInsert/Update/Delete (stamp sync columns)
│   ├── syncState.ts         # Sync cursor + enablement
│   └── syncedTables.ts      # Which tables participate in sync
│
├── services/
│   ├── googleDrive.ts       # OAuth + Drive appDataFolder I/O
│   ├── cryptoHelper.ts      # End-to-end encryption (AES-256-GCM, PBKDF2)
│   ├── cryptoEnvelope.ts    # Envelope format (plain vs encrypted)
│   ├── backupFile.ts        # Local export/restore
│   ├── inbox.ts             # In-app notification inbox + tax-deadline reminders
│   ├── notify.ts            # Push to the inbox from anywhere
│   ├── permissions/         # Location-access permission flow
│   ├── onboarding/          # activationChecklist.ts, firstShift.ts
│   └── sync/                # Change-log cloud-sync engine (see below)
│
├── registry/
│   ├── countries/           # Country tax rules, mileage, provinces
│   │   ├── index.ts         # THE registry — only CA is registered
│   │   ├── CA/              # Canada: index.ts, provinces/, tax/ (only country)
│   │   └── mileageRates.ts
│   ├── platforms/           # Built-in gig platforms by country
│   ├── operationalModels/, market/
│   └── expenseCategories.ts
│
├── components/              # Reusable React Native components (ui/, shifts/…)
├── hooks/                   # usePlatformTheme, useVocabulary…
├── theme/                   # Design tokens (colors)
└── lib/                     # Pure utilities (geo, polyline, error handler)
```

### `src/services/sync/`

```
sync/
├── syncNow.ts          # Orchestrator (pull + push)
├── pushChanges.ts      # Build and upload a change-log
├── pullChanges.ts      # Download and apply change-logs
├── applyChangeLog.ts   # Transaction-based merge
├── mergeRules.ts       # Last-write-wins + financial overwrite log
├── changeLog.ts        # Change-log type and serialization
├── schedule.ts         # Manual / daily / weekly schedule
└── compaction.ts       # Collapse many logs into a snapshot
```

---

## `store/` and `hooks/`

```
store/
├── useActiveShift.ts   # Live shift state (timer, distance, pause)
├── useSettingsStore.ts # Profile, preferences, notification inbox
└── demoRoutes.ts       # Demo-mode sample routes

hooks/
├── useGPSTracking.ts   # Permission ladder, start/stop native GPS, poll distance
├── useAutoSync.ts      # AppState listener → pull/push
├── useWakeLock.ts      # Keep the CPU awake during a shift
└── useFeatureEnabled.ts, useNotificationRouting.ts, …
```

---

## `modules/comma-tracker/` — native GPS module

```
modules/comma-tracker/
├── android/            # Kotlin foreground service + location tracking
├── ios/                # Swift background location task
└── src/                # TypeScript bridge (startTracking, stopTracking, …)
```

---

## `scripts/`

| Script | Purpose |
|---|---|
| `submit-play.mjs` | Uploads an AAB to Google Play |
