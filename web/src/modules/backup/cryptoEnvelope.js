/**
 * COMMA — Envelope helpers (mirror of mobile `src/services/cryptoEnvelope.ts`).
 *
 * Sync supports two modes (the WhatsApp model — see app/docs/sync-ux-simplification.md):
 *
 *   1. DEFAULT (no password): the payload is written as a PLAIN envelope. It is still
 *      private — it lives in the Drive `appDataFolder`, a sandbox only this app, signed in
 *      as this Google account, can read. This is exactly WhatsApp's default backup posture.
 *   2. E2E (user set a password): AES-256-GCM under a PBKDF2 key derived from that password
 *      alone. Zero-knowledge — not even Google can read it.
 *
 * A reader tells the two apart from the file itself (`enc: 'none'`), so a device can always
 * read a plain file with no password configured, and BOTH modes can coexist in the
 * appDataFolder during a mode switch. Envelopes written before this existed carry no `enc`
 * field and have salt/iv/tag — they take the encrypted path, so old files still decrypt.
 *
 * MUST stay byte-compatible with the mobile version — a file written by either app is read
 * by the other.
 */

/** Marker value for an unencrypted envelope. */
export const PLAIN_ENC = 'none';

/**
 * Thrown when a file IS encrypted but we can't open it — either no password is configured in
 * this browser, or the wrong one. Distinct from a corrupt/poison file: the caller must PROMPT
 * for the password, not quarantine the file (quarantining would make a perfectly good backup
 * permanently invisible after 3 syncs).
 */
export class PassphraseError extends Error {
  /** @param {string} message */
  constructor(message) {
    super(message);
    this.name = 'PassphraseError';
    this.code = 'PASSPHRASE_REQUIRED';
  }
}

/** True for any error meaning "we need a (different) password to read this".
 *  @param {unknown} e @returns {boolean} */
export function isPassphraseError(e) {
  return !!e && typeof e === 'object' && /** @type {any} */ (e).code === 'PASSPHRASE_REQUIRED';
}

/** Serialize an unencrypted payload into a plain envelope.
 *  @param {string} plaintext @returns {string} */
export function buildPlainEnvelope(plaintext) {
  return JSON.stringify({ v: 2, enc: PLAIN_ENC, content: plaintext });
}

/**
 * If `envelopeJson` is a PLAIN (unencrypted) envelope, return its payload; otherwise null (so
 * the caller falls through to the encrypted path). Never throws.
 * @param {string} envelopeJson @returns {string | null}
 */
export function readPlainEnvelope(envelopeJson) {
  try {
    const env = JSON.parse(envelopeJson);
    if (env && env.enc === PLAIN_ENC && typeof env.content === 'string') return env.content;
  } catch {
    /* not JSON — let the encrypted path produce the error message */
  }
  return null;
}
