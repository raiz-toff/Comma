import { db } from '../client';
import { expenses } from '../schema';

export declare function getExpensesByMonth(year: number): Promise<any[]>;
export declare function getExpenseYTDSummary(): Promise<{ deductible: number; nonDeductible: number }>;
export declare function insertExpense(payload: typeof expenses.$inferInsert): Promise<void>;
export declare function updateExpense(id: string, payload: Partial<typeof expenses.$inferInsert>): Promise<void>;
export declare function deleteExpense(id: string): Promise<void>;
