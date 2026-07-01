import { eq } from "drizzle-orm";
import { getDb, scheduleDbSave } from "../index";
import { settings } from "../schema";

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  const rows = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
  return rows[0]?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } });
  scheduleDbSave();
}

export async function getProfile(): Promise<Record<string, unknown> | null> {
  const raw = await getSetting("comma_profile");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function getLastBackupAt(): Promise<string | null> {
  return getSetting("last_backup_at");
}
