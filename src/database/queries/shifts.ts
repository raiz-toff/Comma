import { db } from "../client";
import { shifts, locationPoints, shiftPlatforms, vehicles } from "../schema";
import * as schema from "../schema";
import { eq, and, or, gte, lte, desc, sql } from "drizzle-orm";
import type { ExpoSQLiteDatabase } from "drizzle-orm/expo-sqlite";
import { Platform } from "react-native";

// Transaction handle type derived from the drizzle expo-sqlite db (the runtime `db` export is
// typed `any` for the web fallback, so we recover a precise tx type for transaction callbacks).
type Tx = Parameters<Parameters<ExpoSQLiteDatabase<typeof schema>["transaction"]>[0]>[0];

const isWeb = Platform.OS === "web";

export async function insertShift(payload: typeof shifts.$inferInsert): Promise<void> {
  if (isWeb) {
    const existing = localStorage.getItem("comma_shifts");
    const list = existing ? JSON.parse(existing) : [];
    list.push(payload);
    localStorage.setItem("comma_shifts", JSON.stringify(list));
    return;
  }
  await db.insert(shifts).values(payload);
}

export async function insertLocationPoint(payload: typeof locationPoints.$inferInsert): Promise<void> {
  if (isWeb) {
    const existing = localStorage.getItem("comma_location_points");
    const list = existing ? JSON.parse(existing) : [];
    list.push(payload);
    localStorage.setItem("comma_location_points", JSON.stringify(list));
    return;
  }
  await db.insert(locationPoints).values(payload);
}

export async function attachLocationPointsToShift(sessionId: string, shiftId: string): Promise<void> {
  if (isWeb) {
    const existing = localStorage.getItem("comma_location_points");
    if (!existing) return;
    const list = JSON.parse(existing);
    for (const point of list) {
      if (point.sessionId === sessionId && !point.shiftId) {
        point.shiftId = shiftId;
      }
    }
    localStorage.setItem("comma_location_points", JSON.stringify(list));
    return;
  }
  await db
    .update(locationPoints)
    .set({ shiftId })
    .where(eq(locationPoints.sessionId, sessionId));
}

