/**
 * COMMA — Encryption Module (interop plan Workstream 2)
 *
 * Mirrors mobile's `commaApp/src/services/cryptoHelper.ts` exactly, so a backup/change-log
 * encrypted by one app decrypts on the other: PBKDF2-HMAC-SHA256 (210,000 iterations — the
 * OWASP 2023 floor) deriving an AES-GCM 256-bit key from the backup PASSWORD alone (no separate
 * key file), with a per-file random salt/IV stored in the envelope. The output envelope is a
 * hex-encoded JSON object shaped exactly like mobile's `BackupEnvelope`:
 *   { v: 2, kdf: 'PBKDF2', hash: 'SHA-256', iter, salt, iv, content, tag }
 *
 * This REPLACES web's previous `{magic:'COMMA_VAULT', iv, ciphertext}` base64 envelope + a
 * separately-generated-and-Drive-stored raw AES key (`comma-key.json`) — that scheme had no
 * mobile equivalent and couldn't decrypt/be decrypted by mobile's backups. Both `backup-engine.js`
 * (whole-vault `.comdb` backup) and the sync engine's change-logs (Workstream 3) now share this
 * one password-derived envelope, exactly as mobile keeps backup and sync on the same crypto
 * helper.
 */

const KDF_ITERATIONS = 210_000; // OWASP 2023 floor for PBKDF2-HMAC-SHA256
const SALT_BYTES = 16;
const IV_BYTES = 12;

/**
 * @typedef {Object} BackupEnvelope
 * @property {2} v
 * @property {'PBKDF2'} kdf
 * @property {'SHA-256'} hash
 * @property {number} iter
 * @property {string} salt hex
 * @property {string} iv hex
 * @property {string} content hex ciphertext
 * @property {string} tag hex GCM auth tag
 */

/** @param {Uint8Array} arr @returns {string} */
function toHex(arr) {
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** @param {string} hex @returns {Uint8Array} */
function fromHex(hex) {
  const matches = hex.match(/.{1,2}/g) || [];
  return new Uint8Array(matches.map((b) => parseInt(b, 16)));
}

/**
 * @param {string} passphrase
 * @param {BufferSource} salt
 * @param {number} iterations
 * @returns {Promise<CryptoKey>}
 */
async function deriveKey(passphrase, salt, iterations) {
  const enc = new TextEncoder();
  const baseKey = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  );
  return window.crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/**
 * Encrypt plaintext with a backup password. Returns the JSON-stringified envelope.
 * @param {string} plaintext
 * @param {string} passphrase
 * @returns {Promise<string>}
 */
export async function encryptBackup(plaintext, passphrase) {
  if (!passphrase) throw new Error('A backup password is required.');

  const enc = new TextEncoder();
  const salt = window.crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = window.crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(passphrase, salt, KDF_ITERATIONS);

  const encrypted = new Uint8Array(
    await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext)),
  );
  // Web Crypto appends the 16-byte GCM tag to the ciphertext; split it out so the envelope
  // matches mobile's {content, tag} shape.
  const content = encrypted.slice(0, encrypted.length - 16);
  const tag = encrypted.slice(encrypted.length - 16);

  /** @type {BackupEnvelope} */
  const envelope = {
    v: 2,
    kdf: 'PBKDF2',
    hash: 'SHA-256',
    iter: KDF_ITERATIONS,
    salt: toHex(salt),
    iv: toHex(iv),
    content: toHex(content),
    tag: toHex(tag),
  };
  return JSON.stringify(envelope);
}

/**
 * Decrypt a `BackupEnvelope` JSON string with a backup password.
 * @param {string} envelopeJson
 * @param {string} passphrase
 * @returns {Promise<string>}
 */
export async function decryptBackup(envelopeJson, passphrase) {
  if (!passphrase) throw new Error('A backup password is required.');

  /** @type {BackupEnvelope} */
  let env;
  try {
    env = JSON.parse(envelopeJson);
  } catch {
    throw new Error("This file isn't a valid Comma backup.");
  }
  if (!env || env.v !== 2 || !env.salt || !env.iv || !env.content || !env.tag) {
    throw new Error('Unrecognized backup format.');
  }

  const key = await deriveKey(passphrase, fromHex(env.salt), env.iter || KDF_ITERATIONS);
  const ct = fromHex(env.content);
  const tag = fromHex(env.tag);
  const concat = new Uint8Array(ct.length + tag.length);
  concat.set(ct);
  concat.set(tag, ct.length);

  try {
    const decrypted = await window.crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromHex(env.iv) }, key, concat);
    return new TextDecoder().decode(decrypted);
  } catch {
    // GCM tag mismatch — almost always the wrong password.
    throw new Error('Wrong backup password, or the file is corrupted.');
  }
}
