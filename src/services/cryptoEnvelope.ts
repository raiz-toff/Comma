/**
 * Envelope helpers shared by BOTH crypto backends (cryptoHelper.ts / .native.ts).
 *
 * Sync supports two modes (the WhatsApp model — see app/docs/sync-ux-simplification.md):
 *
 *   1. DEFAULT (no password): the payload is written as a PLAIN envelope. It is still
 *      private — it lives in the Drive `appDataFolder`, a sandbox only this app, signed in
 *      as this Google account, can read. This is exactly WhatsApp's default backup posture.
 *   2. E2E (user set a password): the payload is AES-256-GCM encrypted under a PBKDF2 key
 *      derived from that password alone. Zero-knowledge — not even Google can read it.
 *
 * A reader tells the two apart from the file itself (`enc: "none"`), so a device can always
 * read a plain file even with no password configured, and BOTH modes can coexist in the
 * appDataFolder during a mode switch. Envelopes written before this existed carry no `enc`
 * field and have salt/iv/tag — they take the encrypted path, so old files still decrypt.
 */

/** Marker value for an unencrypted envelope. */
export const PLAIN_ENC = "none" as const;

export interface PlainEnvelope {
  v: 2;
  enc: typeof PLAIN_ENC;
  content: string; // the plaintext payload, verbatim
}

/**
 * Thrown when a file IS encrypted but we can't open it — either no password is configured
 * on this device, or the configured one is wrong. Distinct from a corrupt/poison file: the
 * caller must PROMPT for the password, not quarantine the file (quarantining would make a
 * perfectly good backup permanently invisible after 3 syncs).
 */
export class PassphraseError extends Error {
  readonly code = "PASSPHRASE_REQUIRED";
  constructor(message: string) {
    super(message);
    this.name = "PassphraseError";
  }
}

/** True for any error meaning "we need a (different) password to read this". */
export function isPassphraseError(e: unknown): boolean {
  return !!e && typeof e === "object" && (e as { code?: string }).code === "PASSPHRASE_REQUIRED";
}

/** Serialize an unencrypted payload into a plain envelope. */
export function buildPlainEnvelope(plaintext: string): string {
  const env: PlainEnvelope = { v: 2, enc: PLAIN_ENC, content: plaintext };
  return JSON.stringify(env);
}

/**
 * If `envelopeJson` is a PLAIN (unencrypted) envelope, return its payload; otherwise null
 * (so the caller falls through to the encrypted path). Never throws — a non-JSON body is
 * simply "not a plain envelope", and the encrypted path reports the real error.
 */
export function readPlainEnvelope(envelopeJson: string): string | null {
  try {
    const env = JSON.parse(envelopeJson) as Partial<PlainEnvelope>;
    if (env && env.enc === PLAIN_ENC && typeof env.content === "string") return env.content;
  } catch {
    /* not JSON — let the encrypted path produce the error message */
  }
  return null;
}
