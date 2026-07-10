# COMMA — Google Drive Backup Plan
### Encrypted · Automatic · App-Exclusive · Local-First Safe
#### No backend required. Everything runs in the browser.

---

## DESIGN PRINCIPLES

```
1. User never sees or manages an encryption key
2. The backup file is unreadable without the Comma app + the same Google account
3. Minimal Drive permissions — app only touches its own hidden folder
4. Backup happens silently in the background — never blocks the user
5. Restore is a single button, not a multi-step wizard
6. No backend server involved at any point
```

---

## PART 1 — GOOGLE DRIVE SCOPE (PERMISSIONS)

Use ONLY this OAuth scope:

```
https://www.googleapis.com/auth/drive.appdata
```

**Why this scope specifically:**
- Gives access to a hidden `appDataFolder` only visible to your app
- NOT visible in the user's Google Drive UI — they cannot accidentally delete it
- Shows users: *"Comma wants to manage its own files in Drive"*
- NOT: *"Comma wants access to all your Drive files"*
- 100MB storage limit per app — more than enough for a vault backup

**What you DO NOT request:**
- `drive` — full Drive access (invasive, unnecessary)
- `drive.file` — user-created files (not needed)
- `drive.readonly` — read-only (not enough for backup)

This is the most trust-friendly scope possible. It's what productivity apps use for their own config/backup files.

---

## PART 2 — ENCRYPTION ARCHITECTURE

### The Core Problem
You want automatic encryption — no user passphrase. The user just taps "connect Drive" and backups work forever silently.

### The Solution: Two-File System in appDataFolder

```
Google Drive — appDataFolder (hidden, app-only)
├── comma-key.json       ← The AES-GCM 256-bit encryption key
└── comma-vault.comdb     ← The encrypted backup (useless without the key)
```

The key and the encrypted data live in the same hidden folder.
**Without the app + the same Google account, the backup file is cryptographically unreadable.**

### Key Generation (First Backup Ever)

```
1. Check appDataFolder for existing comma-key.json
2. If NOT found:
   a. Generate a new AES-GCM 256-bit key via Web Crypto API:
      window.crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,     ← exportable
        ['encrypt', 'decrypt']
      )
   b. Export key as JWK (JSON Web Key format)
   c. Upload as comma-key.json to appDataFolder
   d. Store the key in memory for this session
3. If found:
   a. Download comma-key.json
   b. Import key back via importKey()
   c. Store in memory for this session
```

**The key is never stored in localStorage, sessionStorage, or IndexedDB.**
It lives in Drive and in memory only. Session ends → key cleared from memory → next session fetches from Drive.

### Encryption Process (AES-GCM)

```
For each backup operation:
  1. Generate a fresh random IV (12 bytes / 96 bits) via crypto.getRandomValues()
     ← NEVER reuse IV. Fresh IV every single backup.
  2. Serialize the vault to JSON string
  3. Encode to Uint8Array (TextEncoder)
  4. Encrypt:
     window.crypto.subtle.encrypt(
       { name: 'AES-GCM', iv: iv },
       cryptoKey,
       plaintextBytes
     )
  5. Package into .comdb file format (see Part 3)
  6. Upload to Drive
```

**Why AES-GCM:**
- Authenticated encryption — detects tampering (not just encrypts)
- If the ciphertext is modified, decryption throws an error rather than returning garbage
- Industry standard, built into every modern browser's Web Crypto API
- No external crypto library needed

---

## PART 3 — THE `.comdb` FILE FORMAT

The backup file is named `comma-vault.comdb`. The `.comdb` extension is yours — no other app reads it.

### File Structure (JSON wrapper — simplest, human-debuggable metadata)

```json
{
  "magic": "COMMA_VAULT",
  "formatVersion": 1,
  "schemaVersion": 3,
  "appVersion": "1.2.0",
  "encryptedAt": "2025-06-15T14:30:00.000Z",
  "deviceHint": "Chrome / Ontario",
  "iv": "base64-encoded-12-byte-iv",
  "ciphertext": "base64-encoded-encrypted-payload"
}
```

**Fields explained:**

| Field | Purpose |
|---|---|
| `magic` | Identifies the file as a Comma vault — rejects random JSON files |
| `formatVersion` | The format of THIS wrapper file — version the wrapper separately from the data |
| `schemaVersion` | The Dexie DB schema version of the data inside — critical for safe restore |
| `appVersion` | Which version of Comma created this backup |
| `encryptedAt` | Timestamp — shown to user on restore screen |
| `deviceHint` | Non-sensitive context for user (which browser, which province) |
| `iv` | Base64 of the 12-byte AES-GCM IV — needed for decryption |
| `ciphertext` | Base64 of the encrypted vault JSON |

