import { db } from "../client";
import { platforms } from "../schema";
import { eq, and } from "drizzle-orm";
import { Platform } from "react-native";
import { getPlatformsByCountry, getMileagePresetRate } from "@/src/registry/index";
import { stampInsert, stampUpdate, notDeleted, isNotDeleted } from "../syncedWrites";

const isWeb = Platform.OS === "web";

export type DBPlatform = {
  id: string;
  label: string;
  color: string;
  textColor: string;
  country: string;
  isActive: boolean;
  hourlyRate: string;
  mileageRate: string;
  sortPriority: number;
  logoEmoji?: string | null;
};

export async function getDBPlatforms(country: string): Promise<DBPlatform[]> {
  if (isWeb) {
    const raw = localStorage.getItem(`comma_db_platforms_${country}`);
    if (raw) return JSON.parse(raw).filter(isNotDeleted);
    return [];
  }
  const results = await db
    .select()
    .from(platforms)
    .where(and(eq(platforms.country, country), notDeleted(platforms.syncDeletedAt)))
    .execute();
  return results.map((r: any) => ({
    id: r.id,
    label: r.label,
    color: r.color,
    textColor: r.textColor,
    country: r.country,
    isActive: Boolean(r.isActive),
    hourlyRate: r.hourlyRate,
    mileageRate: r.mileageRate,
    sortPriority: Number(r.sortPriority),
    logoEmoji: r.logoEmoji || null,
  }));
}

export async function updateDBPlatform(country: string, platformId: string, patch: Partial<DBPlatform>): Promise<void> {
  if (isWeb) {
    const existing = await getDBPlatforms(country);
    const idx = existing.findIndex(p => p.id === platformId);
    let updated;
    if (idx >= 0) {
      updated = existing.map((p) => (p.id === platformId ? { ...p, ...stampUpdate(patch) } : p));
    } else {
      updated = [...existing, stampInsert({
        id: platformId,
        label: patch.label || "Custom Gig",
        color: patch.color || "#71717a",
        textColor: patch.textColor || "#ffffff",
        country,
        isActive: patch.isActive ?? true,
        hourlyRate: patch.hourlyRate || "20",
        mileageRate: patch.mileageRate || "0.62",
        sortPriority: patch.sortPriority || 1,
        logoEmoji: patch.logoEmoji || null,
      })];
    }
    localStorage.setItem(`comma_db_platforms_${country}`, JSON.stringify(updated));
    return;
  }

  const rows = await db
    .select()
    .from(platforms)
    .where(and(eq(platforms.country, country), eq(platforms.id, platformId)))
    .execute();

  if (rows.length === 0) {
    await db.insert(platforms).values(stampInsert({
      id: platformId,
      label: patch.label || "Custom Gig",
      color: patch.color || "#71717a",
      textColor: patch.textColor || "#ffffff",
      country,
      isActive: patch.isActive ?? true,
      hourlyRate: patch.hourlyRate || "20",
      mileageRate: patch.mileageRate || "0.62",
      sortPriority: patch.sortPriority || 1,
      logoEmoji: patch.logoEmoji || null,
    })).execute();
  } else {
    await db
      .update(platforms)
      .set(stampUpdate({
        isActive: patch.isActive !== undefined ? patch.isActive : undefined,
        hourlyRate: patch.hourlyRate !== undefined ? patch.hourlyRate : undefined,
        mileageRate: patch.mileageRate !== undefined ? patch.mileageRate : undefined,
        sortPriority: patch.sortPriority !== undefined ? patch.sortPriority : undefined,
        label: patch.label !== undefined ? patch.label : undefined,
        color: patch.color !== undefined ? patch.color : undefined,
        textColor: patch.textColor !== undefined ? patch.textColor : undefined,
        logoEmoji: patch.logoEmoji !== undefined ? patch.logoEmoji : undefined,
      }))
      .where(and(eq(platforms.country, country), eq(platforms.id, platformId)))
      .execute();
  }
}

export async function seedDBPlatforms(country: string, defaultSelectedIds: string[] = []): Promise<void> {
  const staticPlatforms = getPlatformsByCountry(country);

  // Read the RAW (tombstone-inclusive) rows for this country so we can tell apart three
  // states: live row (skip), tombstoned default (revive in place), absent (insert fresh).
  // We deliberately do NOT use getDBPlatforms here — it hides tombstones, which would make
  // a soft-deleted default look "absent" and trigger a PK-colliding re-insert.
  if (isWeb) {
    const raw = localStorage.getItem(`comma_db_platforms_${country}`);
    const existing: any[] = raw ? JSON.parse(raw) : [];
    const existingMap = new Map(existing.map(p => [p.id, p]));

    const listToInsert: any[] = [];
    for (const sp of staticPlatforms) {
      const current = existingMap.get(sp.id);
      const defaultMileage = getMileagePresetRate(country, country === "CA" ? "ON" : country === "US" ? "NY" : "ENG");
      if (!current) {
        // Absent → insert a fresh default row.
        listToInsert.push(stampInsert({
          id: sp.id,
          label: sp.label,
          color: sp.color,
          textColor: sp.textColor,
          country: country,
          isActive: defaultSelectedIds.includes(sp.id),
          hourlyRate: "20",
          mileageRate: defaultMileage,
          sortPriority: 1,
          logoEmoji: null,
        }));
      } else if (!isNotDeleted(current)) {
        // Tombstoned default → revive in place: clear the tombstone and bump the LWW clock.
        const idx = existing.findIndex(p => p.id === sp.id);
        existing[idx] = { ...current, ...stampUpdate({ syncDeletedAt: null }) };
      }
      // else: live row → leave untouched.
    }

    if (listToInsert.length > 0 || existing.some(p => existingMap.has(p.id))) {
      const newList = [...existing, ...listToInsert];
      localStorage.setItem(`comma_db_platforms_${country}`, JSON.stringify(newList));
    }
    return;
  }

  const existing = await db.select().from(platforms).where(eq(platforms.country, country)).execute();
  const existingMap = new Map<string, typeof platforms.$inferSelect>(
    existing.map((p: typeof platforms.$inferSelect) => [p.id, p])
  );

  const listToInsert: any[] = [];
  for (const sp of staticPlatforms) {
    const current = existingMap.get(sp.id);
    const defaultMileage = getMileagePresetRate(country, country === "CA" ? "ON" : country === "US" ? "NY" : "ENG");
    if (!current) {
      // Absent → insert a fresh default row.
      listToInsert.push(stampInsert({
        id: sp.id,
        label: sp.label,
        color: sp.color,
        textColor: sp.textColor,
        country: country,
        isActive: defaultSelectedIds.includes(sp.id),
        hourlyRate: "20",
        mileageRate: defaultMileage,
        sortPriority: 1,
        logoEmoji: null,
      }));
    } else if (current.syncDeletedAt != null) {
      // Tombstoned default → revive in place instead of re-inserting (avoids PK collision).
      await db
        .update(platforms)
        .set(stampUpdate({ syncDeletedAt: null }))
        .where(and(eq(platforms.country, country), eq(platforms.id, sp.id)))
        .execute();
    }
    // else: live row → leave untouched.
  }

  if (listToInsert.length > 0) {
    await db.insert(platforms).values(listToInsert).execute();
  }
}