export async function getLocationPointsByShiftId(shiftId: string): Promise<any[]> {
  if (isWeb) {
    const existing = localStorage.getItem("comma_location_points");
    if (!existing) return [];
    const list = JSON.parse(existing);
    return list.filter((point: any) => point.shiftId === shiftId).sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  return db
    .select()
    .from(locationPoints)
    .where(eq(locationPoints.shiftId, shiftId));
}

export async function getLocationPointsBySessionId(sessionId: string): Promise<any[]> {
  if (isWeb) {
    const existing = localStorage.getItem("comma_location_points");
    if (!existing) return [];
    const list = JSON.parse(existing);
    return list.filter((point: any) => point.sessionId === sessionId).sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  return db
    .select()
    .from(locationPoints)
    .where(eq(locationPoints.sessionId, sessionId));
}

export async function updateShift(id: string, payload: Partial<typeof shifts.$inferInsert>): Promise<void> {
  if (isWeb) {
    const existing = localStorage.getItem("comma_shifts");
    if (existing) {
      const list = JSON.parse(existing);
      const index = list.findIndex((s: any) => s.id === id);
      if (index !== -1) {
        list[index] = { ...list[index], ...payload };
        localStorage.setItem("comma_shifts", JSON.stringify(list));
      }
    }
    return;
  }
  await db.update(shifts).set(payload).where(eq(shifts.id, id));
}

export async function getShiftById(id: string): Promise<any | null> {
  if (isWeb) {
    const existing = localStorage.getItem("comma_shifts");
    if (!existing) return null;
    const list = JSON.parse(existing);
    return list.find((s: any) => s.id === id) || null;
  }
  const result = await db.select().from(shifts).where(eq(shifts.id, id)).limit(1);
  return result[0] || null;
}

export async function getShiftsPaginated(
  page: number, 
  filters?: { startDate?: Date; endDate?: Date; platforms?: string[] },
  limitParam?: number
): Promise<any[]> {
  if (isWeb) {
    const existing = localStorage.getItem("comma_shifts");
    if (!existing) return [];
    let list = JSON.parse(existing);

    // Apply filters
    if (filters?.startDate) {
      list = list.filter((s: any) => new Date(s.startTime) >= filters.startDate!);
    }
    if (filters?.endDate) {
      list = list.filter((s: any) => new Date(s.startTime) <= filters.endDate!);
    }
    if (filters?.platforms && filters.platforms.length > 0) {
      list = list.filter((s: any) => s.platform && filters.platforms!.some((p: string) => s.platform.includes(p)));
    }
    
    // Sort descending by default
    list.sort((a: any, b: any) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    
    // Simple pagination
    const limit = limitParam ?? 50; // Use larger limit for calendar/reports queries
    const offset = (page - 1) * limit;
    return list.slice(offset, offset + limit);
  }

  const limit = limitParam ?? 20;
  const offset = (page - 1) * limit;

  const queryConditions = [];
  if (filters?.startDate) {
    queryConditions.push(gte(shifts.startTime, filters.startDate));
  }
  if (filters?.endDate) {
    queryConditions.push(lte(shifts.startTime, filters.endDate));
  }
  // Filter platforms in SQL BEFORE limit/offset — otherwise a page is selected first and then
  // JS-filtered, so a page can return fewer than `limit` rows (or zero) even when more matching
  // shifts exist on later pages, and counts are wrong. `platform` is a comma-joined token list,
  // so match whole tokens with a delimiter-padded LIKE (avoids partial-token false positives).
  if (filters?.platforms && filters.platforms.length > 0) {
    const platformMatch = or(
      ...filters.platforms.map(
        (p) => sql`(',' || ${shifts.platform} || ',') LIKE ${`%,${p},%`}`
      )
    );
    if (platformMatch) queryConditions.push(platformMatch);
  }

  const baseQuery = db.select().from(shifts);
  const query = queryConditions.length > 0
    ? baseQuery.where(and(...queryConditions))
    : baseQuery;

  return query
    .orderBy(desc(shifts.startTime))
    .limit(limit)
    .offset(offset);
}

export async function deleteShift(id: string): Promise<void> {
  if (isWeb) {
    const existing = localStorage.getItem("comma_shifts");
    if (existing) {
      const list = JSON.parse(existing);
      const filtered = list.filter((s: any) => s.id !== id);
      localStorage.setItem("comma_shifts", JSON.stringify(filtered));
    }
    const spExisting = localStorage.getItem("comma_shift_platforms");
    if (spExisting) {
      const spList = JSON.parse(spExisting);
      const spFiltered = spList.filter((sp: any) => sp.shiftId !== id);
      localStorage.setItem("comma_shift_platforms", JSON.stringify(spFiltered));
    }
    return;
  }
  await db.delete(shifts).where(eq(shifts.id, id));
}

export async function getShiftPlatforms(shiftId: string): Promise<any[]> {
  if (isWeb) {
    const existing = localStorage.getItem("comma_shift_platforms");
    if (!existing) return [];
    const list = JSON.parse(existing);
    return list.filter((sp: any) => sp.shiftId === shiftId);
  }
  return db
    .select()
    .from(shiftPlatforms)
    .where(eq(shiftPlatforms.shiftId, shiftId));
}

export async function insertShiftPlatform(payload: typeof shiftPlatforms.$inferInsert): Promise<void> {
  if (isWeb) {
    const existing = localStorage.getItem("comma_shift_platforms");
    const list = existing ? JSON.parse(existing) : [];
    list.push(payload);
    localStorage.setItem("comma_shift_platforms", JSON.stringify(list));
    return;
  }
  await db.insert(shiftPlatforms).values(payload);
}

export async function deleteShiftPlatforms(shiftId: string): Promise<void> {
  if (isWeb) {
    const existing = localStorage.getItem("comma_shift_platforms");
    if (existing) {
      const list = JSON.parse(existing);
      const filtered = list.filter((sp: any) => sp.shiftId !== shiftId);
      localStorage.setItem("comma_shift_platforms", JSON.stringify(filtered));
    }
    return;
  }
  await db.delete(shiftPlatforms).where(eq(shiftPlatforms.shiftId, shiftId));
}

/**
 * Atomically save a shift and its per-platform ledger. The parent shift write, the wipe of
 * the old platform rows, and the re-insert all run inside ONE transaction, so an
 * interrupted/failed save can never leave a shift with a half-deleted platform breakdown
 * (which previously corrupted analytics reading shiftPlatforms — e.g. on a failed edit the
 * old rows were deleted with nothing re-inserted).
 */
export async function saveShiftWithPlatforms(
  shiftId: string,
  isEdit: boolean,
  shiftPayload: typeof shifts.$inferInsert,
  platformEntries: Array<Omit<typeof shiftPlatforms.$inferInsert, "id" | "shiftId">>
): Promise<void> {
  if (isWeb) {
    // localStorage has no real transaction; run the same sequence.
    if (isEdit) {
      await updateShift(shiftId, shiftPayload);
    } else {
      await insertShift(shiftPayload);
    }
    await deleteShiftPlatforms(shiftId);
    let i = 0;
    for (const entry of platformEntries) {
      await insertShiftPlatform({ id: `sp_${shiftId}_${i++}`, shiftId, ...entry });
    }
    return;
  }

  await db.transaction(async (tx: Tx) => {
    if (isEdit) {
      await tx.update(shifts).set(shiftPayload).where(eq(shifts.id, shiftId));
    } else {
      await tx.insert(shifts).values(shiftPayload);
    }
    await tx.delete(shiftPlatforms).where(eq(shiftPlatforms.shiftId, shiftId));
    let i = 0;
    for (const entry of platformEntries) {
      await tx.insert(shiftPlatforms).values({ id: `sp_${shiftId}_${i++}`, shiftId, ...entry });
    }
  });
}

export async function getUnreconciledShifts(): Promise<any[]> {
  if (isWeb) {
    const existing = localStorage.getItem("comma_shifts");
    if (!existing) return [];
    const list = JSON.parse(existing);
    return list.filter((s: any) => s.reconciliationStatus === "pending_reconciliation")
               .sort((a: any, b: any) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }
  return db
    .select()
    .from(shifts)
    .where(eq(shifts.reconciliationStatus, "pending_reconciliation"))
    .orderBy(desc(shifts.startTime));
}

export async function getGPSOnlyShifts(): Promise<any[]> {
  if (isWeb) {
    const existing = localStorage.getItem("comma_shifts");
    if (!existing) return [];
    const list = JSON.parse(existing);
    return list.filter((s: any) => s.distanceSource === "gps_only")
               .sort((a: any, b: any) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }
  return db
    .select()
    .from(shifts)
    .where(eq(shifts.distanceSource, "gps_only"))
    .orderBy(shifts.startTime);
}


export async function insertManyShifts(
  rows: (typeof shifts.$inferInsert)[]
): Promise<{ successCount: number; skippedCount: number }> {
  if (isWeb) {
    const existing = localStorage.getItem("comma_shifts");
    const list = existing ? JSON.parse(existing) : [];
    list.push(...rows);
    localStorage.setItem("comma_shifts", JSON.stringify(list));
    return { successCount: rows.length, skippedCount: 0 };
  }
  
  if (rows.length === 0) return { successCount: 0, skippedCount: 0 };

  let successCount = 0;
  let skippedCount = 0;

  // Import inside one transaction so an app-kill mid-import rolls back cleanly instead of
  // leaving an unknown number of half-imported rows. Invalid rows are still skipped/counted.
  await db.transaction(async (tx: Tx) => {
    for (const row of rows) {
      try {
        await tx.insert(shifts).values(row);
        successCount++;
      } catch (e) {
        skippedCount++;
      }
    }
  });

  return { successCount, skippedCount };
}

export async function reconcileOdometerAnchors(vehicleId: string, newOdometer: number): Promise<void> {
  let previousOdometer = 0;
  
  if (isWeb) {
    const vStr = localStorage.getItem("comma_vehicles");
    const vList = vStr ? JSON.parse(vStr) : [];
    const vIdx = vList.findIndex((v: any) => v.id === vehicleId);
    if (vIdx !== -1) {
      previousOdometer = vList[vIdx].currentOdometer || 0;
      vList[vIdx].currentOdometer = newOdometer;
      localStorage.setItem("comma_vehicles", JSON.stringify(vList));
    }
  } else {
    const vehicleResult = await db.select({ currentOdometer: vehicles.currentOdometer }).from(vehicles).where(eq(vehicles.id, vehicleId)).limit(1);
    if (vehicleResult.length > 0) {
      previousOdometer = vehicleResult[0].currentOdometer || 0;
    }
    await db.update(vehicles).set({ currentOdometer: newOdometer }).where(eq(vehicles.id, vehicleId));
  }

  // Fetch un-reconciled shifts for this vehicle sorted by startTime
  let unrecShifts: any[] = [];
  if (isWeb) {
    const sStr = localStorage.getItem("comma_shifts");
    const sList = sStr ? JSON.parse(sStr) : [];
    unrecShifts = sList
      .filter((s: any) => s.vehicleId === vehicleId && s.distanceSource === "gps_only")
      .sort((a: any, b: any) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  } else {
    unrecShifts = await db
      .select()
      .from(shifts)
      .where(and(eq(shifts.vehicleId, vehicleId), eq(shifts.distanceSource, "gps_only")))
      .orderBy(shifts.startTime);
  }

  if (unrecShifts.length === 0) {
    return;
  }

  // Compute cumulative GPS active+dead mileage for these shifts
  let totalGpsMileage = 0;
  unrecShifts.forEach((s: any) => {
    totalGpsMileage += (s.activeMileage || 0) + (s.deadMileage || 0);
  });

  // Calculate drift
  const odometerDiff = newOdometer - previousOdometer;
  const drift = odometerDiff - totalGpsMileage;

  // Distribute drift proportionally and assign running odometer boundaries
  let runningOdo = previousOdometer;
  const updatedShifts = unrecShifts.map((s: any) => {
    const shiftGps = (s.activeMileage || 0) + (s.deadMileage || 0);
    let proportion = totalGpsMileage > 0 ? shiftGps / totalGpsMileage : 1 / unrecShifts.length;
    let shiftDrift = drift * proportion;

    const act = s.activeMileage || 0;
    const dead = s.deadMileage || 0;
    const totalM = act + dead;
    const actRatio = totalM > 0 ? act / totalM : 0.75;
    const deadRatio = totalM > 0 ? dead / totalM : 0.25;

    const newActive = Math.max(0, act + (shiftDrift * actRatio));
    const newDead = Math.max(0, dead + (shiftDrift * deadRatio));
    const newTotal = newActive + newDead;

    const startOdo = Math.round(runningOdo);
    runningOdo += newTotal;
    const endOdo = Math.round(runningOdo);

    return {
      ...s,
      activeMileage: Number(newActive.toFixed(2)),
      deadMileage: Number(newDead.toFixed(2)),
      trackedMileage: Number(newActive.toFixed(2)),
      startOdometer: startOdo,
      endOdometer: endOdo,
      distanceSource: "odometer_reconciled",
    };
  });

  // Persist updated shifts
  if (isWeb) {
    const sStr = localStorage.getItem("comma_shifts");
    if (sStr) {
      const sList = JSON.parse(sStr);
      updatedShifts.forEach((updated: any) => {
        const idx = sList.findIndex((s: any) => s.id === updated.id);
        if (idx !== -1) {
          sList[idx] = updated;
        }
      });
      localStorage.setItem("comma_shifts", JSON.stringify(sList));
    }
  } else {
    for (const updated of updatedShifts) {
      await db
        .update(shifts)
        .set({
          activeMileage: updated.activeMileage,
          deadMileage: updated.deadMileage,
          trackedMileage: updated.trackedMileage,
          startOdometer: updated.startOdometer,
          endOdometer: updated.endOdometer,
          distanceSource: updated.distanceSource,
        })
        .where(eq(shifts.id, updated.id));
    }
  }
}