**The plaintext inside ciphertext is:**
```json
{
  "exportedAt": "2025-06-15T14:30:00.000Z",
  "schemaVersion": 3,
  "tables": {
    "users": [...],
    "shifts": [...],
    "expenses": [...],
    "vehicles": [...],
    "goals": [...],
    "badges": [...],
    "appState": [...]
  }
}
```

---

## PART 4 — BACKUP ROTATION (3 VERSIONS)

Keep 3 backup generations in appDataFolder:

```
comma-vault.comdb        ← current (most recent)
comma-vault-prev1.comdb  ← previous
comma-vault-prev2.comdb  ← two backups ago
```

**On each backup operation:**
```
1. If prev1 exists: rename prev1 → prev2 (overwrite prev2)
2. If current exists: rename current → prev1
3. Upload new backup as current
```

In Drive API terms: update the file contents in-place using the existing file ID.
Keep the file IDs in `localStorage` so you don't have to search for them each time.

**Why 3 versions:**
- User accidentally deletes data → restore from prev1
- Corruption discovered a day later → restore from prev2
- Minimal storage use (3 × ~500KB = ~1.5MB typically)

---

## PART 5 — WHEN BACKUPS HAPPEN (TRIGGER STRATEGY)

### Trigger 1 — Dirty Flag + Debounce (Primary mechanism)

```
Any data-changing event fires (SHIFT_SAVED, EXPENSE_SAVED, etc.):
  → Set localStorage 'vault_dirty' = true + timestamp
  → Set/reset a 90-second debounce timer
  → When timer fires: if vault_dirty AND Drive connected AND online:
      → Run backup
      → Clear vault_dirty
      → Update 'last_backup_at' in localStorage
```

**Why 90 seconds:** Gives the user time to log multiple shifts in a session without triggering a backup after each one. Batches the work.

### Trigger 2 — On App Hide (visibilitychange)

```
document.addEventListener('visibilitychange', () => {
  if (document.hidden && localStorage.get('vault_dirty') === 'true') {
    // User is leaving — backup NOW (don't wait for debounce)
    runBackup()  // fire and forget — don't await, app is hiding
  }
})
```

This is the "WhatsApp approach" — backup when the user leaves, not on a timer.

### Trigger 3 — On App Open (Staleness Check)

```
On every app open:
  → Check 'last_backup_at' from localStorage
  → If more than 6 hours ago AND Drive connected AND online:
      → Run backup silently (no toast, no UI interruption)
  → If Drive not connected AND vault_dirty is old (>24h):
      → Show gentle nudge: "Back up your data to Drive"
```

### Trigger 4 — Manual (User-Initiated)

```
Settings → Data → "Back up now" button
  → Always runs, even if not dirty
  → Shows progress indicator
  → Shows "Backed up just now ✓" on success
```

### What NEVER triggers a backup:
- App open (just synced recently)
- Reading data (analytics, viewing shifts)
- Settings changes that are purely cosmetic

---

## PART 6 — TOKEN MANAGEMENT (CRITICAL FOR WEB APPS)

This is the trickiest part of a no-backend Drive integration.

### The Problem
OAuth tokens expire. Access tokens expire in ~1 hour. Refresh tokens need a backend to be safely stored. A pure web app cannot safely store a refresh token in localStorage (XSS risk).

### The Solution: Silent Re-Auth with Prompt: 'none'

```
Google Identity Services (GSI) supports:
  google.accounts.oauth2.initTokenClient({
    client_id: YOUR_CLIENT_ID,
    scope: 'https://www.googleapis.com/auth/drive.appdata',
    prompt: '',   ← empty string = silent re-auth if already authorized
    callback: (tokenResponse) => { storeTokenInMemory(tokenResponse) }
  })
```

**Strategy:**
```
Store in MEMORY only (never localStorage):
  accessToken: string
  tokenExpiry: timestamp

On any Drive API call:
  if (Date.now() > tokenExpiry - 60_000):   ← 60 seconds before expiry
    silentRefresh()                          ← prompt: '' silent re-auth

silentRefresh():
  if user has previously authorized: succeeds silently (no popup)
  if user session expired: fails → show "Reconnect Drive" banner
```

**On app start:**
```
1. Attempt silent token request (prompt: 'none' / prompt: '')
2. Success: Drive is connected, store token in memory
3. Fail: Drive is disconnected, show "Connect Drive" option in settings
4. Never block the app — Drive connection is optional
```

**localStorage stores only:**
```
'drive_connected': 'true' | 'false'     ← was it connected last session?
'drive_file_ids': { current, prev1, prev2, keyFile }  ← Drive file IDs to skip search calls
'last_backup_at': ISO timestamp
'vault_dirty': 'true' | 'false'
```

---

## PART 7 — BACKUP PROCESS (FULL FLOW)

