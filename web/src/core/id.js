/**
 * Client-side collision-resistant ID generator (interop plan Workstream 1 prerequisite "Fix 2").
 *
 * Web previously used Dexie's auto-increment `++id` for the 10 tables mobile syncs. That's
 * dangerous once two independent browser instances/devices can each push to the same Google
 * Drive `appDataFolder`: if both auto-increment a `shift` to `id: 1`, the sync merge logic
 * (keyed by `id`) treats them as the SAME row and one silently clobbers the other, even though
 * they're genuinely different shifts. Mobile avoids this with client-generated string ids
 * (see `commaApp/src/database/queries/shifts.ts` / `store/useActiveShift.ts`, which mint ids
 * inline as `` `shift_${Date.now()}_${Math.random().toString(36).slice(2, 9)}` `` — not
 * cryptographically strong).
 *
 * `comma`'s package.json has zero runtime dependencies (no uuid/nanoid), so per the plan we
 * implement a minimal generator on top of the native `crypto` API rather than adding one:
 *   - `newId(prefix)` — a prefixed UUID v4 (`crypto.randomUUID()`, ~122 bits of entropy) for
 *     the 10 synced tables' primary keys.
 *   - `newDashFreeId(len)` — a dash-free alphanumeric id (mirrors mobile's
 *     `nanoid/non-secure` `customAlphabet` call in `syncState.ts`/`applyChangeLog.ts`) for
 *     contexts where a dash is structurally significant, e.g. sync device ids and change-log
 *     filenames (`comma-cl-{deviceId}-{epochMs}.cmlog`), which are parsed by splitting on the
 *     LAST dash — a UUID's embedded dashes would break that parse.
 */

const DASH_FREE_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

function getCrypto() {
  if (typeof crypto !== 'undefined' && crypto) return crypto;
  if (typeof window !== 'undefined' && window.crypto) return window.crypto;
  throw new Error('Web Crypto API unavailable — cannot generate a secure id.');
}

/** RFC4122 v4 UUID, using `crypto.randomUUID()` where available (all modern secure-context
 *  browsers) with a `crypto.getRandomValues()`-based fallback for older/non-secure contexts. */
function uuidV4() {
  const c = getCrypto();
  if (typeof c.randomUUID === 'function') return c.randomUUID();
  const bytes = c.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * A new collision-resistant string id for one of the 10 synced Dexie tables' primary keys.
 * @param {string} [prefix] e.g. 'shift', 'exp', 'veh' — purely cosmetic/debuggability, not
 *   required for uniqueness (the UUID alone is already collision-resistant).
 * @returns {string}
 */
export function newId(prefix) {
  const uuid = uuidV4();
  return prefix ? `${prefix}_${uuid}` : uuid;
}

/**
 * A dash-free random alphanumeric id, matching mobile's nanoid `customAlphabet` shape
 * (62-symbol alphabet). Used for sync device ids / audit-log ids where a dash is a delimiter,
 * not for the 10 synced tables' row ids (use {@link newId} for those).
 * @param {number} [len]
 * @returns {string}
 */
export function newDashFreeId(len = 16) {
  const c = getCrypto();
  const bytes = c.getRandomValues(new Uint8Array(len));
  let out = '';
  for (let i = 0; i < len; i++) out += DASH_FREE_ALPHABET[bytes[i] % DASH_FREE_ALPHABET.length];
  return out;
}
