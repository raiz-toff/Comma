const KDF_ITERATIONS = 210_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

export interface BackupEnvelope {
  v: 2;
  kdf: "PBKDF2";
  hash: "SHA-256";
  iter: number;
  salt: string;
  iv: string;
  content: string;
  tag: string;
}

const toHex = (arr: Uint8Array): string =>
  Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");

const fromHex = (hex: string) =>
  new Uint8Array(hex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));

async function deriveKey(passphrase: string, salt: BufferSource, iterations: number): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey("raw", enc.encode(passphrase), { name: "PBKDF2" }, false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptBackup(plaintext: string, passphrase: string): Promise<string> {
  if (!passphrase) throw new Error("A backup password is required.");
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(passphrase, salt, KDF_ITERATIONS);
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plaintext)));
  const content = encrypted.slice(0, encrypted.length - 16);
  const tag = encrypted.slice(encrypted.length - 16);
  const envelope: BackupEnvelope = {
    v: 2, kdf: "PBKDF2", hash: "SHA-256", iter: KDF_ITERATIONS,
    salt: toHex(salt), iv: toHex(iv), content: toHex(content), tag: toHex(tag),
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
  const key = await deriveKey(passphrase, fromHex(env.salt), env.iter || KDF_ITERATIONS);
  const ct = fromHex(env.content);
  const tag = fromHex(env.tag);
  const concat = new Uint8Array(ct.length + tag.length);
  concat.set(ct);
  concat.set(tag, ct.length);
  try {
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromHex(env.iv) }, key, concat);
    return new TextDecoder().decode(decrypted);
  } catch {
    throw new Error("Wrong backup password, or the file is corrupted.");
  }
}