```
async function runBackup():

  1. CHECK PRECONDITIONS
     - navigator.onLine → false: abort, set reminder
     - accessToken valid → false: attempt silent refresh
     - silent refresh fails: abort, show "reconnect" nudge
     - Already backing up (lock flag): abort (prevent concurrent backups)

  2. SET LOCK
     backupInProgress = true

  3. FETCH KEY
     - Check memory: cryptoKey exists? Use it.
     - Else: download comma-key.json from Drive → importKey()
     - Key not found in Drive (first ever backup): generateKey() → upload key first

  4. SERIALIZE VAULT
     - Read all Dexie tables: db.shifts.toArray(), db.expenses.toArray(), etc.
     - Build payload JSON (see Part 3 plaintext structure)
     - JSON.stringify → TextEncoder → Uint8Array

  5. ENCRYPT
     - crypto.getRandomValues(new Uint8Array(12)) → iv
     - crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, plaintextBytes)
     - Convert ciphertext + iv to base64

  6. BUILD .comdb FILE
     - Assemble the JSON wrapper (magic, formatVersion, schemaVersion, etc.)
     - JSON.stringify → Blob

  7. ROTATE FILES IN DRIVE
     - If prev1 exists: update prev2 with prev1 content (or just update file IDs)
     - If current exists: update prev1 with current content
     - Upload new backup to current file (or create if first time)
     - Update 'drive_file_ids' in localStorage

  8. CLEANUP
     - localStorage 'last_backup_at' = new Date().toISOString()
     - localStorage 'vault_dirty' = false
     - backupInProgress = false
     - Update last backup display in UI (Settings → Data tab)

  9. ON ERROR
     - backupInProgress = false
     - Log error to console
     - If network error: retry once after 10 seconds
     - If auth error: show "Drive disconnected" banner
     - If encryption error: show error toast, do NOT corrupt existing backup
     - NEVER delete existing backup on failure
```

**Total time for a typical vault:** Serialize (~10ms) + Encrypt (~5ms) + Upload (~500ms–2s depending on connection). Under 3 seconds total. Background, silent.

---

## PART 8 — RESTORE PROCESS (FULL FLOW)

```
User taps "Restore from Drive" in Settings → Data tab

1. SHOW RESTORE SCREEN (not a modal — full view or large drawer)
   - Connect to Drive
   - List available backups:
     ┌─────────────────────────────────────────────────┐
     │ 📦 Latest backup                                │
     │    June 15, 2025 at 2:30 PM · v1.2.0           │
     │    Ontario · 847 shifts · 312 expenses          │
     │    [Restore this] ← primary action              │
     ├─────────────────────────────────────────────────┤
     │ 📦 Previous backup (June 14)    [Restore]       │
     │ 📦 Older backup (June 13)       [Restore]       │
     └─────────────────────────────────────────────────┘
   - "847 shifts" read from the UNENCRYPTED metadata in the .comdb wrapper
     (deviceHint, encryptedAt, appVersion — no personal data in plaintext)

2. USER SELECTS A BACKUP → CONFIRM
   - CommaConfirm: "This will replace your current local vault.
     Your current data will be exported first."
   - requireType: 'RESTORE' (safety gate)

3. AUTO-EXPORT CURRENT VAULT
   - Before overwriting anything: export current vault as JSON download
   - This is the safety net — user has a local copy before restore

4. DOWNLOAD .comdb FROM DRIVE

5. VALIDATE WRAPPER
   - magic === 'COMMA_VAULT' → else reject
   - formatVersion compatible → else show "This backup requires a newer version of Comma"

6. FETCH KEY (same as backup flow)

7. DECRYPT
   - base64 decode iv + ciphertext
   - crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, ciphertext)
   - TextDecoder → JSON.parse

8. SCHEMA VERSION CHECK
   - backup.schemaVersion === current DB schemaVersion:
     → Direct restore (safe)
   - backup.schemaVersion < current:
     → Run migrations on the restored data before writing to Dexie
     → Same migration engine as the DB upgrade path
   - backup.schemaVersion > current:
     → "This backup was made with a newer version of Comma. Update the app first."
     → Abort

9. WRITE TO DEXIE
   - Clear all tables
   - Bulk-insert all records from backup
   - Preserve all IDs (no auto-increment conflicts — use put() not add())

10. RELOAD
    - store.loadFromDB() → refresh all reactive state
    - Navigate to #/dashboard
    - Toast: "Vault restored from June 15 backup ✓"
```

---

## PART 9 — FIRST INSTALL / NEW DEVICE FLOW

When a new user opens Comma for the first time:

```
Onboarding → completion screen shows:
  "Connect Google Drive to back up your data"
  [Connect Drive]  [Skip for now]

If they connect:
  1. Auth flow runs
  2. Silent check: does comma-vault.comdb exist in appDataFolder?
     YES (returning user on new device):
       → "We found a backup from [date]. Restore it?"
       → [Restore]  [Start fresh]
       → Restore → skip rest of onboarding (data already set up)
     NO (genuinely new user):
       → First backup will happen after onboarding completes
```

