# Encryption

Everything Comma syncs to your Google Drive is end-to-end encrypted. There is no readable mode and no toggle to find: the moment you turn on Cloud Sync you set a **backup password**, and only that password can read the cloud copy — not Google, not Comma, not anyone who gets hold of the files.

<StatRow accent="indigo" items={[{ value: "AES-256-GCM", label: "cipher, authenticated" }, { value: "210,000", label: "PBKDF2 iterations" }, { value: "per file", label: "random salt and IV" }, { value: "never", label: "the key is written or uploaded" }]} caption="Your backup password is the only key to the cloud copy. Comma cannot recover it — if you forget it, the old cloud copy is mathematically gone, though the data on your device is untouched." />

---

## One password, always on

There is no unencrypted cloud mode to choose. When you connect Google Drive, Comma asks you to set a backup password before anything is uploaded, and refuses to push a single file without one. Every file that reaches Drive is encrypted on your device first.

| | |
|---|---|
| **What's on Drive** | Ciphertext only — never your readable data |
| **Who can read it** | You, with the backup password |
| **New device setup** | Sign in to Google, then enter the same backup password |
| **If you forget the password** | The cloud copy is unreadable — but your device's data is safe (see below) |
| **Protects against** | A lost, stolen, or dead phone — and Google itself |

Files live in your Drive's `appDataFolder` — a private per-app folder that doesn't show up in your Drive and that no other app can read. Comma has no server and receives nothing.

---

## What it actually does

Every file Comma writes to Drive is encrypted on your device before it leaves:

| | |
|---|---|
| **Cipher** | AES-256-GCM — authenticated, so tampering is detected, not just decryption failure |
| **Key derivation** | PBKDF2-HMAC-SHA256, **210,000** iterations |
| **Salt** | Random, per file |
| **IV** | Random, per file |
| **Where the key lives** | Derived from your password on demand. Never written to disk, never uploaded. |

The password is never stored in any form Comma can read back. It can't check it against a hash — it simply tries to decrypt, and a wrong password produces data that fails the authentication tag.

### The envelope

Every synced file is a JSON envelope, so a device can tell at a glance whether it can read it:

```jsonc
{ "v": 2, "enc": "aes-256-gcm", "kdf": "pbkdf2-sha256",
  "iter": 210000, "salt": "…", "iv": "…", "tag": "…", "content": "…base64 ciphertext…" }
```

A device that meets an envelope it can't decrypt doesn't crash or silently skip it — it reports that the backup password is needed and asks you. (Older vaults written before encryption became mandatory may still hold a plain `"enc": "none"` envelope; Comma still reads those, but never writes one.)

---

## The backup password

You set it once, as part of turning on Cloud Sync. Two things about it never change:

- **You need it on every device.** It belongs to your vault, not to one phone. A second device has to enter the same password before it can read anything you've synced.
- **Comma cannot email you a new one.** There is no recovery, because a system that could rescue you here would be a system where somebody else holds a key. If you forget it, see [Forgetting the password](#forgetting-the-password) below — your device's data is still safe.

Comma keeps one small record of the password in your Drive — a `comma-vault.json` manifest that stores a verifier, not the password itself. It lets any device tell the difference between "this account already has a password, enter it" and "this is a brand-new vault, set one" — the two look identical otherwise, and getting them confused is how a vault would fork into two halves nobody can merge.

---

## A second device

Sign in to the same Google account. The new device reads the manifest, sees the vault already has a password, and asks you to **enter it**. Type it once and both devices are aligned.

If the password is wrong, Comma tells you so rather than uploading anything — and it **pauses the push** until the passwords agree. This is deliberate: pushing your data under a different password would split the vault into two encrypted streams that can never be reconciled. Nothing is lost while it waits; you either enter the right password, or use the forgotten-password reset below.

---

## Changing the password

**Settings → Data → Cloud Sync → Advanced → Backup password → Change.**

Comma sets the new password, re-stamps the vault manifest, and your other devices will need the new password to keep syncing. Make sure your devices are synced first, so nothing that only exists on one of them is left behind.

---

## Forgetting the password

If you no longer have the password, the cloud copy is unreadable — but the data on your device is not encrypted with it, so **you have not lost your records**. On the device that still has your data:

**Settings → Data → Cloud Sync → "Forgot your password?"**

Comma confirms your identity, then rebuilds the cloud copy from this device under a new password. What happens is spelled out on screen before you commit:

- The data on this device is kept — nothing here is erased.
- The old, unreadable cloud backup is deleted.
- Changes that were only on another device and never synced here are lost.
- Your other devices will need the new password to sync again.

If no device still has the data, the cloud copy cannot be recovered and you start fresh. That is what end-to-end encryption means.

---

## What isn't encrypted

**Your local database** — on neither the phone nor the browser. The operating system protects it instead: Android app-private storage isn't readable by other apps, and a locked phone's disk encryption covers it.

**A backup file you export yourself** — the `.json` file from **Export data** is plain, readable JSON that you hold, not an encrypted sync file. Keep it somewhere safe. See [Backup file format](../reference/backup-format.md).

**Metadata on Drive** — Google can see that files exist, when, and how big. It cannot see what's inside them.

**Raw GPS scratch data** — never leaves the device at all.

---

## Threat model, honestly

| Threat | What happens |
|---|---|
| Someone takes your **unlocked** phone | Exposed — the local vault is plaintext, encryption only covers the cloud copy |
| Someone takes your **locked** phone | OS-protected |
| Google is compelled to hand over your Drive | Unreadable without your backup password |
| A Comma server is breached | No server exists |
| Comma's developers go rogue | They receive nothing |
| You forget your password | The cloud copy is lost, but your device's data is safe — reset the cloud and re-upload |

Read the first row twice. Encryption covers the **cloud copy**, not a device that's physically taken while unlocked — the local database is plaintext regardless.

---

## In the source

- `src/services/cryptoEnvelope.ts` — the envelope format
- `src/services/cryptoHelper.ts` / `cryptoHelper.native.ts` — key derivation and AES-GCM
- `src/services/sync/vaultManifest.ts` — the `comma-vault.json` password verifier
- `web/src/modules/backup/cryptoEnvelope.js` — the web mirror, byte-compatible with the phone
