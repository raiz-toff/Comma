# Project Structure

An annotated map of the Comma monorepo: the Android/Expo phone app at the root, the web PWA under `web/`, these docs under `docs/`, and the docs site under `docs-site/`.

<LayerStack accent="indigo" layers={[{ name: "/", note: "the Expo phone app" }, { name: "web/", note: "the vanilla-JS PWA" }, { name: "docs/", note: "these pages — the source of truth" }, { name: "docs-site/", note: "the Fumadocs site that renders them" }]} caption="One monorepo, four parts. The phone app lives at the root because Expo expects to." />

---

## Top level

```
Comma/
├── app/                 # Phone app — Expo Router routes (screens)
├── components/          # Phone app — top-level shared components
├── src/                 # Phone app — application source
├── store/               # Phone app — Zustand stores
├── hooks/               # Phone app — cross-cutting hooks
├── providers/           # Phone app — React context providers
├── modules/             # Phone app — native Expo modules (Kotlin/Swift)
├── utils/               # Phone app — shared utilities
├── assets/              # Phone app — icons, fonts, images
├── android/             # Generated native Android project (untracked)
├── ios/                 # Generated native iOS project (untracked)
│
├── web/                 # The web PWA (vanilla JS, Dexie, hash router)
├── docs/                # These documentation pages (Markdown source)
├── docs-site/           # Fumadocs (Next.js) site that renders docs/
├── scripts/             # Repo scripts (release, country parity, tooling)
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
│   ├── analytics.tsx    # Analytics (flag-gated)
│   ├── tax/             # Tax center
│   └── more.tsx
├── setup/               # Activation-checklist screens (platforms, vehicle, goal)
├── shift/, shifts/      # Create and detail/edit a shift
├── expense/             # Create and detail/edit an expense
├── vehicles/, goals/, tax/, reports/, schedule/
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
│   ├── gamification.ts      # XP, badges, streaks
│   ├── notify.ts            # Local notifications
│   ├── permissions/         # Location-access permission flow
│   ├── onboarding/          # activationChecklist.ts, firstShift.ts
│   └── sync/                # Change-log cloud-sync engine (see below)
│
├── registry/
│   ├── countries/           # Country tax rules, mileage, provinces
│   │   ├── index.ts         # THE registry — only CA is registered
│   │   ├── CA/              # Canada: index.ts, provinces/, tax/
│   │   ├── US/, UK/, NP/    # Written but deliberately unregistered
│   │   └── mileageRates.ts
│   ├── platforms/           # Built-in gig platforms by country
│   ├── operationalModels/, badges/, market/
│   └── expenseCategories.ts
│
├── components/              # Reusable React Native components (ui/, widgets/, shifts/…)
├── hooks/                   # usePlatformTheme, useFeatureEnabled, useVocabulary…
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
├── useSettingsStore.ts # Profile, preferences, gamification
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

## `web/` — the web PWA

```
web/
├── build.js            # esbuild dev/prod build
├── package.json        # dev = node build.js --dev, build = --prod
├── src/
│   ├── main.js         # Entry + hash router
│   ├── core/
│   │   └── gps-tracker.js   # Foreground/tab-open GPS tracker
│   ├── services/sync/  # Change-log cloud-sync engine (mirrors src/services/sync)
│   ├── registry/
│   │   └── countries/  # CA.country.js (registered), US/UK written, index.js
│   ├── modules/        # Feature modules (onboarding, backup, tax, goals, …)
│   ├── css/, ui/, views/, libs/, utils/
├── public/, icons/     # Static assets, manifest, service worker source
└── dist/               # Build output
```

---

## `docs/` and `docs-site/`

```
docs/                   # Markdown source for these pages
├── getting-started/, guides/, reference/
├── features/, backup-and-sync/
├── architecture/, development/
└── index.md, privacy.md, delete-data.md

docs-site/              # Fumadocs (Next.js) renderer
├── scripts/sync-content.mjs   # Copies docs/ into the site before dev/build
└── package.json               # dev = sync + next dev
```

---

## `scripts/`

| Script | Purpose |
|---|---|
| `check-country-parity.mjs` | Verifies the phone and web country registries agree |
| `submit-play.mjs` | Uploads an AAB to Google Play |
| `start-valhalla.sh`, `test-valhalla-matching.sh` | Routing/map-matching tooling |