This is how WhatsApp handles "new phone, same account" — detect the backup, offer restore, skip setup.

---

## PART 10 — UI STATES (ALL STATES TO HANDLE)

```
Drive Status (shown in Settings → Data tab):

  Connected, backed up recently:
    ✅ Google Drive · Backed up June 15 at 2:30 PM
    [Back up now]  [Restore]  [Disconnect]

  Connected, backup overdue (>12 hours):
    ⚠️ Google Drive · Last backed up 14 hours ago
    [Back up now]  [Restore]  [Disconnect]

  Connected, never backed up:
    ⚠️ Google Drive connected · No backup yet
    [Back up now]

  Backing up in progress:
    ⏳ Backing up... (spinner, not blocking)

  Backup failed:
    ❌ Last backup failed · June 15 at 2:30 PM
    [Try again]  (error detail in collapsed section)

  Disconnected, Drive was previously connected:
    🔌 Drive disconnected · Reconnect to resume backups
    [Reconnect Drive]

  Not connected:
    ☁️ Back up to Google Drive
    [Connect Drive]
    "Your data stays on your device. Drive is optional."

  Offline:
    📡 No internet · Backup will run when you're back online
    (auto-triggers when navigator.onLine fires true)
```

---

## PART 11 — WHAT GOES WHERE (FILE MAP)

```
src/modules/backup/
  drive-auth.js        ← GSI token client, silent refresh, connect/disconnect
  drive-api.js         ← raw Drive REST calls (upload, download, list, rename)
  encryption.js        ← key gen, key storage, encrypt(), decrypt()
  vault-serializer.js  ← Dexie → JSON and JSON → Dexie
  backup-engine.js     ← orchestrates backup: serialize → encrypt → upload → rotate
  restore-engine.js    ← orchestrates restore: download → decrypt → validate → write
  backup-triggers.js   ← dirty flag, debounce timer, visibilitychange, staleness check
  backup-ui.js         ← renders backup status, restore screen, progress states
```

---

## PART 12 — SECURITY SUMMARY

| Threat | Mitigation |
|---|---|
| Someone finds the .comdb file | Useless — AES-GCM 256-bit encrypted, no password bruteforce possible |
| Someone gains access to user's Drive | Can download .comdb but cannot decrypt — key is in appDataFolder, inaccessible without your app's Client ID |
| XSS attack on the app | Access token in memory only (not localStorage). Key in memory only. Token expires in 1hr. |
| Man-in-the-middle on upload | HTTPS to Drive API — TLS 1.3. No plaintext ever in transit. |
| App uploads corrupted backup | Always keep prev1 + prev2. Never delete existing backup on failure. |
| User deletes appDataFolder manually | Key is gone → backup unreadable. Document this. Cannot be mitigated — it's a user action. |
| Someone clones your Client ID | They'd still need the user's Google account to access appDataFolder. Client ID alone gives nothing. |
| IV reuse | Fresh `crypto.getRandomValues()` IV for every single backup operation. |
| Ciphertext tampering | AES-GCM is authenticated encryption — decryption throws on any modification. |

---

## PART 13 — WHAT YOU ALREADY HAVE vs WHAT TO BUILD

```
Already done:
  ✅ Client ID registered
  ✅ Auth flow implemented

To build (in order):

  Step 1: encryption.js
    → generateKey(), storeKeyToDrive(), fetchKeyFromDrive()
    → encrypt(plaintext, key) → { iv, ciphertext }
    → decrypt(iv, ciphertext, key) → plaintext

  Step 2: vault-serializer.js
    → serializeVault() → JSON string of all Dexie tables
    → deserializeVault(json) → validates + writes to Dexie

  Step 3: drive-api.js
    → uploadFile(name, blob, existingFileId?) → fileId
    → downloadFile(fileId) → blob
    → listAppDataFiles() → [{ id, name }]

  Step 4: backup-engine.js
    → runBackup() — full flow from Part 7

  Step 5: restore-engine.js
    → listAvailableBackups() — reads metadata without decrypting
    → runRestore(fileId) — full flow from Part 8

  Step 6: backup-triggers.js
    → initBackupTriggers() — dirty flag + debounce + visibilitychange + staleness

  Step 7: backup-ui.js
    → renderBackupStatus(container) — all UI states from Part 10

  Step 8: Wire into onboarding completion screen (new device detect)
```

---

*Comma Drive Backup Plan v1.0*
*AES-GCM 256 · appDataFolder only · Zero backend · Zero user-managed keys*
*The backup is automatic. The encryption is invisible. The data is yours.*