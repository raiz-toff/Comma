const ENCRYPTION_KEY_STORE_KEY = "COMMA_BACKUP_ENCRYPTION_KEY";

async function pbkdf2(password: string, salt: string): Promise<string> {
  if (typeof window === "undefined" || !window.crypto || !window.crypto.subtle) {
    return password;
  }
  const encoder = new TextEncoder();
  const passwordKey = await window.crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey", "deriveBits"]
  );
  const derivedBits = await window.crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: encoder.encode(salt),
      iterations: 1000,
      hash: "SHA-256"
    },
    passwordKey,
    256 // 32 bytes
  );
  return Array.from(new Uint8Array(derivedBits))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function getOrCreateEncryptionKey(pin: string = "1234"): Promise<string> {
  if (typeof window === "undefined" || !window.crypto) {
    return "mock_key";
  }
  let key = localStorage.getItem(ENCRYPTION_KEY_STORE_KEY);
  if (!key) {
    const randomBytes = window.crypto.getRandomValues(new Uint8Array(32));
    key = Array.from(randomBytes).map(b => b.toString(16).padStart(2, "0")).join("");
    localStorage.setItem(ENCRYPTION_KEY_STORE_KEY, key);
  }
  return await pbkdf2(key, pin);
}

export async function encrypt(data: string, keyHex: string): Promise<string> {
  if (typeof window === "undefined" || !window.crypto || !window.crypto.subtle) {
    return JSON.stringify({ iv: "0", content: data, tag: "0" });
  }

  const encoder = new TextEncoder();
  const dataBytes = encoder.encode(data);
  const keyBytes = new Uint8Array(keyHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  
  const cryptoKey = await window.crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );
  
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encryptedBytes = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    dataBytes
  );
  
  const encryptedArr = new Uint8Array(encryptedBytes);
  const ciphertextBytes = encryptedArr.slice(0, encryptedArr.length - 16);
  const tagBytes = encryptedArr.slice(encryptedArr.length - 16);
  
  const toHex = (arr: Uint8Array) => Array.from(arr).map(b => b.toString(16).padStart(2, "0")).join("");
  
  return JSON.stringify({
    iv: toHex(iv),
    content: toHex(ciphertextBytes),
    tag: toHex(tagBytes),
  });
}

export async function decrypt(encryptedJson: string, keyHex: string): Promise<string> {
  if (typeof window === "undefined" || !window.crypto || !window.crypto.subtle) {
    const parsed = JSON.parse(encryptedJson);
    return parsed.content;
  }

  const { iv, content, tag } = JSON.parse(encryptedJson);
  const ivBytes = new Uint8Array(iv.match(/.{1,2}/g)!.map((b: string) => parseInt(b, 16)));
  const contentBytes = new Uint8Array(content.match(/.{1,2}/g)!.map((b: string) => parseInt(b, 16)));
  const tagBytes = new Uint8Array(tag.match(/.{1,2}/g)!.map((b: string) => parseInt(b, 16)));
  const keyBytes = new Uint8Array(keyHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));

  const cryptoKey = await window.crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );

  // Concat content + tag to match Web Crypto AES-GCM input format
  const concatBytes = new Uint8Array(contentBytes.length + tagBytes.length);
  concatBytes.set(contentBytes);
  concatBytes.set(tagBytes, contentBytes.length);

  const decryptedBytes = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ivBytes },
    cryptoKey,
    concatBytes
  );

  const decoder = new TextDecoder();
  return decoder.decode(decryptedBytes);
}
