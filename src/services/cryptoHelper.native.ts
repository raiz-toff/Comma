import crypto from "react-native-quick-crypto";
import { Buffer } from "@craftzdog/react-native-buffer";
import { buildPlainEnvelope, readPlainEnvelope, PassphraseError } from "./cryptoEnvelope";

/**
 * Cross-device backup encryption (native).
 *
 * The AES key is derived from the user's backup password ALONE (PBKDF2), using a
 * random salt that is stored inside the encrypted envelope. Nothing device-specific
 * is mixed in, so a backup made on one device can be restored on ANY other device
 * given the same password. The trade-off: if the password is lost, the backup is
 * unrecoverable — there is no device-held key to fall back on.
 */

const KDF_ITERATIONS = 210_000; // OWASP 2023 floor for PBKDF2-HMAC-SHA256
const SALT_BYTES = 16;
const IV_BYTES = 12;
const KEY_BYTES = 32; // AES-256

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

// Async PBKDF2 runs on a native thread instead of blocking JS; parameters are
// byte-identical to the old pbkdf2Sync call, so existing envelopes still decrypt.
function deriveKey(passphrase: string, saltHex: string, iterations: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(passphrase, Buffer.from(saltHex, "hex"), iterations, KEY_BYTES, "sha256", (err, key) => {
      if (err || !key) reject(err ?? new Error("Key derivation failed."));
      else resolve(key);
    });
  });
}

export async function encryptBackup(plaintext: string, passphrase: string): Promise<string> {
  // No password = the DEFAULT one-tap mode: write a plain envelope. Privacy still comes from
  // the Drive appDataFolder sandbox + the user's Google account (see cryptoEnvelope.ts).
  if (!passphrase) return buildPlainEnvelope(plaintext);

  const salt = crypto.randomBytes(SALT_BYTES);
  const iv = crypto.randomBytes(IV_BYTES);
  const key = await deriveKey(passphrase, salt.toString("hex"), KDF_ITERATIONS);

  const cipher = crypto.createCipheriv("aes-256-gcm", key as any, iv as any);
  let content = cipher.update(plaintext, "utf8", "hex");
  content += cipher.final("hex");
  const tag = cipher.getAuthTag().toString("hex");

  const envelope: BackupEnvelope = {
    v: 2,
    kdf: "PBKDF2",
    hash: "SHA-256",
    iter: KDF_ITERATIONS,
    salt: salt.toString("hex"),
    iv: iv.toString("hex"),
    content,
    tag,
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

  const key = await deriveKey(passphrase, env.salt, env.iter || KDF_ITERATIONS);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key as any, Buffer.from(env.iv, "hex") as any);
  decipher.setAuthTag(Buffer.from(env.tag, "hex") as any);

  try {
    let decrypted = decipher.update(env.content, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch {
    // GCM tag mismatch — almost always the wrong password. Also a PassphraseError so the
    // caller re-prompts instead of quarantining the file.
    throw new PassphraseError("Wrong encryption password, or the file is corrupted.");
  }
}
