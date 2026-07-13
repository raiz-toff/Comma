# Encryption

Comma has two modes for cloud data. The distinction is not a settings detail — it decides who can read your records, and what happens if you forget something.

**The password is the mode.** If you have set one, your data is end-to-end encrypted. If you haven't, it isn't. There is no third state.

<StatRow accent="indigo" items={[{ value: "AES-256-GCM", label: "cipher, authenticated" }, { value: "210,000", label: "PBKDF2 iterations" }, { value: "per file", label: "random salt and IV" }, { value: "never", label: "the key is written or uploaded" }]} caption="The password is the mode. Set one and only you can read the cloud copy — including if you forget it, in which case it is mathematically gone." />

---

## The two modes

| | Default — no password | End-to-end — opt-in |
|---|---|---|
| **What's on Drive** | Your data, readable | Ciphertext |
| **Who can read it** | You, and Google | Only you |
| **New device setup** | Sign in to Google | Sign in, then enter your password |
| **If you forget the password** | Nothing to forget | **Cloud data gone. Permanently.** |
| **Protects against** | A lost, stolen, or dead phone | All of that, plus Google itself |
| **Analogy** | A WhatsApp cloud backup | A password-protected archive |

Both modes store data in your Drive's `appDataFolder` — a private per-app folder that doesn't show up in your Drive, that no other app can read. In both modes, Comma has no server and receives nothing.

---

## Which should you pick

**The default, almost certainly.**

The threats a driver actually faces are: the phone gets stolen, the phone dies, the phone is replaced. The default protects against all three, and it never locks you out of your own records.

Choose end-to-end encryption only if "Google could technically read this" is a line you won't cross — and you are genuinely confident you won't lose the password. There is no recovery. Not a hard recovery: none. Nobody holds a key.

---

## What it actually does

With encryption on, every file Comma writes to Drive is encrypted on your device first:

| | |
|---|---|
| **Cipher** | AES-256-GCM — authenticated, so tampering is detected, not just decryption failure |
| **Key derivation** | PBKDF2-HMAC-SHA256, **210,000** iterations |
| **Salt** | Random, per file |
| **IV** | Random, per file |
| **Where the key lives** | Derived from your password on demand. Never written to disk, never uploaded. |

The password is never stored, in any form. Comma can't check it against a hash — it simply tries to decrypt, and a wrong password produces data that fails the authentication tag.

### The envelope

Every file is a JSON envelope, so a device can tell at a glance whether it can read it:

```jsonc
// Default mode — no password
{ "v": 2, "enc": "none", "content": { /* your rows */ } }

// End-to-end mode
{ "v": 2, "enc": "aes-256-gcm", "kdf": "pbkdf2-sha256",
  "iter": 210000, "salt": "…", "iv": "…", "tag": "…", "content": "…base64 ciphertext…" }
```

A device that meets an encrypted envelope without the password doesn't crash or silently skip it — it reports that a password is needed and asks you.

---

## Turning it on

**Settings → Data → Cloud Sync → Advanced → End-to-End Encryption.**

Comma makes you tick a box acknowledging that a forgotten password means unrecoverable data, then set one. That friction is intentional.

Switching it on **re-uploads your whole vault** in the new format — the push cursor is rewound to zero so nothing is left behind in the old one. Same in reverse when you turn it off.

---

## The per-device caveat

Encryption mode lives on the **device**, not your account.

Turn it on on your phone, and your laptop — which knows nothing about it — pulls down files it can't read and prompts you for the password. That's by design, but it surprises people. Enter it once on the laptop and both devices are aligned.

---

## Changing or forgetting the password

**Changing it:** turn E2E off, then on again with the new one. Your vault re-uploads under the new key.

**Forgetting it:** the cloud copy is unreadable, forever. But:

1. Your **local** data is never encrypted with this password — only the cloud copy is. If the original device still has your data, turn E2E off there and everything re-uploads in plain form. You've lost nothing.
2. If no device still has the data, the cloud copy is lost. Start fresh.

This is what end-to-end means. A system that could rescue you here would be a system where somebody else holds a key.

---

## What isn't encrypted

**Your local database** — on neither the phone nor the browser. The operating system protects it instead: Android app-private storage isn't readable by other apps, and a locked phone's disk encryption covers it.

**Metadata on Drive** — Google can see that files exist, when, and how big. In E2E mode it can't see what's inside them.

**Raw GPS scratch data** — never leaves the device at all.

---

## Threat model, honestly

| Threat | Default | End-to-end |
|---|---|---|
| Someone takes your **unlocked** phone | Exposed | Exposed — the local vault is plaintext either way |
| Someone takes your **locked** phone | OS-protected | OS-protected |
| Google is compelled to hand over your Drive | **Readable** | Unreadable |
| A Comma server is breached | No server exists | No server exists |
| Comma's developers go rogue | They receive nothing | They receive nothing |
| You forget your password | Nothing to forget | **Total loss of cloud data** |

Read the first row twice. Neither mode encrypts the *local* database, so an attacker holding your unlocked phone has your data regardless. End-to-end buys protection for the **cloud copy** — not for a device that's physically taken.

---

## In the source

- `src/services/cryptoEnvelope.ts` — the envelope format, both variants
- `src/services/cryptoHelper.ts` / `cryptoHelper.native.ts` — key derivation and AES-GCM
- `web/src/modules/backup/cryptoEnvelope.js` — the web mirror, byte-compatible with the phone
