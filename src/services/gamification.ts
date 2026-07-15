import { db } from "../database/client";
import { shifts, expenses, settings, goals } from "../database/schema";
import { eq } from "drizzle-orm";
import { BADGES, BadgeSweepStats, BadgeContext } from "../registry/badges/index";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

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
  nextResetDate: string | null;
  weekStartedAt: string | null;
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
  /** When set, the panel renders <BadgeSvg id={badgeId} /> instead of the generic type icon. */
  badgeId?: string;
  /** Optional glyph selector for operational events: "backup"|"restore"|"export"|"wipe"|"import"|"error". */
  iconKey?: string;
}

const triggerNativeNotification = async (title: string, body: string, url: string = "/goals", isDemoMode = false) => {
  if (Platform.OS === "web") return;
  if (isDemoMode) return; // demo mode: in-app notifications still recorded, but skip OS push
  try {
    const perm = await Notifications.getPermissionsAsync();
    let status = perm.status;
    // On Android 13+/iOS, if we've never asked (undetermined), request now — otherwise these
    // engagement/tax notifications are silently dropped for users who weren't prompted elsewhere.
    if (status === "undetermined" && perm.canAskAgain) {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status === "granted") {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: true,
          data: { url },
        },
        trigger: null,
      });
    }
  } catch (e) {
    console.warn("Failed to trigger native notification in gamification:", e);
  }
};

export interface GamificationState {
  xpTotal: number;
  xpLevel: number;
  streakDays: number;
  streakLastDay: string | null;
  streakFrozenCount: number;
  bestStreak: number;
  personalRecords: PersonalRecords;
  unlockedBadgeIds: string[];
  challenges: Challenge[];
  notifications: NotificationItem[];
  lastEvaluationMonth: string | null;
}

