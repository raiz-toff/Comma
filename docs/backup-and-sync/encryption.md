# Encryption

Every piece of data Comma sends to Google Drive is encrypted on your device before it leaves. This page explains exactly how.

---

## Summary

| Property | Value |
|---|---|
| Algorithm | AES-256-CBC |
| Key derivation | PBKDF2 (SHA-256, 10,000 iterations) |
| Key input | Your backup passphrase |
| Salt | Random 16 bytes, generated per backup |
| IV | Random 16 bytes, generated per encryption |
| Library | `crypto-js` (JS), `react-native-quick-crypto` (native, hardware-accelerated) |
| Plaintext | UTF-8 JSON string of the database snapshot or change-log |

---

## Key derivation

Comma never stores your passphrase in plaintext. It derives an encryption key using **PBKDF2**:

```
key = PBKDF2(passphrase, salt, 10000 iterations, keyLen=32 bytes, SHA-256)
```

- The salt is randomly generated for every backup or change-log file.
- The salt is stored alongside the encrypted data (in the file header) so decryption can reproduce the same key.
- 10,000 PBKDF2 iterations is the minimum recommended by NIST for HMAC-SHA-256.

---

## Encryption process

```
plaintext  = JSON.stringify(backup data)
salt       = random 16 bytes
iv         = random 16 bytes
key        = PBKDF2(passphrase, salt, 10000, 32, SHA256)
ciphertext = AES-256-CBC encrypt(plaintext, key, iv)

output = base64( salt || iv || ciphertext )
```

The output (base64-encoded) is what gets uploaded to Google Drive.

---

## Decryption process

```
input      = base64 decode(file contents)
salt       = input[0:16]
iv         = input[16:32]
ciphertext = input[32:]
key        = PBKDF2(passphrase, salt, 10000, 32, SHA256)
plaintext  = AES-256-CBC decrypt(ciphertext, key, iv)
data       = JSON.parse(plaintext)
```

The passphrase must match exactly — a single wrong character produces a completely different key and decryption will fail.

---

## Passphrase storage

Your passphrase is stored in your device's secure enclave:

- **iOS**: iOS Keychain (hardware-protected on devices with Secure Enclave)
- **Android**: Android Keystore (TEE-backed on most modern devices)
- **Web**: `localStorage` (less secure — not recommended for sensitive use)

Comma never stores the passphrase in its SQLite database or in plaintext files. The secure enclave is the only copy on the device.

---

## Why the passphrase is unrecoverable

The encryption key is derived entirely from your passphrase + a random salt. Comma does not store the key, does not know your passphrase, and has no server-side copy of either.

If you forget your passphrase:
- Comma cannot recover your encrypted backups.
- Google cannot read the file contents.
- There is no "forgot password" flow.
- The only way to recover from a forgotten passphrase is to have an unencrypted local database (i.e., your current phone works fine, you just can't restore from cloud).

**This is intentional.** A recovery mechanism requires storing something server-side (a key escrow or identity-linked recovery). Comma's privacy guarantee is that we don't run such a server.

**Practical advice:** Write your passphrase in a password manager alongside your other credentials. If you use iCloud Keychain, 1Password, Bitwarden, or similar — put it there.

---

## Passphrase change

Changing your passphrase is not currently supported in-app. The reason: your existing backup and sync change-log files on Drive are encrypted with the old key. Re-encrypting them requires:

1. Downloading every file.
2. Decrypting with the old key.
3. Re-encrypting with the new key.
4. Uploading all files again.

This is technically straightforward but potentially slow for large histories. It will be available in a future version triggered from **Settings → Backup & Sync → Change Passphrase**. Until then, treat your passphrase as fixed at the time of first backup.

---

## What is NOT encrypted

The following data is never uploaded to cloud and therefore never encrypted:

- Your local SQLite database (stored in the app sandbox, protected by OS-level app isolation)
- GPS route data in the active shift (`locationPoints`, `tempNativePoints` tables — excluded from backup and sync)
- Receipt photos (stored as local files, not included in backup uploads)

---

## Security considerations

**Threat: someone gains physical access to your phone.**
- The passphrase is in the secure enclave — not easily extractable.
- The local SQLite file is in the app sandbox — not accessible without a jailbreak/root.
- Mitigation: use your device's biometric lock.

**Threat: someone gains access to your Google account.**
- They would see encrypted `.comdb` and `.cmlog` files in Drive's `appDataFolder`.
- They cannot read the contents without your passphrase.
- Mitigation: use a strong Google account password and enable 2FA.

**Threat: Comma's servers are breached.**
- Comma has no servers. There is nothing to breach.
- The only data Comma handles is on your device and in your own Google Drive.

**Threat: a malicious app update.**
- A compromised app update could log keystrokes or exfiltrate data during decryption.
- Mitigation: install from official channels (App Store, Play Store) and review open-source code before building from source.

---

## Open source

Comma's encryption implementation is open source. The relevant files are:

- [`src/services/cryptoHelper.ts`](../../src/services/cryptoHelper.ts) — AES encrypt/decrypt, PBKDF2 key derivation
- [`src/services/backupPassword.ts`](../../src/services/backupPassword.ts) — Passphrase storage (Secure Store abstraction)
- [`src/services/googleDrive.ts`](../../src/services/googleDrive.ts) — Backup upload, download, and token management

You can audit, fork, and build from source. The encryption is not proprietary.
