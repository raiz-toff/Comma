import { db } from '../client';
import { goals } from '../schema';

export declare function getGoalsWithProgress(): Promise<any[]>;
export declare function insertGoal(payload: typeof goals.$inferInsert): Promise<void>;
export declare function deleteGoal(id: string): Promise<void>;
