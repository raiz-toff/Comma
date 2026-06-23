import { db } from '../client';

export declare function getTodayStats(): Promise<{ gross: number; tips: number; count: number; activeMileage: number; deadMileage: number }>;
export declare function getWeekStats(): Promise<{ gross: number; tips: number; count: number; activeMileage: number; deadMileage: number }>;
export declare function getActiveVehicle(): Promise<any>;
export declare function getGoalProgress(period: string): Promise<any>;
export declare function getEarningsByPlatform(startDate: Date, endDate: Date): Promise<any[]>;
export declare function getEarningsByDay(weeks: number): Promise<any[]>;
export declare function getHourlyRate(startDate: Date, endDate: Date): Promise<number>;
export declare function getBestDayOfWeek(startDate: Date, endDate: Date): Promise<number>;
export declare function getBestHourOfDay(startDate: Date, endDate: Date): Promise<number>;
export declare function getMileageSplit(startDate: Date, endDate: Date): Promise<{ active: number; dead: number; ratio: number }>;
export declare function getNetIncome(startDate: Date, endDate: Date): Promise<number>;
