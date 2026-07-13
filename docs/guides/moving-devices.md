# Move Comma to another device

Carry your vault to a new phone, or run the same data on a phone and a laptop at once.

<VaultFlow accent="emerald" nodes={["Old phone", "New phone or laptop"]} hub="Your Google Drive" caption="One Google account on both devices and the vault flows across. The backup file is the offline fallback — and importing one replaces the target vault." />

---

## The recommended path: Cloud Sync

Connecting two devices to the same Google account is the whole job. Your data flows between them automatically, and because your profile syncs too, the new device comes up already configured — there is no setup wizard to repeat.

On each device: **Settings → Data → Cloud Sync → Connect Google Drive**, signing in with the **same** Google account on both.

If you use end-to-end encryption, the new device pulls down files it can't read yet and asks for your password. Enter it once and both devices are aligned. See [Encryption](../backup-and-sync/encryption.md).

---

### To a new phone

1. Install Comma on the new phone — see [Install Comma](./install.md).
2. On the welcome screen, choose **Restore or sync existing data** instead of Get started.
3. Connect the **same** Google account you used on the old phone.
4. Wait for the first pull to finish. Your shifts, expenses, goals, and profile arrive together.

If the new phone reports "No synced data found yet", the old phone hasn't pushed recently. On the old phone: **Settings → Data → Cloud Sync → Sync now**, then retry.

### Between phone and laptop

1. Open [comma-psi.vercel.app](https://comma-psi.vercel.app) and, optionally, install the PWA — see [Install Comma](./install.md).
2. **Settings → Data → Cloud Sync → Connect Google Drive**, using the **same** Google account as the phone.
3. The web app pulls your vault down and stays in step from then on.

The full mechanics are in [Cloud Sync](../backup-and-sync/cloud-sync.md).

---

## The alternative path: a backup file

If you would rather not use Cloud Sync, you can move a vault by hand:

1. On the source app, export a backup file.
2. On the target app, import it.

The backup is a single JSON file holding your whole vault; if you want to know exactly what it
contains, see [Backup file format](../reference/backup-format.md).

Two cautions before you do:

- **The phone and web apps use different backup file formats.** A file exported on one will not import into the other — use Cloud Sync to cross between phone and web.
- **Importing REPLACES the target vault.** Whatever is on the target device is overwritten by the file's contents, so import into a fresh or expendable vault, never one that still holds data you need.

---

## Which path to choose

| | Cloud Sync | Backup file |
|---|---|---|
| Ongoing | Both devices stay in step | A one-time snapshot |
| Phone and web | Works across both | Formats differ — not portable |
| Setup | Sign in on both | Export, then import |
| On the target | Changes merge | The vault is replaced |

For most moves, Cloud Sync is the answer. Reach for a backup file when you specifically want a manual, offline transfer.

---

## Related

- [Cloud Sync](../backup-and-sync/cloud-sync.md) — how the sync underneath this works
- [Encryption](../backup-and-sync/encryption.md) — the password prompt on a new device
