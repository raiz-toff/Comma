# Google Drive Backup

Connecting Google Drive is how you protect your data against a lost phone and keep a phone and a laptop in step. It takes one tap, and by default there is nothing to remember.

The same connection powers both backup and continuous [Cloud Sync](./cloud-sync.md) — they are not separate features. This page covers connecting, restoring, and disconnecting; the sync mechanics live in [Cloud Sync](./cloud-sync.md), and the two security modes in [Encryption](./encryption.md).

---

## Connecting

1. Go to **Settings → Data → Cloud Sync**.
2. Tap **Connect Google Drive**.
3. Sign in with the Google account you want to store your data in, and grant access.

That's the whole setup. Sync switches on the moment the connection succeeds — there is no password step and no second toggle to find.

Comma requests only the `drive.appdata` scope. That gives it a private per-app folder that does not appear in your Drive and that no other app can read. It cannot see your documents, your photos, or anything else in your account.

---

## Where your data goes, and who can read it

By default, your data is stored readable in that private folder, protected the same way everything else in your Drive is — by your Google account. Nothing to memorise, nothing to lose.

If you would rather Google could not read it either, turn on **end-to-end encryption** under **Advanced**. Then your data is encrypted on the device before it leaves, and only a device with your password can read it. The trade-off is absolute: if you forget that password, the cloud copy is unrecoverable. See [Encryption](./encryption.md) for the full picture.

---

## What is included

Everything in your local database:

- Shifts, including saved route paths
- Expenses
- Vehicles and maintenance logs
- Goals
- Platforms
- Tax history
- Profile and preferences (name, country, units, goals, tax rate)

What is not:

- Raw GPS scratch data (the unsimplified location fixes) — large, and worthless once the route is simplified
- Per-device state such as the device ID and sync cursors

---

## Sync schedule

By default Comma syncs about once a day, plus whenever you press **Sync now**. Change it under **Settings → Data → Cloud Sync → Advanced**:

| Option | Behaviour |
|---|---|
| **Manual** | Only when you press Sync now |
| **Daily** (default) | At most once a day |
| **Weekly** | At most once a week |

A pull happens on every app open regardless — that is what makes another device's changes appear.

---

## Restoring or joining from another device

You rarely need a manual restore, because sync is continuous. To bring your data onto a new device, connect it to the **same Google account** and your data flows down — the profile syncs too, so the device comes up already configured.

If you use end-to-end encryption, the new device will ask for your password before it can read anything.

For the step-by-step, see [Moving Between Devices](../guides/moving-devices.md).

---

## Demo mode

While demo data is loaded, connecting Google Drive is blocked and sync is disabled. Sample data never reaches your cloud.

---

## Disconnecting

**Settings → Data → Cloud Sync → Disconnect.**

This removes Comma's access token and stops syncing. Your local database is untouched, and the files already in your Drive stay there until you delete them from your Google account's app-data settings.

---

## Troubleshooting

**Could not connect** — check your connection, then disconnect and reconnect. On Android, make sure a VPN or firewall is not blocking Comma.

**A second device shows no data** — it has nothing to pull until the first device has pushed. On the first device: **Sync now**, then retry on the second.

**It asks for a password you did not set** — the other device has end-to-end encryption on. Enter that password, or turn encryption off on the original device. See [Encryption](./encryption.md).
