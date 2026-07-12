# Sync UX & Security Simplification Plan

> ## ⚠️ FIX PASS — 2026-07-12 (after the Phase 1–4 build)
>
> The Phase 1–4 UI shipped against an engine that **did not support optional encryption**, so
> the headline "one-tap sync" was **100% non-functional on both platforms**. Fixed; details below.
>
> **Root cause.** The build assumed the per-device full-state engine from
> `sync-simplification-2026-07-12.md` was live (see the since-removed comment in
> `onboarding.js`: *"the new sync engine (full-state LWW) doesn't require E2E key"*). It is **not
> built** — that doc is a *proposal*. The real engine is still delta-log, and it hard-required a
> passphrase. "No password" was implemented as `syncNow('')`, and an empty string is falsy, so it
> hit `if (!passphrase) throw` in **six** places.
>
> | # | Bug | Fix |
> |---|---|---|
> | 1 | `syncNow('')` threw *"Enter the backup password to sync."* for **every default user**, both platforms | New **plain envelope** (`enc:"none"`) in `cryptoEnvelope.ts` / `cryptoEnvelope.js`; `encryptBackup('')` now writes it instead of throwing |
> | 2 | Auto-sync **silently disabled** for all no-password users, while the UI said "Syncing automatically" — a silent lie about data safety | `resolveAutoSync` returns `{passphrase: ''}` instead of `null` (`useAutoSync.ts`, `backup-triggers.js`) |
> | 3 | `setBackupPassword("")` on E2E-disable stored an empty string → `hasBackupPassword()` stayed `true` → the toggle **flipped itself back on** at next mount | Use `clearBackupPassword()` |
> | 4 | An encrypted file a device couldn't open counted as a poison log → **quarantined after 3 syncs**, silently hiding a good backup forever | `PassphraseError` is distinct; pull reports `needsPassphrase` and the UI **prompts** instead |
> | 5 | One unreadable file **aborted the entire pull** (decode was outside the per-file try/catch) | `pullChanges` decodes per-file, returns `{logs, needsPassphrase, failed}` |
> | 6 | Passphrase read from React state (`e2eEnabled`), racing the auto-restore kick → E2E users synced with `""` | Read from SecureStore at call time. **The stored password IS the mode.** |
> | 7 | Toggling E2E left old-mode files + a thin new-mode delta → history unreadable | Mode change rewinds the push cursor → next push re-uploads full state in the new mode |
> | 8 | First-sync guard didn't cover `needsPassphrase` → a joining device could out-stamp the real cloud profile with a blank one (issue-#11 hazard) | Guard extended |
> | 9 | Web "Last pushed" rendered `getLastPushedAt()` — the **LWW row cursor**, not a wall clock | Use `getLastPushRunAt()`; added the missing "Last synced" line to mobile too |
>
> **Verified:** 14/14 crypto round-trip tests (plain, E2E, no-password-on-encrypted, wrong-password,
> mixed-mode, backward-compat with existing Drive files, garbage input); mobile `tsc` adds 0 errors
> over the `useSettingsStore` baseline; web prod build clean.
>
> **Known limitation (by design, v1):** encryption mode is **per-device**, not account-wide. If one
> device turns E2E on, other devices prompt for the password on their next sync. Making the mode
> account-wide requires a marker file in the appDataFolder — deliberately not built.
>
> **Still NOT done from §3:** the "Auto / Hourly" schedule options (still Manual/Daily/Weekly).

**Date:** 2026-07-12
**Scope:** The Backup & Sync Settings UI for both Android (`app/settings/backup.tsx`) and the Web PWA (`web/src/modules/backup/backup-ui.js`), Onboarding for both platforms, and the underlying encryption flow.

---

## 1. How WhatsApp Handles Backups

Here is how they do it:
- **Default (No PIN):** By default, WhatsApp backs up to a hidden, private folder in your Google Drive (the `appDataFolder`). This folder can **only** be accessed by the WhatsApp application using your Google Account. It is secure from other apps and other people because it is protected by your Google Account's overall security. WhatsApp does not encrypt this file with a custom password by default.
- **Optional E2EE (With PIN):** WhatsApp offers a separate, completely optional feature called "End-to-End Encrypted Backup." If a user goes out of their way to enable this, *then* they are asked to create a 64-digit key or a custom password. If they forget it, they lose the data. 

Right now, **our app acts as if every user has toggled on the extreme "End-to-End Encrypted" mode.** We force every user to invent and remember a custom password before they can even use the sync feature. This creates friction and confusion.

---

## 2. Proposed Solution: The "One-Tap" Sync

