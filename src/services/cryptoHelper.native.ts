import crypto from "react-native-quick-crypto";
import * as SecureStore from "expo-secure-store";

const ENCRYPTION_KEY_STORE_KEY = "COMMA_BACKUP_ENCRYPTION_KEY";

export async function getOrCreateEncryptionKey(pin: string = "1234"): Promise<string> {
  let key = await SecureStore.getItemAsync(ENCRYPTION_KEY_STORE_KEY);
  if (!key) {
    key = crypto.randomBytes(32).toString("hex");
    await SecureStore.setItemAsync(ENCRYPTION_KEY_STORE_KEY, key);
  }

  // Salt key with user pin for extra layer
  const salted = crypto.pbkdf2Sync(key, pin, 1000, 32, "sha256");
  return salted.toString("hex");
}

export async function encrypt(data: string, keyHex: string): Promise<string> {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", Buffer.from(keyHex, "hex") as any, iv as any);
  let encrypted = cipher.update(data, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag().toString("hex");

  return JSON.stringify({
    iv: iv.toString("hex"),
    content: encrypted,
    tag,
  });
}

export async function decrypt(encryptedJson: string, keyHex: string): Promise<string> {
  const { iv, content, tag } = JSON.parse(encryptedJson);
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    Buffer.from(keyHex, "hex") as any,
    Buffer.from(iv, "hex") as any
  );
  decipher.setAuthTag(Buffer.from(tag, "hex") as any);
  let decrypted = decipher.update(content, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}
