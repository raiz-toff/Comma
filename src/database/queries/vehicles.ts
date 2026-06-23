import { db } from '../client';
import { vehicles } from '../schema';

export declare function getVehicles(): Promise<any[]>;
export declare function getVehicleStats(vehicleId: string): Promise<{ totalShifts: number; totalActiveMileage: number }>;
export declare function insertVehicle(payload: typeof vehicles.$inferInsert): Promise<void>;
export declare function updateVehicle(id: string, payload: Partial<typeof vehicles.$inferInsert>): Promise<void>;
export declare function deleteVehicle(id: string): Promise<void>;
