import crypto from "react-native-quick-crypto";

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

function deriveKey(passphrase: string, saltHex: string, iterations: number) {
  return crypto.pbkdf2Sync(passphrase, Buffer.from(saltHex, "hex"), iterations, KEY_BYTES, "sha256");
}

export async function encryptBackup(plaintext: string, passphrase: string): Promise<string> {
  if (!passphrase) throw new Error("A backup password is required.");

  const salt = crypto.randomBytes(SALT_BYTES);
  const iv = crypto.randomBytes(IV_BYTES);
  const key = deriveKey(passphrase, salt.toString("hex"), KDF_ITERATIONS);

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
  if (!passphrase) throw new Error("A backup password is required.");

  let env: BackupEnvelope;
  try {
    env = JSON.parse(envelopeJson) as BackupEnvelope;
  } catch {
    throw new Error("This file isn't a valid Comma backup.");
  }
  if (!env || env.v !== 2 || !env.salt || !env.iv || !env.content || !env.tag) {
    throw new Error("Unrecognized backup format.");
  }

  const key = deriveKey(passphrase, env.salt, env.iter || KDF_ITERATIONS);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key as any, Buffer.from(env.iv, "hex") as any);
  decipher.setAuthTag(Buffer.from(env.tag, "hex") as any);

  try {
    let decrypted = decipher.update(env.content, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch {
    // GCM tag mismatch — almost always the wrong password.
    throw new Error("Wrong backup password, or the file is corrupted.");
  }
}
