# Backup file format

What is actually inside a Comma vault backup — the `.json` file the app writes when you export your data, and what happens to it when you import it back.

<LayerStack accent="amber" layers={[{ name: "exportedAt", note: "when the file was written" }, { name: "schemaVersion", note: "which format generation" }, { name: "tables", note: "every row of your vault" }, { name: "integrity", note: "a hash + row counts" }]} caption="A backup is one JSON object with four top-level keys. Everything a driver has logged lives under tables; the other three describe and protect it." />

---

Exporting a backup gives you a single file that holds your **entire** vault. It is a plain-text
JSON file — you can open it in any editor and read it. This page describes the web app's format.

## The shape

```json
{
  "exportedAt": "2026-07-13T21:40:00.000Z",
  "schemaVersion": 6,
  "tables": {
    "shifts": [ /* … row objects … */ ],
    "expenses": [ /* … */ ],
    "vehicles": [ /* … */ ]
    // …every other table
  },
  "integrity": {
    "sha256": "3f9a…c17",
    "rowCounts": { "shifts": 214, "expenses": 63, "vehicles": 2 }
  }
}
```

## The four keys

### `exportedAt`

An ISO 8601 timestamp of the moment the file was written. Informational only — nothing keys off
it on import.

### `schemaVersion`

Which generation of the format the file uses. The current version is **6**. On import, Comma
compares it to the version the app itself understands:

| File's `schemaVersion` | What happens on import |
|---|---|
| Equal or one behind (≥ 4) | Read as-is. |
| Old (≤ 3) | A pre-interop web export. Converted row by row on the way in — older files stored money in integer **cents** and a few fields under different names, so they are rewritten to today's shape. |
| Newer than the app | Rejected. You are asked to update Comma first, because a file from a newer app may contain fields this one would silently drop. |

### `tables`

Your data. An object keyed by table name, where each value is an array of that table's rows. The
export writes **every** table for full fidelity — not only the ones that sync — so a round-trip
(export, then import into a fresh vault) loses nothing. The tables a driver's records live in:

| Table | Holds |
|---|---|
| `shifts` | Every logged shift. See [Shift fields](shift-fields.md). |
| `expenses` | Every expense. See [Expense fields](expense-fields.md). |
| `shiftPlatforms` | The per-platform split of a multi-app shift. |
| `vehicles` | Your vehicles and their cost settings. |
| `vehicleMaintenanceLogs` | Service and maintenance entries. |
| `vehicleTaxProfiles` | Per-vehicle, per-year tax settings. |
| `goals` | Earnings and activity goals. |
| `taxHistory` | Snapshots of your tax settings over time. |
| `merchants` | Saved expense merchants. |

The file also carries the supporting tables — your platforms, notifications, gamification
(badges, XP, challenges) and app state — so the app you restore into comes back exactly as it was.

### `integrity`

A tamper- and corruption check.

- **`sha256`** — a SHA-256 hash of the `tables` block. On import Comma re-hashes the tables it
  reads and refuses any file whose hash does not match, since that means the file was truncated
  or edited. Backups exported before this field existed carry no hash and are accepted as-is.
- **`rowCounts`** — how many rows each table had when the file was written, so you (or the app)
  can sanity-check that nothing was lost.

## Importing a backup

The step-by-step flow — where the buttons are on each app — lives in
[Moving between devices](../guides/moving-devices.md). Two things about the file itself are worth
repeating here:

- **Importing replaces the target vault.** The file's contents overwrite whatever is on the
  device you import into. Import into a fresh or expendable vault, never one that still holds
  records you need.
- **Phone and web use different backup formats.** A file exported from the web app will not import
  on the phone, and vice versa. To move data between phone and web, use
  [Cloud Sync](../backup-and-sync/cloud-sync.md), not a backup file.

For CSV files — a spreadsheet of individual records rather than a whole-vault snapshot — see
[Import from a spreadsheet](../guides/import-csv.md) instead.
