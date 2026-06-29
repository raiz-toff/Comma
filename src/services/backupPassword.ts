import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/**
 * Local storage for the user's backup password.
 *
 * Stored in the device keystore (SecureStore) so repeat backups/restores on THIS
 * device don't require re-typing it. It is never uploaded — on a brand-new device
 * the keystore is empty, so the user must re-enter the password they memorised in
 * order to restore. That's the whole point of the password-only encryption scheme
 * (see cryptoHelper).
 */

const KEY = "comma_backup_password";
const isWeb = Platform.OS === "web";

export async function getBackupPassword(): Promise<string | null> {
  try {
    if (isWeb) return localStorage.getItem(KEY);
    return await SecureStore.getItemAsync(KEY);
  } catch {
    return null;
  }
}

export async function hasBackupPassword(): Promise<boolean> {
  return (await getBackupPassword()) != null;
}

export async function setBackupPassword(password: string): Promise<void> {
  if (isWeb) {
    localStorage.setItem(KEY, password);
    return;
  }
  await SecureStore.setItemAsync(KEY, password);
}

export async function clearBackupPassword(): Promise<void> {
  if (isWeb) {
    localStorage.removeItem(KEY);
    return;
  }
  await SecureStore.deleteItemAsync(KEY);
}
