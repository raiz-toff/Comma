# Settings

A complete reference to every setting in Comma, organized by tab, with the differences between the phone app and the web app called out.

---

## Where settings live

The phone app groups settings into five tabs — You, Appearance, Platforms, Alerts, and Data — with a single **Save** button that commits every change at once. The web app uses six accordion cards — You, Appearance, Platforms, Alerts, Data, and About — and saves as you go.

The two apps share the same underlying settings and sync them through your Google Drive, so a change made on one device reaches the other. A handful of options exist only on the web app, where a larger screen makes them worthwhile; those are marked below.

---

## You

Your profile, the current market, and the optional features that decide how large the app is.

| Setting | Values | Notes |
|---|---|---|
| Demo mode card | Exit demo | Shown only while the app is running on sample data. Exiting clears the demo records and starts your real vault. |
| Name | Free text | Used in greetings and on exported reports. |
| Country | Canada | Canada is the only enabled market. The field is shown for clarity but has no other choice today. |
| Province | Ontario and other Canadian provinces | Sets the provincial tax preset. Ontario is the fully defined province; others fall back to sensible defaults. |
| Distance unit | km (read-only) | Derived automatically from the country. Canada uses kilometres, so the unit is fixed and cannot be edited. |

### Optional Features

Toggles that switch whole screens on or off. See [Feature flags](feature-flags.md) for what each one gates.

| Feature | Default | Effect |
|---|---|---|
| Analytics Tab | On | Advanced analytics screen. |
| Tax Tab | On | Tax workspace and estimates. |
| Goals Screen | On | Goals, badges, and streaks. Turning this off also removes badges and streaks, which depend on it. |
| Schedule Screen | Off | Shift scheduling screen. |
| PDF Export | Off | PDF report export inside Reports. |

---

## Appearance

How the app looks. On the web app this tab also carries typography and layout controls.

| Setting | Values | Default | Platform |
|---|---|---|---|
| Theme | Auto, Light, Dark | Dark | Phone and web |
| Accent color | 12 swatches | — | Phone and web |
| Currency | Locked to the country | CAD | Phone (locked) |
| Currency | USD, CAD, EUR, GBP, AUD | CAD | Web only |
| Week starts | Sunday, Monday | — | Phone and web |
| Time format | 12-hour, 24-hour | — | Phone and web |
| Font size | S, M, L, XL | M | Web only |
| Layout density | Comfortable, Compact | Comfortable | Web only |
| Date format | Locale-based options | — | Web only |

On the phone app the currency follows the country and cannot be changed. The web app allows an independent currency choice for drivers who want their figures displayed in a different currency.

---

## Platforms

Enable the apps you drive for and set your per-platform defaults. See [Platforms](platforms.md) for the built-in list.

| Setting | Values | Notes |
|---|---|---|
| Enable platform | On, off | Only enabled platforms appear in the shift form, filters, and analytics. |
| Default hourly pay | Amount in CAD | Your target hourly rate for that platform, used in hourly-rate widgets. |
| Default per-km mileage rate | Amount in CAD | Per-kilometre rate for that platform. Overrides the country default when set. |
| Sort priority | Order | Controls where the platform sits in the picker. |

### Custom platforms

Create a platform that is not built in by supplying a **name**, a **color**, and an **emoji**. Custom platforms behave exactly like built-in ones across the shift form, filters, and analytics.

---

## Alerts

Seven notification toggles. See [Notifications](notifications.md) for what triggers each one.

| Toggle | Default |
|---|---|
| Shift reminders | On |
| Goal achievements | On |
| Tax filing alerts | On |
| Weekly digest | Off |
| Vehicle maintenance | On |
| Insurance expiry | On |
| Sync reminder | On |

---

## Data

Backup, import and export, a health check, and the destructive actions.

| Setting | Action | Notes |
|---|---|---|
| Cloud Sync | Configure | Google Drive backup and two-way sync. See [Cloud sync](../backup-and-sync/cloud-sync.md). |
| Export CSV | Shifts, expenses | Writes your records to a spreadsheet-friendly file. |
| Import CSV | Shifts, expenses | Bulk-imports historical records from a spreadsheet. |
| Data health check | Run | Scans the vault for inconsistencies and reports what it finds. |

### Danger Zone

Both actions are gated behind biometric confirmation and cannot be undone.

| Action | Scope |
|---|---|
| Reset platform data | Clears records for a single platform on this device. |
| Reset entire vault | Clears every record on this device. |

A reset wipes the device only. It never touches the copy held in your Google Drive, so a device that still has sync configured can restore from the cloud. See [Delete data](../delete-data.md).

---

## About (web only)

The web app adds an About card with the app version, links, and the [Keyboard shortcuts](keyboard-shortcuts.md) reference. The phone app surfaces the equivalent information within Settings rather than as a separate tab.
