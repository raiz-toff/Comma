export interface BadgeContext {
  shift?: any;
  gross?: number;
  weekGross?: number;
  monthGross?: number;
}

export interface BadgeSweepStats {
  shiftCount: number;
  expenseCount: number;
  weekendShifts: number;
  streakCount: number;
  totalActiveMileage: number;
  platformShiftCounts: Record<string, number>;
  weekShifts: number;
}

export interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: "milestone" | "streak" | "record" | "special";
  checkFromSweep?: (stats: BadgeSweepStats) => boolean | Promise<boolean>;
  checkFromShift?: (ctx: BadgeContext) => boolean | Promise<boolean>;
  checkFromPersonalRecords?: (r: { changedGross: boolean; changedNetHourly: boolean }) => boolean | Promise<boolean>;
  checkFromGoalHistory?: (g: { goal: any; hit: boolean }) => boolean | Promise<boolean>;
}

export const BADGES: BadgeDefinition[] = [
  // ─── Milestone badges ────────────────────────────────────────────────────────
  {
    id: "first_shift",
    name: "First Shift",
    description: "Log your first shift.",
    icon: "🚗",
    category: "milestone",
    checkFromSweep: (stats) => stats.shiftCount >= 1,
  },
  {
    id: "century_day",
    name: "Century Day",
    description: "Earn $100+ in a single day.",
    icon: "💯",
    category: "milestone",
    checkFromShift: (ctx) => (ctx.gross ?? 0) >= 100,
  },
  {
    id: "five_hundred_week",
    name: "Power Week",
    description: "Earn $500+ in one week.",
    icon: "💵",
    category: "milestone",
    checkFromShift: (ctx) => (ctx.weekGross ?? 0) >= 500,
  },
  {
    id: "thousand_month",
    name: "Thousand Club",
    description: "Earn $1,000+ in a month.",
    icon: "🏆",
    category: "milestone",
    checkFromShift: (ctx) => (ctx.monthGross ?? 0) >= 1000,
  },
  {
    id: "early_bird",
    name: "Early Bird",
    description: "Complete a shift starting before 7 AM.",
    icon: "🌅",
    category: "milestone",
    checkFromShift: (ctx) => {
      if (!ctx.shift?.startTime) return false;
      const hour = new Date(ctx.shift.startTime).getHours();
      return hour >= 3 && hour < 7;
    },
  },
  {
    id: "night_owl",
    name: "Night Owl",
    description: "Complete a shift ending after 10 PM.",
    icon: "🦉",
    category: "milestone",
    checkFromShift: (ctx) => {
      if (!ctx.shift?.endTime) return false;
      const hour = new Date(ctx.shift.endTime).getHours();
      return hour >= 22 || hour < 4;
    },
  },
  {
    id: "marathon_shift",
    name: "Marathon",
    description: "Work a single shift over 8 hours.",
    icon: "⏱️",
    category: "milestone",
    checkFromShift: (ctx) => (ctx.shift?.durationSeconds ?? 0) >= 8 * 3600,
  },
  {
    id: "tip_champion",
    name: "Tip Champion",
    description: "Earn tips above 25% of your gross on a shift.",
    icon: "💜",
    category: "milestone",
    checkFromShift: (ctx) => {
      const gross = ctx.gross ?? 0;
      const tips = ctx.shift?.tipsRevenue ?? ctx.shift?.tips ?? 0;
      return tips > 0 && gross > 0 && tips / gross >= 0.25;
    },
  },
  {
    id: "goal_week_hit",
    name: "Goal Achiever",
    description: "Hit a weekly earnings goal.",
    icon: "🎯",
    category: "milestone",
    checkFromGoalHistory: (g) => g.hit && g.goal.period === "weekly",
  },
  {
    id: "goal_month_hit",
    name: "Monthly Master",
    description: "Hit a monthly earnings goal.",
    icon: "👑",
    category: "milestone",
    checkFromGoalHistory: (g) => g.hit && g.goal.period === "monthly",
  },
  {
    id: "first_expense",
    name: "Paper Trail",
    description: "Log your first business expense.",
    icon: "🧾",
    category: "milestone",
    checkFromSweep: (stats) => stats.expenseCount >= 1,
  },
  {
    id: "expense_savvy",
    name: "Expense Savvy",
    description: "Track 10+ business expenses.",
    icon: "📝",
    category: "milestone",
    checkFromSweep: (stats) => stats.expenseCount >= 10,
  },
  {
    id: "vehicle_caretaker",
    name: "Vehicle Caretaker",
    description: "Log your first shift with a vehicle configured.",
    icon: "🔧",
    category: "milestone",
    checkFromSweep: (stats) => stats.shiftCount >= 1,
  },
  {
    id: "mileage_master",
    name: "Mileage Master",
    description: "Track 1,000 km of active delivery mileage.",
    icon: "🗺️",
    category: "milestone",
    checkFromSweep: (stats) => stats.totalActiveMileage >= 1000,
  },
  {
    id: "road_warrior",
    name: "Road Warrior",
    description: "Log 100 total shifts.",
    icon: "🏅",
    category: "milestone",
    checkFromSweep: (stats) => stats.shiftCount >= 100,
  },
  // ─── Record badges ────────────────────────────────────────────────────────────
  {
    id: "personal_best_earnings",
    name: "Record Breaker",
    description: "Set a new single-shift earnings record.",
    icon: "🚀",
    category: "record",
    checkFromPersonalRecords: (r) => r.changedGross,
  },
  {
    id: "personal_best_hours",
    name: "Efficiency Expert",
    description: "Set a new best hourly rate.",
    icon: "📈",
    category: "record",
    checkFromPersonalRecords: (r) => r.changedNetHourly,
  },
  // ─── Streak badges ────────────────────────────────────────────────────────────
  {
    id: "streak_7",
    name: "7-Day Streak",
    description: "Work 7 days in a row.",
    icon: "🔥",
    category: "streak",
    checkFromSweep: (stats) => stats.streakCount >= 7,
  },
  {
    id: "streak_30",
    name: "30-Day Streak",
    description: "Work 30 days in a row.",
    icon: "⚡",
    category: "streak",
    checkFromSweep: (stats) => stats.streakCount >= 30,
  },
  {
    id: "streak_100",
    name: "Centurion Streak",
    description: "Work 100 days in a row.",
    icon: "💥",
    category: "streak",
    checkFromSweep: (stats) => stats.streakCount >= 100,
  },
  {
    id: "perfect_week",
    name: "Perfect Week",
    description: "Log 7+ shifts in a single calendar week.",
    icon: "🌟",
    category: "streak",
    checkFromSweep: (stats) => stats.weekShifts >= 7,
  },
  // ─── Special badges ───────────────────────────────────────────────────────────
  {
    id: "weekend_warrior",
    name: "Weekend Warrior",
    description: "Work 10+ weekend shifts (Sat/Sun).",
    icon: "🛡️",
    category: "special",
    checkFromSweep: (stats) => stats.weekendShifts >= 10,
  },
  {
    id: "platform_expert",
    name: "Platform Expert",
    description: "Log 50 shifts on a single platform.",
    icon: "⭐",
    category: "special",
    checkFromSweep: (stats) => Object.values(stats.platformShiftCounts).some((v) => v >= 50),
  },
  {
    id: "daily_grinder",
    name: "Daily Grinder",
    description: "Work 5 or more shifts in a single week.",
    icon: "💪",
    category: "special",
    checkFromSweep: (stats) => stats.weekShifts >= 5,
  },
];

const byId = new Map(BADGES.map((b) => [b.id.toLowerCase(), b]));

export const BadgeRegistry = {
  getAll: () => BADGES,
  getById: (id: string | null | undefined) => {
    const key = String(id || "").toLowerCase();
    return byId.get(key);
  },
};
