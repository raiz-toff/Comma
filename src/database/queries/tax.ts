import { db } from '../client';

export declare function getTaxYearSummary(year: number): Promise<{ grossRevenue: number; totalExpenses: number; netIncome: number }>;
