import { db } from '../client';
import { shifts } from '../schema';

export declare function insertShift(payload: typeof shifts.$inferInsert): Promise<void>;
export declare function updateShift(id: string, payload: Partial<typeof shifts.$inferInsert>): Promise<void>;
export declare function getShiftsPaginated(page: number, filters?: { startDate?: Date; endDate?: Date; platforms?: string[] }): Promise<any[]>;
export declare function deleteShift(id: string): Promise<void>;
export declare function insertManyShifts(rows: (typeof shifts.$inferInsert)[]): Promise<{ successCount: number; skippedCount: number }>;