const DEFAULT_GAMIFICATION_STATE: GamificationState = {
  xpTotal: 0,
  xpLevel: 1,
  streakDays: 0,
  streakLastDay: null,
  streakFrozenCount: 1,
  bestStreak: 0,
  personalRecords: {
    bestShiftGross: 0,
    bestNetHourly: 0,
  },
  unlockedBadgeIds: [],
  challenges: [
    {
      id: "challenge_earn_500_week",
      name: "Earn $500 This Week",
      description: "Reach $500 gross earnings this week.",
      metric: "earnings",
      target: 500,
      current: 0,
      completedAt: null,
      startedAt: new Date().toISOString(),
      nextResetDate: getNextMondayIso(),
      weekStartedAt: new Date().toISOString(),
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
      nextResetDate: getNextMondayIso(),
      weekStartedAt: new Date().toISOString(),
    },
    {
      id: "challenge_5_shift_streak",
      name: "5-Day Streak",
      description: "Log shifts on 5 consecutive days.",
      metric: "streak",
      target: 5,
      current: 0,
      completedAt: null,
      startedAt: new Date().toISOString(),
      nextResetDate: getNextMondayIso(),
      weekStartedAt: new Date().toISOString(),
    },
  ],
  notifications: [],
  lastEvaluationMonth: null,
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

/** Calculate days between two YYYY-MM-DD dates in local time */
function getDaysDifference(ymd1: string, ymd2: string): number {
  const d1 = new Date(`${ymd1}T12:00:00`);
  const d2 = new Date(`${ymd2}T12:00:00`);
  return Math.round((d2.getTime() - d1.getTime()) / 86400000);
}

/** Calculate calendar months between two YYYY-MM-DD dates in local time */
function getMonthsDifference(ymd1: string, ymd2: string): number {
  const d1 = new Date(`${ymd1}T12:00:00`);
  const d2 = new Date(`${ymd2}T12:00:00`);
  return (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
}

/** Returns ISO string for next Monday at midnight local time */
export function getNextMondayIso(): string {
  const now = new Date();
  const day = now.getDay(); // 0=Sun … 6=Sat
  const daysUntil = (8 - day) % 7 || 7; // Mon=7, Tue=6, …, Sun=1
  const next = new Date(now);
  next.setDate(now.getDate() + daysUntil);
  next.setHours(0, 0, 0, 0);
  return next.toISOString();
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

  async evaluateAll(isDemoMode = false): Promise<GamificationState> {
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
    
    // Parse target duration achievements
    let completedShiftTargetsCount = 0;
    for (const s of sortedShifts) {
      const match = String(s.notes || "").match(/\[ShiftTarget:\s*(\d+)\]/);
      if (match) {
        const targetSec = parseInt(match[1], 10);
        if (s.durationSeconds >= targetSec) {
          completedShiftTargetsCount++;
        }
      }
    }

    // Calculate streaks using a robust, backward-scanning calendar streak calculator
    let streakCount = 0;
    let streakLastDay: string | null = null;
    let freezesAvailable = state.streakFrozenCount;
    const now = new Date();
    
    // Monthly freeze replenishment: grant 1 freeze per calendar month passed since last evaluation
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    if (state.lastEvaluationMonth && state.lastEvaluationMonth !== currentMonthStr) {
      const monthsDiff = getMonthsDifference(state.lastEvaluationMonth + "-01", currentMonthStr + "-01");
      if (monthsDiff > 0) {
        freezesAvailable = Math.min(3, freezesAvailable + monthsDiff);
        state.notifications.unshift({
          id: `monthly_freeze_${Date.now()}`,
          title: `Monthly Streak Freeze Granted!`,
          description: `A new month has started. You've been granted ${monthsDiff} Streak Freeze(s) (Capped at 3).`,
          time: "Just now",
          type: "success",
          read: false,
          createdAt: new Date().toISOString(),
        });
        triggerNativeNotification(
          "Monthly Streak Freeze Granted!",
          `A new month has started. You've been granted ${monthsDiff} Streak Freeze(s) (Capped at 3).`,
          "/goals",
          isDemoMode
        );
      }
    }
    state.lastEvaluationMonth = currentMonthStr;

    const uniqueDays = Array.from(new Set(sortedShifts.map((s) => toYmdString(safeDate(s.startTime))))).sort();
    const workedDaysSet = new Set(uniqueDays);

    if (uniqueDays.length > 0) {
      const todayStr = toYmdString(now);
      let checkDate = new Date(now);
      let tempFreezes = 0;
      let committedFreezes = 0;
      let tempStreak = 0;
      let hasFoundFirstShift = false;
      const earliestYmd = uniqueDays[0];

      while (true) {
        const checkStr = toYmdString(checkDate);
        if (workedDaysSet.has(checkStr)) {
          if (!hasFoundFirstShift) {
            hasFoundFirstShift = true;
            streakLastDay = checkStr;
          }
          
          if (tempFreezes > 0) {
            // Commit the freezes used to bridge the gap
            committedFreezes += tempFreezes;
            tempStreak += tempFreezes;
            tempFreezes = 0;
          }
          
          tempStreak += 1;
          streakCount = tempStreak; // Update the confirmed streak
        } else {
          // Missed day
          if (hasFoundFirstShift) {
            tempFreezes += 1;
            if (committedFreezes + tempFreezes > freezesAvailable) {
              // Out of freezes, cannot bridge this gap. Terminate.
              break;
            }
          } else {
            // We haven't found the first shift yet (scanning backwards from today)
            // If we are at today, they just haven't worked today yet. We can skip today without breaking the streak.
            if (checkStr !== todayStr) {
              // They missed yesterday (or earlier) and haven't worked since.
              // This means they need to consume a freeze immediately to keep any previous streak alive.
              tempFreezes += 1;
              hasFoundFirstShift = true; 
              streakLastDay = todayStr;
              if (committedFreezes + tempFreezes > freezesAvailable) {
                break;
              }
            }
          }
        }

        if (checkStr === earliestYmd) {
          // Reached the earliest shift in history, stop scanning.
          break;
        }

        // Go to previous day
        checkDate.setDate(checkDate.getDate() - 1);
      }

      freezesAvailable = Math.max(0, freezesAvailable - committedFreezes);
    } else {
      streakCount = 0;
      streakLastDay = null;
    }
    
    state.streakDays = streakCount;
    state.streakLastDay = streakLastDay;
    state.streakFrozenCount = freezesAvailable;
    if (streakCount > (state.bestStreak || 0)) {
      state.bestStreak = streakCount;
    }
    
    // 3. Evaluate Personal Records
    let recordsChanged = { changedGross: false, changedNetHourly: false };
    for (const s of sortedShifts) {
      const gross = s.grossRevenue + s.tipsRevenue + (s.bonusAmount || 0);
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
    
    // 4. Evaluate Badges
    const currentWeekStart = new Date(now);
    currentWeekStart.setDate(now.getDate() - now.getDay());
    currentWeekStart.setHours(0, 0, 0, 0);

    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Sum stats for badge evaluation and goal progress
    let weekGross = 0, weekHours = 0, weekShifts = 0, weekMileage = 0;
    let monthGross = 0, monthHours = 0, monthShifts = 0, monthMileage = 0;
    let totalActiveMileage = 0;
    const platformShiftCounts: Record<string, number> = {};

    for (const s of sortedShifts) {
      const time = safeDate(s.startTime).getTime();
      const gross = s.grossRevenue + s.tipsRevenue + (s.bonusAmount || 0);
      const hours = (s.durationSeconds || 0) / 3600;
      const mileage = s.activeMileage || 0;
      const pid = String((s as any).platform || "other");

      totalActiveMileage += mileage;
      platformShiftCounts[pid] = (platformShiftCounts[pid] || 0) + 1;

      if (time >= currentWeekStart.getTime()) {
        weekGross += gross;
        weekHours += hours;
        weekShifts++;
        weekMileage += mileage;
      }
      if (time >= currentMonthStart.getTime()) {
        monthGross += gross;
        monthHours += hours;
        monthShifts++;
        monthMileage += mileage;
      }
    }

    const badgeStats: BadgeSweepStats = {
      shiftCount,
      expenseCount,
      weekendShifts,
      streakCount,
      totalActiveMileage,
      platformShiftCounts,
      weekShifts,
    };
    
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
          const gross = s.grossRevenue + s.tipsRevenue + (s.bonusAmount || 0);
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
          let currentVal = 0;
          if (g.period === "weekly") {
            if (g.unit === "currency") currentVal = weekGross;
            else if (g.unit === "hours") currentVal = weekHours;
            else if (g.unit === "shifts") currentVal = weekShifts;
            else if (g.unit === "mileage") currentVal = weekMileage;
          } else if (g.period === "monthly") {
            if (g.unit === "currency") currentVal = monthGross;
            else if (g.unit === "hours") currentVal = monthHours;
            else if (g.unit === "shifts") currentVal = monthShifts;
            else if (g.unit === "mileage") currentVal = monthMileage;
          } else if (g.period === "daily") {
            const todayStr = toYmdString(now);
            const todayShifts = sortedShifts.filter(s => toYmdString(safeDate(s.startTime)) === todayStr);
            if (g.unit === "currency") currentVal = todayShifts.reduce((sum, s) => sum + s.grossRevenue + s.tipsRevenue + (s.bonusAmount || 0), 0);
            else if (g.unit === "hours") currentVal = todayShifts.reduce((sum, s) => sum + (s.durationSeconds || 0), 0) / 3600;
            else if (g.unit === "shifts") currentVal = todayShifts.length;
            else if (g.unit === "mileage") currentVal = todayShifts.reduce((sum, s) => sum + (s.activeMileage || 0), 0);
          }
          hit = currentVal >= g.targetValue;
          if (await def.checkFromGoalHistory({ goal: g, hit })) {
            shouldUnlock = true;
            break;
          }
        }
      }
      
      if (shouldUnlock) {
        state.unlockedBadgeIds.push(def.id);
        newlyUnlockedBadges.push(def.id);
        
        // Add notification — badgeId drives the badge SVG render in the panel
        state.notifications.unshift({
          id: `badge_unlock_${def.id}_${Date.now()}`,
          title: `New Badge Unlocked: ${def.name}!`,
          description: `${def.description} +40 XP awarded.`,
          time: "Just now",
          type: "success",
          read: false,
          createdAt: new Date().toISOString(),
          actionUrl: "/goals",
          badgeId: def.id,
        });
        triggerNativeNotification(`New Badge Unlocked: ${def.name}!`, `${def.icon} ${def.description}`, "/goals", isDemoMode);
      }
    }
    
    // 5. Evaluate Challenges
    // Reset any challenge whose weekly window has passed
    const todayYmd = toYmdString(now);
    for (const c of state.challenges) {
      if (!c.nextResetDate) {
        // Backward compat: assign reset date for challenges saved before this field existed
        c.nextResetDate = getNextMondayIso();
        c.weekStartedAt = c.weekStartedAt ?? c.startedAt;
      } else if (todayYmd >= c.nextResetDate.split("T")[0]) {
        c.current = 0;
        c.completedAt = null;
        c.weekStartedAt = now.toISOString();
        c.nextResetDate = getNextMondayIso();
      }
    }

    // Challenge 1: Earn $500 this week
    const challenge1 = state.challenges.find((c) => c.id === "challenge_earn_500_week");
    if (challenge1 && !challenge1.completedAt) {
      challenge1.current = Math.round(weekGross);
      if (challenge1.current >= challenge1.target) {
        challenge1.completedAt = new Date().toISOString();
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
        triggerNativeNotification(`Challenge Complete: ${challenge1.name}!`, `You reached your target and earned +60 XP.`, "/goals", isDemoMode);
      }
    }
    
    // Challenge 2: 20 deliveries this week
    const challenge2 = state.challenges.find((c) => c.id === "challenge_20_deliveries_week");
    if (challenge2 && !challenge2.completedAt) {
      let deliveries = 0;
      for (const s of sortedShifts) {
        if (safeDate(s.startTime).getTime() >= currentWeekStart.getTime()) {
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
        triggerNativeNotification(`Challenge Complete: ${challenge2.name}!`, `Completed ${deliveries} deliveries. +60 XP awarded.`, "/goals", isDemoMode);
      }
    }
    
    // Challenge 3: 5 shift streak
    const challenge3 = state.challenges.find((c) => c.id === "challenge_5_shift_streak");
    if (challenge3 && !challenge3.completedAt) {
      challenge3.current = streakCount;
      if (challenge3.current >= challenge3.target) {
        challenge3.completedAt = new Date().toISOString();
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
        triggerNativeNotification(`Challenge Complete: ${challenge3.name}!`, `Logged shifts on 5 consecutive days. +60 XP awarded.`, "/goals", isDemoMode);
      }
    }
    
    // Calculate Active Goals Met count for direct XP reward
    let activeGoalsXp = 0;
    for (const g of activeGoals) {
      let currentVal = 0;
      if (g.period === "weekly") {
        if (g.unit === "currency") currentVal = weekGross;
        else if (g.unit === "hours") currentVal = weekHours;
        else if (g.unit === "shifts") currentVal = weekShifts;
        else if (g.unit === "mileage") currentVal = weekMileage;
      } else if (g.period === "monthly") {
        if (g.unit === "currency") currentVal = monthGross;
        else if (g.unit === "hours") currentVal = monthHours;
        else if (g.unit === "shifts") currentVal = monthShifts;
        else if (g.unit === "mileage") currentVal = monthMileage;
      } else if (g.period === "daily") {
        const todayStr = toYmdString(now);
        const todayShifts = sortedShifts.filter(s => toYmdString(safeDate(s.startTime)) === todayStr);
        if (g.unit === "currency") currentVal = todayShifts.reduce((sum, s) => sum + s.grossRevenue + s.tipsRevenue + (s.bonusAmount || 0), 0);
        else if (g.unit === "hours") currentVal = todayShifts.reduce((sum, s) => sum + (s.durationSeconds || 0), 0) / 3600;
        else if (g.unit === "shifts") currentVal = todayShifts.length;
        else if (g.unit === "mileage") currentVal = todayShifts.reduce((sum, s) => sum + (s.activeMileage || 0), 0);
      }
      
      if (currentVal >= g.targetValue) {
        activeGoalsXp += 20; // +20 XP per active goal met
      }
    }

    // Dynamic XP Accumulation
    let xpTotal = 0;
    const totalEarnings = sortedShifts.reduce((sum, s) => sum + (s.grossRevenue || 0) + (s.tipsRevenue || 0) + (s.bonusAmount || 0), 0);

    xpTotal += sortedShifts.length * 10;
    xpTotal += Math.floor(totalEarnings / 10);
    xpTotal += Math.floor(totalActiveMileage / 10);
    xpTotal += completedShiftTargetsCount * 15;
    if (state.personalRecords.bestShiftGross > 0) xpTotal += 30;
    if (state.personalRecords.bestNetHourly > 0) xpTotal += 30;
    xpTotal += state.unlockedBadgeIds.length * 40;
    xpTotal += state.challenges.filter(c => !!c.completedAt).length * 60;
    xpTotal += activeGoalsXp;

    state.xpTotal = xpTotal;

    // Calculate Level & Award Level-Up Freezes
    const oldLevel = state.xpLevel;
    const newLevel = Math.max(1, Math.floor(xpTotal / 100) + 1);
    state.xpLevel = newLevel;

    if (newLevel > oldLevel) {
      const diff = newLevel - oldLevel;
      state.streakFrozenCount = Math.min(3, state.streakFrozenCount + diff);
      state.notifications.unshift({
        id: `level_up_${newLevel}_${Date.now()}`,
        title: `Level Up! Level ${newLevel}`,
        description: `Congratulations! You reached Level ${newLevel} and earned +${diff} Streak Freeze(s) (Capped at 3).`,
        time: "Just now",
        type: "success",
        read: false,
        createdAt: new Date().toISOString(),
      });
      triggerNativeNotification(`Level Up! Level ${newLevel}`, `Congratulations! You reached Level ${newLevel} and earned Streak Freeze(s).`, "/goals", isDemoMode);
    }
    
    // 6. Evaluate Smart Notifications (Throttled/Daily alert logic)
    // Alert: Streak risk
    if (streakCount > 0) {
      const todayStr = toYmdString(now);
      const workedToday = uniqueDays.includes(todayStr);
      // Compare against the ID (which embeds the local date) — createdAt is a UTC ISO
      // string so createdAt.startsWith(todayStr) fails in any UTC+ timezone.
      const alreadyNotified = state.notifications.some(
        (n) => n.id.startsWith(`streak_risk_${todayStr}`)
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
        triggerNativeNotification("Day Streak at Risk!", `You are on a ${streakCount}-day streak. Log a shift today to keep it active!`, "/goals", isDemoMode);
      }
    }
    
    // Alert: Tax deadline approaching
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
          triggerNativeNotification("Tax Installment Due Soon", `Estimated quarterly tax deadline is approaching in ${diffDays} days.`, "/tax", isDemoMode);
        }
      }
    }
    
    if (state.notifications.length > 100) {
      state.notifications = state.notifications.slice(0, 100);
    }
    
    // 7. Save and return state
    await this.saveState(state);
    return state;
  },
};
