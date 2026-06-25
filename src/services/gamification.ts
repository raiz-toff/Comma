import { db } from "../database/client";
import { shifts, expenses, settings, goals } from "../database/schema";
import { eq } from "drizzle-orm";
import { BADGES, BadgeSweepStats, BadgeContext } from "../registry/badges/index";

export interface PersonalRecords {
  bestShiftGross: number;
  bestNetHourly: number;
}

export interface Challenge {
  id: string;
  name: string;
  description: string;
  metric: "earnings" | "deliveries" | "streak";
  target: number;
  current: number;
  completedAt: string | null;
  startedAt: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  description: string;
  time: string;
  type: "info" | "success" | "warning";
  read: boolean;
  createdAt: string;
  actionUrl?: string;
}

export interface GamificationState {
  xpTotal: number;
  xpLevel: number;
  streakDays: number;
  streakLastDay: string | null;
  streakFrozenCount: number;
  personalRecords: PersonalRecords;
  unlockedBadgeIds: string[];
  challenges: Challenge[];
  notifications: NotificationItem[];
}

const DEFAULT_GAMIFICATION_STATE: GamificationState = {
  xpTotal: 0,
  xpLevel: 1,
  streakDays: 0,
  streakLastDay: null,
  streakFrozenCount: 1,
  personalRecords: {
    bestShiftGross: 0,
    bestNetHourly: 0,
  },
  unlockedBadgeIds: [],
  challenges: [
    {
      id: "challenge_earn_500_week",
      name: "Earn 500 This Week",
      description: "Reach $500 gross earnings this week.",
      metric: "earnings",
      target: 500,
      current: 0,
      completedAt: null,
      startedAt: new Date().toISOString(),
    },
    {
      id: "challenge_20_deliveries_week",
      name: "20 Deliveries",
      description: "Complete 20 deliveries this week.",
      metric: "deliveries",
      target: 20,
      current: 0,
      completedAt: null,
      startedAt: new Date().toISOString(),
    },
    {
      id: "challenge_5_shift_streak",
      name: "5 Shift Streak",
      description: "Log shifts on 5 consecutive days.",
      metric: "streak",
      target: 5,
      current: 0,
      completedAt: null,
      startedAt: new Date().toISOString(),
    },
  ],
  notifications: [],
};

/** Parse a date safely, returning a Date object */
function safeDate(val: any): Date {
  if (val instanceof Date) return val;
  if (typeof val === "number") return new Date(val);
  if (typeof val === "string") return new Date(val);
  return new Date();
}

