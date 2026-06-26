import { db } from "../client";
import { platforms } from "../schema";
import { eq, and } from "drizzle-orm";
import { Platform } from "react-native";
import { getPlatformsByCountry, getMileagePresetRate } from "@/src/registry/index";

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
    if (raw) return JSON.parse(raw);
    return [];
  }
  const results = await db.select().from(platforms).where(eq(platforms.country, country)).execute();
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
      updated = existing.map((p) => (p.id === platformId ? { ...p, ...patch } : p));
    } else {
      updated = [...existing, {
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
      }];
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
    await db.insert(platforms).values({
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
    }).execute();
  } else {
    await db
      .update(platforms)
      .set({
        isActive: patch.isActive !== undefined ? patch.isActive : undefined,
        hourlyRate: patch.hourlyRate !== undefined ? patch.hourlyRate : undefined,
        mileageRate: patch.mileageRate !== undefined ? patch.mileageRate : undefined,
        sortPriority: patch.sortPriority !== undefined ? patch.sortPriority : undefined,
        label: patch.label !== undefined ? patch.label : undefined,
        color: patch.color !== undefined ? patch.color : undefined,
        textColor: patch.textColor !== undefined ? patch.textColor : undefined,
        logoEmoji: patch.logoEmoji !== undefined ? patch.logoEmoji : undefined,
      })
      .where(and(eq(platforms.country, country), eq(platforms.id, platformId)))
      .execute();
  }
}

export async function seedDBPlatforms(country: string, defaultSelectedIds: string[] = []): Promise<void> {
  const staticPlatforms = getPlatformsByCountry(country);
  const existing = await getDBPlatforms(country);
  const existingMap = new Map(existing.map(p => [p.id, p]));

  const listToInsert = [];
  for (const sp of staticPlatforms) {
    if (!existingMap.has(sp.id)) {
      const defaultMileage = getMileagePresetRate(country, country === "CA" ? "ON" : country === "US" ? "NY" : "ENG");
      listToInsert.push({
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
      });
    }
  }

  if (listToInsert.length > 0) {
    if (isWeb) {
      const newList = [...existing, ...listToInsert];
      localStorage.setItem(`comma_db_platforms_${country}`, JSON.stringify(newList));
    } else {
      await db.insert(platforms).values(listToInsert).execute();
    }
  }
}