We should adopt the WhatsApp model. This will make the sync setup incredibly fluent and simple, while maintaining high security.

### A. Remove the Mandatory Password
We will drop the requirement to set a custom backup password.
1. When the user taps "Connect Google Drive", they sign in with Google.
2. The app immediately begins syncing the state (`.cmstate`) directly to their private `appDataFolder`.
3. Because the `appDataFolder` is strictly sandboxed by Google, the user's data remains private and secure from other apps and other people.

### B. Make Encryption Optional (For Power Users)
For users who want "zero-knowledge" security (where even Google cannot potentially read the raw JSON file), we will add an "Advanced Settings" section.
- **Toggle:** "Enable End-to-End Encryption".
- If enabled, the user is prompted to set a custom password (our current PBKDF2 implementation).
- If disabled, we rely on Google's built-in account security.

---

## 3. Redesigning the UX

The current screen on both the mobile app and the web PWA is an intimidating 3-step process (Connect → Password → Back up). We will flatten this to be consistent across both platforms.

### New Flow (For both Android `app/settings/backup.tsx` and Web PWA `web/src/modules/backup/backup-ui.js`):
1. **Not Connected State:**
   - A welcoming screen with a single, prominent button: **"Connect with Google Drive"**.
   - A short explainer: *"Securely back up your data to your Google Account. Your GPS tracking data stays local on your phone."*

2. **Connected State:**
   - The screen shows: **"✓ Connected to Google Drive as [user@email.com]"**.
   - It shows the **Sync Status** (e.g., *"Last synced: 2 minutes ago"*).
   - A button to **"Sync Now"**.

3. **Advanced Section (Hidden at the bottom):**
   - **Sync Schedule:** (Auto, Hourly, Daily)
   - **End-to-End Encryption:** (Off by default, opens the password prompt if toggled on).
   - **Disconnect Account.**

---

## 4. Redesigning the Onboarding Flow (Web & Android)

Right now, users have to dig into the Settings menu to turn on sync. We want to make it effortless for new users to start syncing immediately.

### The New Onboarding Steps:
1. **Welcome Screen:** 
   - Remains largely the same. It still offers the **"Restore from Backup"** button for returning users (which will now use our new, simple one-tap Google login to find their backup).
2. **New User Setup (New Step):** 
   - If a user chooses to start fresh (meaning they did *not* restore a backup), we insert a new onboarding screen before they enter the app.
   - **Title:** "Protect Your Data"
   - **Explainer:** "Turn on cloud sync to securely back up your shifts to Google Drive. You can change this later in settings."
   - **Buttons:** 
     - **[ Connect Google Drive ]** (Primary action)
     - **[ Skip for now ]** (Secondary action)

This guarantees that every new user knows the sync feature exists and can activate it with a single tap before they even log their first shift.

---

## 5. Why this is better
- **Zero Friction:** Users can set up cloud sync with literally one tap (authenticating with Google).
- **Less Data Loss:** Users won't get locked out of their own backups because they forgot the custom password they were forced to create months ago.
- **Proactive Setup:** By asking users during onboarding, we drastically increase the number of people who have a safe backup.
- **Clean UI:** The settings screen becomes an "overview" of their sync health, rather than an intimidating setup wizard.

---

## ✅ TODO List

### Phase 1 — Android Sync Settings (`app/settings/backup.tsx`)
- [x] **Research:** Read and understand the current backup.tsx screen
- [x] **Remove mandatory password requirement** — strip the password step from the main flow
- [x] **Redesign the Settings > Backup screen** — flat "connected / not-connected" UI
- [x] **Add "Advanced" section** — move E2E encryption toggle + schedule picker there

### Phase 2 — Android Onboarding (`components/OnboardingWizard.tsx`)
- [x] **Add "Protect Your Data" sync step** — new screen injected at the end of the onboarding wizard, after GPS step
- [x] **Update the "Restore" chooser** — remove password requirement from the sync restore path

### Phase 3 — Web PWA Sync Settings (`web/src/modules/backup/backup-ui.js`)
- [x] **Remove mandatory password requirement** — strip password from backup-now and sync-now flows
- [x] **Redesign the backup card** — flat connected/not-connected UI mirroring Android
- [x] **Add "Advanced" section** — move E2E encryption toggle + schedule picker there

### Phase 4 — Web PWA Onboarding (`web/src/modules/onboarding/onboarding.js`)
- [x] **Add "Protect Your Data" sync step** — new step injected at the end of the onboarding wizard
- [x] **Update the "Restore / Sync" flow** — remove password requirement from the sync restore path in `handleJoinSync()`
