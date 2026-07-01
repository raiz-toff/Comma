import { eq, isNull, asc } from "drizzle-orm";
import { getDb } from "../index";
import { platforms } from "../schema";

export interface ActivePlatform {
  id: string;
  label: string;
  color: string;
}

export async function getActivePlatforms(): Promise<ActivePlatform[]> {
  const db = await getDb();
  const rows = await db
    .select({ id: platforms.id, label: platforms.label, color: platforms.color })
    .from(platforms)
    .where(eq(platforms.isActive, true))
    .orderBy(asc(platforms.sortPriority));
  return rows;
}
