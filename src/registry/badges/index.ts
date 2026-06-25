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
    description: "Complete a shift starting before 7am.",
    icon: "🌅",
    category: "milestone",
    checkFromShift: (ctx) => {
      if (!ctx.shift?.startTime) return false;
      const start = new Date(ctx.shift.startTime);
      const hour = start.getHours();
      return hour >= 3 && hour < 7;
    },
  },
  {
    id: "night_owl",
    name: "Night Owl",
    description: "Complete a shift ending late (after 10 PM).",
    icon: "🦉",
    category: "milestone",
    checkFromShift: (ctx) => {
      if (!ctx.shift?.endTime) return false;
      const end = new Date(ctx.shift.endTime);
      const hour = end.getHours();
      return hour >= 22 || hour < 4;
    },
  },
  {
    id: "marathon_shift",
    name: "Marathon",
    description: "Work a single shift over 8 hours.",
    icon: "⏱️",
    category: "milestone",
    checkFromShift: (ctx) => {
      const durSec = ctx.shift?.durationSeconds ?? 0;
      return durSec >= 8 * 3600;
    },
  },
  {
    id: "multi_app_master",
    name: "Multi-App",
    description: "Log a multi-app shift.",
    icon: "📱",
    category: "milestone",
    checkFromShift: (ctx) => {
      return ctx.shift?.platform === "multiapp" || ctx.shift?.isMultiApp === true;
    },
  },
  {
    id: "tip_champion",
    name: "Tip Champion",
    description: "Tip rate above 25% on a shift.",
    icon: "💜",
    category: "milestone",
    checkFromShift: (ctx) => {
      const gross = ctx.gross ?? 0;
      const tips = ctx.shift?.tipsRevenue ?? ctx.shift?.tips ?? 0;
      return tips > 0 && gross > 0 && tips / gross >= 0.25;
    },
  },
  {
    id: "bonus_hunter",
    name: "Bonus Hunter",
    description: "Bonus earnings over 15% of gross on a shift.",
    icon: "🎯",
    category: "milestone",
    checkFromShift: (ctx) => {
      const gross = ctx.gross ?? 0;
      const bonus = ctx.shift?.bonusEarnings ?? ctx.shift?.bonus ?? 0;
      return bonus > 0 && gross > 0 && bonus / gross >= 0.15;
    },
  },
  {
    id: "goal_week_hit",
    name: "Goal Achiever",
    description: "Hit your weekly earnings goal.",
    icon: "🎯",
    category: "milestone",
    checkFromGoalHistory: (g) => g.hit && g.goal.period === "weekly" && g.goal.unit === "currency",
  },
  {
    id: "goal_month_hit",
    name: "Monthly Master",
    description: "Hit your monthly earnings goal.",
    icon: "👑",
    category: "milestone",
    checkFromGoalHistory: (g) => g.hit && g.goal.period === "monthly" && g.goal.unit === "currency",
  },
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
    description: "Configure an active vehicle.",
    icon: "🔧",
    category: "milestone",
    checkFromSweep: (stats) => stats.shiftCount >= 1, // Simple fallback trigger
  },
  {
    id: "data_archivist",
    name: "Data Archivist",
    description: "Maintain a secure backup.",
    icon: "💾",
    category: "milestone",
    checkFromSweep: (stats) => stats.shiftCount >= 5,
  },
  {
    id: "personal_best_earnings",
    name: "Record Breaker",
    description: "Set a new single shift earnings record.",
    icon: "🚀",
    category: "record",
    checkFromPersonalRecords: (r) => r.changedGross,
  },
  {
    id: "personal_best_hours",
    name: "Efficiency Expert",
    description: "Set a new hourly rate record.",
    icon: "📈",
    category: "record",
    checkFromPersonalRecords: (r) => r.changedNetHourly,
  },
  {
    id: "weekend_warrior",
    name: "Weekend Warrior",
    description: "Work 10+ weekend shifts.",
    icon: "🛡️",
    category: "special",
    checkFromSweep: (stats) => stats.weekendShifts >= 10,
  },
  {
    id: "rain_rider",
    name: "Rain Rider",
    description: "Log a shift in rain weather.",
    icon: "🌧️",
    category: "special",
    checkFromShift: (ctx) => {
      const weather = String(ctx.shift?.notes ?? "").toLowerCase();
      return weather.includes("rain") || weather.includes("storm") || weather.includes("wet");
    },
  },
  {
    id: "peak_collector",
    name: "Peak Collector",
    description: "Earn extra peak pay bonus on a shift.",
    icon: "🏔️",
    category: "special",
    checkFromShift: (ctx) => {
      const notes = String(ctx.shift?.notes ?? "").toLowerCase();
      return notes.includes("peak") || notes.includes("promot") || notes.includes("surge");
    },
  },
  {
    id: "perfect_week",
    name: "Perfect Week",
    description: "Work every day in a calendar week.",
    icon: "🌟",
    category: "streak",
    checkFromSweep: (stats) => stats.streakCount >= 7,
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