/** Formats a date into a YYYY-MM-DD string */
function toYmdString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export const GamificationService = {
  /** Load gamification state from SQLite settings key */
  async loadState(): Promise<GamificationState> {
    try {
      const rows = await db
        .select()
        .from(settings)
        .where(eq(settings.key, "gamification_state"))
        .limit(1);
      
      if (rows.length === 0) {
        return { ...DEFAULT_GAMIFICATION_STATE };
      }
      
      const parsed = JSON.parse(rows[0].value);
      return {
        ...DEFAULT_GAMIFICATION_STATE,
        ...parsed,
        personalRecords: {
          ...DEFAULT_GAMIFICATION_STATE.personalRecords,
          ...(parsed.personalRecords || {}),
        },
      };
    } catch (e) {
      console.warn("Failed to load gamification state, using defaults:", e);
      return { ...DEFAULT_GAMIFICATION_STATE };
    }
  },

  /** Save gamification state to SQLite settings key */
  async saveState(state: GamificationState): Promise<void> {
    try {
      const jsonStr = JSON.stringify(state);
      await db
        .insert(settings)
        .values({ key: "gamification_state", value: jsonStr })
        .onConflictDoUpdate({
          target: settings.key,
          set: { value: jsonStr },
        });
    } catch (e) {
      console.error("Failed to save gamification state:", e);
    }
  },

  /** Evaluates shift list and triggers streaks, records, badges, challenges, notifications */
  async evaluateAll(): Promise<GamificationState> {
    // 1. Fetch current stored gamification state
    const state = await this.loadState();
    
    // 2. Fetch shifts and expenses from SQLite
    const allShifts = await db.select().from(shifts).execute();
    const allExpenses = await db.select().from(expenses).execute();
    const activeGoals = await db.select().from(goals).where(eq(goals.isActive, true)).execute();
    
    // Filter non-deleted, sorted chronological
    const sortedShifts = [...allShifts].sort(
      (a, b) => safeDate(a.startTime).getTime() - safeDate(b.startTime).getTime()
    );
    
    const shiftCount = sortedShifts.length;
    const expenseCount = allExpenses.length;
    
    // Calculate weekend shifts
    let weekendShifts = 0;
    for (const s of sortedShifts) {
      const day = safeDate(s.startTime).getDay();
      if (day === 0 || day === 6) {
        // Sunday or Saturday
        weekendShifts++;
      }
    }
    
    // Calculate streaks
    let streakCount = 0;
    let streakLastDay: string | null = null;
    let streakFreezes = state.streakFrozenCount;
    
    const uniqueDays = Array.from(new Set(sortedShifts.map((s) => toYmdString(safeDate(s.startTime))))).sort();
    
    if (uniqueDays.length > 0) {
      streakCount = 1;
      streakLastDay = uniqueDays[0];
      
      for (let i = 1; i < uniqueDays.length; i++) {
        const prevDate = new Date(`${uniqueDays[i - 1]}T12:00:00`);
        const currDate = new Date(`${uniqueDays[i]}T12:00:00`);
        const diffDays = Math.round((currDate.getTime() - prevDate.getTime()) / 86400000);
        
        if (diffDays === 1) {
          streakCount++;
          streakLastDay = uniqueDays[i];
        } else if (diffDays > 1) {
          if (streakFreezes > 0) {
            streakFreezes--;
            streakCount++; // preserve streak using freeze
            streakLastDay = uniqueDays[i];
          } else {
            streakCount = 1; // reset streak
            streakLastDay = uniqueDays[i];
          }
        }
      }
    }
    
    state.streakDays = streakCount;
    state.streakLastDay = streakLastDay;
    state.streakFrozenCount = streakFreezes;
    
    // 3. Evaluate Personal Records
    let recordsChanged = { changedGross: false, changedNetHourly: false };
    for (const s of sortedShifts) {
      const gross = s.grossRevenue + s.tipsRevenue;
      if (gross > state.personalRecords.bestShiftGross) {
        state.personalRecords.bestShiftGross = gross;
        recordsChanged.changedGross = true;
      }
      
      const durSec = s.durationSeconds;
      const netHourly = durSec > 0 ? (gross / durSec) * 3600 : 0;
      if (netHourly > state.personalRecords.bestNetHourly) {
        state.personalRecords.bestNetHourly = netHourly;
        recordsChanged.changedNetHourly = true;
      }
    }
    
    if (recordsChanged.changedGross || recordsChanged.changedNetHourly) {
      state.xpTotal += 30; // award personal record XP
    }
    
    // 4. Evaluate Badges
    const badgeStats: BadgeSweepStats = {
      shiftCount,
      expenseCount,
      weekendShifts,
      streakCount,
    };
    
    const now = new Date();
    const currentWeekStart = new Date(now);
    currentWeekStart.setDate(now.getDate() - now.getDay());
    currentWeekStart.setHours(0, 0, 0, 0);
    
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    
    // Sum week and month grosses
    let weekGross = 0;
    let monthGross = 0;
    for (const s of sortedShifts) {
      const time = safeDate(s.startTime).getTime();
      const gross = s.grossRevenue + s.tipsRevenue;
      if (time >= currentWeekStart.getTime()) {
        weekGross += gross;
      }
      if (time >= currentMonthStart.getTime()) {
        monthGross += gross;
      }
    }
    
    // Check shift badges
    const newlyUnlockedBadges: string[] = [];
    for (const def of BADGES) {
      if (state.unlockedBadgeIds.includes(def.id)) continue;
      
      let shouldUnlock = false;
      
      // Sweep evaluation
      if (def.checkFromSweep) {
        shouldUnlock = await def.checkFromSweep(badgeStats);
      }
      
      // Shift evaluation
      if (!shouldUnlock && def.checkFromShift && sortedShifts.length > 0) {
        for (const s of sortedShifts) {
          const gross = s.grossRevenue + s.tipsRevenue;
          const shiftCtx: BadgeContext = {
            shift: s,
            gross,
            weekGross,
            monthGross,
          };
          if (await def.checkFromShift(shiftCtx)) {
            shouldUnlock = true;
            break;
          }
        }
      }
      
      // Personal record evaluation
      if (!shouldUnlock && def.checkFromPersonalRecords) {
        shouldUnlock = await def.checkFromPersonalRecords(recordsChanged);
      }
      
      // Goal history evaluation
      if (!shouldUnlock && def.checkFromGoalHistory && activeGoals.length > 0) {
        for (const g of activeGoals) {
          let hit = false;
          if (g.period === "weekly") {
            hit = weekGross >= g.targetValue;
          } else if (g.period === "monthly") {
            hit = monthGross >= g.targetValue;
          }
          if (await def.checkFromGoalHistory({ goal: g, hit })) {
            shouldUnlock = true;
            break;
          }
        }
      }
      
      if (shouldUnlock) {
        state.unlockedBadgeIds.push(def.id);
        newlyUnlockedBadges.push(def.id);
        state.xpTotal += 40; // Badge unlock XP
        
        // Add notification
        state.notifications.unshift({
          id: `badge_unlock_${def.id}_${Date.now()}`,
          title: `New Badge Unlocked: ${def.name}!`,
          description: `${def.icon} ${def.description} +40 XP awarded.`,
          time: "Just now",
          type: "success",
          read: false,
          createdAt: new Date().toISOString(),
          actionUrl: "/goals",
        });
      }
    }
    
    // 5. Evaluate Challenges
    // Challenge 1: Earn 500 this week
    const challenge1 = state.challenges.find((c) => c.id === "challenge_earn_500_week");
    if (challenge1 && !challenge1.completedAt) {
      challenge1.current = Math.round(weekGross);
      if (challenge1.current >= challenge1.target) {
        challenge1.completedAt = new Date().toISOString();
        state.xpTotal += 60;
        state.notifications.unshift({
          id: `challenge_comp_1_${Date.now()}`,
          title: `Challenge Complete: ${challenge1.name}!`,
          description: `You reached your target and earned +60 XP.`,
          time: "Just now",
          type: "success",
          read: false,
          createdAt: new Date().toISOString(),
          actionUrl: "/goals",
        });
      }
    }
    
    // Challenge 2: 20 deliveries this week
    const challenge2 = state.challenges.find((c) => c.id === "challenge_20_deliveries_week");
    if (challenge2 && !challenge2.completedAt) {
      let deliveries = 0;
      // In native, platform is Uber Eats / DoorDash etc. Let's count shifts as deliveries for simple mock,
      // or check shift active mileage. Let's sum shifts of food delivery platforms.
      for (const s of sortedShifts) {
        if (safeDate(s.startTime).getTime() >= currentWeekStart.getTime()) {
          // If notes mentions a delivery count, parse it; otherwise count each shift as 8 deliveries on average.
          const match = String(s.notes || "").match(/(\d+)\s*deliver/i);
          if (match) {
            deliveries += parseInt(match[1], 10);
          } else {
            deliveries += 8;
          }
        }
      }
      challenge2.current = deliveries;
      if (challenge2.current >= challenge2.target) {
        challenge2.completedAt = new Date().toISOString();
        state.xpTotal += 60;
        state.notifications.unshift({
          id: `challenge_comp_2_${Date.now()}`,
          title: `Challenge Complete: ${challenge2.name}!`,
          description: `Completed ${deliveries} deliveries. +60 XP awarded.`,
          time: "Just now",
          type: "success",
          read: false,
          createdAt: new Date().toISOString(),
          actionUrl: "/goals",
        });
      }
    }
    
    // Challenge 3: 5 shift streak
    const challenge3 = state.challenges.find((c) => c.id === "challenge_5_shift_streak");
    if (challenge3 && !challenge3.completedAt) {
      challenge3.current = streakCount;
      if (challenge3.current >= challenge3.target) {
        challenge3.completedAt = new Date().toISOString();
        state.xpTotal += 60;
        state.notifications.unshift({
          id: `challenge_comp_3_${Date.now()}`,
          title: `Challenge Complete: ${challenge3.name}!`,
          description: `Logged shifts on 5 consecutive days. +60 XP awarded.`,
          time: "Just now",
          type: "success",
          read: false,
          createdAt: new Date().toISOString(),
          actionUrl: "/goals",
        });
      }
    }
    
    // Calculate Level
    state.xpLevel = Math.max(1, Math.floor(state.xpTotal / 100) + 1);
    
    // 6. Evaluate Smart Notifications (Throttled/Daily alert logic)
    // Alert: Streak risk
    if (streakCount > 0) {
      const todayStr = toYmdString(now);
      const workedToday = uniqueDays.includes(todayStr);
      const alreadyNotified = state.notifications.some(
        (n) => n.id.startsWith("streak_risk_") && n.createdAt.startsWith(todayStr)
      );
      if (!workedToday && !alreadyNotified) {
        state.notifications.unshift({
          id: `streak_risk_${todayStr}_${Date.now()}`,
          title: "Day Streak at Risk!",
          description: `You are on a ${streakCount}-day streak. Log a shift today to keep it active!`,
          time: "Today",
          type: "warning",
          read: false,
          createdAt: new Date().toISOString(),
        });
      }
    }
    
    // Alert: Tax deadline approaching (fires 10 days before quarterly deadlines: March 31, June 15, Sept 15, Dec 15)
    const deadLines = [
      new Date(now.getFullYear(), 2, 31),
      new Date(now.getFullYear(), 5, 15),
      new Date(now.getFullYear(), 8, 15),
      new Date(now.getFullYear(), 11, 15),
    ];
    for (const deadline of deadLines) {
      const diffMs = deadline.getTime() - now.getTime();
      const diffDays = Math.ceil(diffMs / 86400000);
      if (diffDays > 0 && diffDays <= 10) {
        const key = `tax_deadline_${toYmdString(deadline)}`;
        if (!state.notifications.some((n) => n.id.startsWith(key))) {
          state.notifications.unshift({
            id: `${key}_${Date.now()}`,
            title: "Tax Installment Due Soon",
            description: `Estimated quarterly tax deadline is approaching in ${diffDays} days (${toYmdString(deadline)}).`,
            time: "Warning",
            type: "warning",
            read: false,
            createdAt: new Date().toISOString(),
            actionUrl: "/(tabs)/tax",
          });
        }
      }
    }
    
    // Keep notifications list capped at 100 items to avoid bloating settings JSON
    if (state.notifications.length > 100) {
      state.notifications = state.notifications.slice(0, 100);
    }
    
    // 7. Save and return state
    await this.saveState(state);
    return state;
  },
};
