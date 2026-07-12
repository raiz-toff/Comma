/**
 * Cross-device backup encryption (web).
 *
 * Mirrors cryptoHelper.native.ts using the Web Crypto API. The AES key is derived
 * from the backup password ALONE (PBKDF2) with a per-file random salt stored in the
 * envelope, so backups are portable across devices/browsers. The output envelope
 * format is byte-compatible with the native helper. Lose the password = unrecoverable.
 */

import { buildPlainEnvelope, readPlainEnvelope, PassphraseError } from "./cryptoEnvelope";

const KDF_ITERATIONS = 210_000; // OWASP 2023 floor for PBKDF2-HMAC-SHA256
const SALT_BYTES = 16;
const IV_BYTES = 12;

export interface BackupEnvelope {
  v: 2;
  kdf: "PBKDF2";
  hash: "SHA-256";
  iter: number;
  salt: string; // hex
  iv: string; // hex
  content: string; // hex ciphertext
  tag: string; // hex GCM auth tag
}

const toHex = (arr: Uint8Array): string =>
  Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

const fromHex = (hex: string) =>
  new Uint8Array(hex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));

async function deriveKey(passphrase: string, salt: BufferSource, iterations: number): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );
  return window.crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptBackup(plaintext: string, passphrase: string): Promise<string> {
  // No password = the DEFAULT one-tap mode: write a plain envelope. Privacy still comes from
  // the Drive appDataFolder sandbox + the user's Google account (see cryptoEnvelope.ts).
  if (!passphrase) return buildPlainEnvelope(plaintext);

  const enc = new TextEncoder();
  const salt = window.crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = window.crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(passphrase, salt, KDF_ITERATIONS);

  const encrypted = new Uint8Array(
    await window.crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plaintext))
  );
  // Web Crypto appends the 16-byte GCM tag to the ciphertext; split it out so the
  // envelope matches the native (node-style) {content, tag} shape.
  const content = encrypted.slice(0, encrypted.length - 16);
  const tag = encrypted.slice(encrypted.length - 16);

  const envelope: BackupEnvelope = {
    v: 2,
    kdf: "PBKDF2",
    hash: "SHA-256",
    iter: KDF_ITERATIONS,
    salt: toHex(salt),
    iv: toHex(iv),
    content: toHex(content),
    tag: toHex(tag),
  };
  return JSON.stringify(envelope);
}

export async function decryptBackup(envelopeJson: string, passphrase: string): Promise<string> {
  // A plain (unencrypted) envelope reads back with no password at all.
  const plain = readPlainEnvelope(envelopeJson);
  if (plain != null) return plain;

  // From here the file IS encrypted. Missing password → PassphraseError (prompt), never a
  // generic failure (which the caller would quarantine, hiding a good backup forever).
  if (!passphrase) {
    throw new PassphraseError("This backup is encrypted. Enter your encryption password to continue.");
  }

  let env: BackupEnvelope;
  try {
    env = JSON.parse(envelopeJson) as BackupEnvelope;
  } catch {
    throw new Error("This file isn't a valid Comma backup.");
  }
  if (!env || env.v !== 2 || !env.salt || !env.iv || !env.content || !env.tag) {
    throw new Error("Unrecognized backup format.");
  }

  const key = await deriveKey(passphrase, fromHex(env.salt), env.iter || KDF_ITERATIONS);
  const ct = fromHex(env.content);
  const tag = fromHex(env.tag);
  const concat = new Uint8Array(ct.length + tag.length);
  concat.set(ct);
  concat.set(tag, ct.length);

  try {
    const decrypted = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromHex(env.iv) },
      key,
      concat
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    // GCM tag mismatch — almost always the wrong password. Also a PassphraseError so the
    // caller re-prompts instead of quarantining the file.
    throw new PassphraseError("Wrong encryption password, or the file is corrupted.");
  }
}
