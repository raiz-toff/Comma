import { db, getAppState, setAppState } from '../../core/db.js';
import { BadgeRegistry } from '../../registry/badges/index.js';
import { GoalScopeRegistry, GoalTypeRegistry } from '../../registry/goal-types/index.js';
import {
  bus,
  BADGE_UNLOCKED,
  GOAL_UPDATED,
  SHIFT_SAVED,
  XP_EARNED,
} from '../../core/events.js';

const APP_STATE_KEYS = {
  XP_TOTAL: 'xp_total',
  XP_LEVEL: 'xp_level',
  STREAK_LAST_DAY: 'streak_last_day',
  STREAK_COUNT: 'streak_count',
  STREAK_FROZEN_COUNT: 'streak_frozen_count',
  WEEK_GOAL_STREAK: 'week_goal_streak_count',
  PERSONAL_RECORDS: 'personal_records',
};

const GOAL_SCOPES = GoalScopeRegistry.keysAsSet();
const GOAL_TYPES = GoalTypeRegistry.keysAsSet();

const DEFAULT_CHALLENGES = [
  {
    id: 'challenge_earn_500_week',
    name: 'Earn 500 This Week',
    description: 'Reach $500 gross earnings this week.',
    metric: 'earnings',
    target: 500,
  },
  {
    id: 'challenge_20_deliveries_week',
    name: '20 Deliveries',
    description: 'Complete 20 deliveries this week.',
    metric: 'deliveries',
    target: 20,
  },
  {
    id: 'challenge_5_shift_streak',
    name: '5 Shift Streak',
    description: 'Log shifts on 5 consecutive days.',
    metric: 'streak',
    target: 5,
  },
];

const XP_BY_ACTION = {
  shift_saved: 10,
  badge_unlocked: 40,
  challenge_completed: 60,
  goal_hit: 25,
  personal_record: 30,
};

let initialized = false;

function nowIso() {
  return new Date().toISOString();
}

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toYmd(input) {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfWeek(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = d.getDay();
  d.setDate(d.getDate() - diff);
  return d;
}

function endOfWeek(date) {
  const d = new Date(startOfWeek(date));
  d.setDate(d.getDate() + 6);
  return d;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

async function sumShiftMetric(startDate, endDate, metric) {
  const start = toYmd(startDate);
  const end = toYmd(endDate);
  if (!start || !end) return 0;
  const shifts = await db.shifts
    .where('date')
    .between(start, end, true, true)
    .filter((row) => row.deletedAt == null)
    .toArray();

  let total = 0;
  for (const shift of shifts) {
    if (metric === 'earnings') {
      const base = shift.grossEarnings != null ? num(shift.grossEarnings) / 100 : num(shift.gross, 0);
      const tips = shift.grossEarnings != null ? num(shift.tips ?? 0) / 100 : num(shift.tips, 0);
      const bonus = shift.grossEarnings != null ? num(shift.bonusEarnings ?? shift.bonus ?? 0) / 100 : num(shift.bonus, 0);
      total += (base + tips + bonus);
    }
    else if (metric === 'tips') {
      total += shift.grossEarnings != null ? num(shift.tips ?? 0) / 100 : num(shift.tips, 0);
    }
    else if (metric === 'deliveries') total += num(shift.orders ?? shift.deliveryCount, 0);
    else if (metric === 'hours') total += num(shift.activeMinutes ?? shift.durationMinutes, 0) / 60;
    else if (metric === 'distance') total += num(shift.distanceKm, 0);
    else if (metric === 'net_profit') {
      const g = shift.grossEarnings != null ? num(shift.grossEarnings ?? 0) / 100 : num(shift.gross, 0);
      const tips = shift.grossEarnings != null ? num(shift.tips ?? 0) / 100 : num(shift.tips, 0);
      const bonus = shift.grossEarnings != null ? num(shift.bonusEarnings ?? shift.bonus ?? 0) / 100 : num(shift.bonus, 0);
      total += Math.max(0, g - tips - bonus);
    }
  }
  return total;
}

function xpLevelFromTotal(totalXp) {
  return Math.max(1, Math.floor(num(totalXp, 0) / 100) + 1);
}

async function fireBadgeConfetti() {
  if (typeof window === 'undefined') return;
  if (!window.confetti) {
    try {
      await import('../../libs/confetti.min.js');
    } catch {
      return;
    }
  }
  if (typeof window.confetti === 'function') {
    window.confetti({
      particleCount: 90,
      spread: 60,
      origin: { y: 0.7 },
      scalar: 0.85,
    });
  }
}

async function getShiftCount() {
  return db.shifts.filter((row) => row.deletedAt == null).count();
}

async function getExpenseCount() {
  return db.expenses.filter((row) => row.deletedAt == null).count();
}

async function getWeekendShiftCount() {
  const shifts = await db.shifts.filter((row) => row.deletedAt == null).toArray();
  let count = 0;
  for (const shift of shifts) {
    const day = new Date(`${shift.date}T00:00:00`).getDay();
    if (day === 0 || day === 6) count += 1;
  }
  return count;
}

async function getCurrentStreakCount() {
  return num(await getAppState(APP_STATE_KEYS.STREAK_COUNT), 0);
}

async function maybeUnlockBadge(id) {
  const badge = await db.badges.get(id);
  if (!badge || badge.unlockedAt) return false;
  await db.badges.update(id, { unlockedAt: nowIso(), notified: true });
  bus.emit(BADGE_UNLOCKED, { id });
  await fireBadgeConfetti();
  await awardXP('badge_unlocked', { badgeId: id });
  return true;
}

async function refreshChallengeProgress({ earnings, deliveries, streak }) {
  const rows = await db.challenges.filter((row) => row.active === true).toArray();
  const t = nowIso();
  for (const challenge of rows) {
    let current = num(challenge.current, 0);
    if (challenge.metric === 'earnings') current = earnings;
    if (challenge.metric === 'deliveries') current = deliveries;
    if (challenge.metric === 'streak') current = streak;
    const completed = current >= num(challenge.target, 0);
    await db.challenges.update(challenge.id, {
      current,
      completedAt: completed && !challenge.completedAt ? t : challenge.completedAt ?? null,
    });
    if (completed && !challenge.completedAt) {
      await awardXP('challenge_completed', { challengeId: challenge.id });
    }
  }
}

async function evaluateGoalHistory() {
  const activeGoals = await db.goals.filter((g) => g.active === true).toArray();
  const now = new Date();
  for (const goal of activeGoals) {
    let periodStart;
    let periodEnd;
    if (goal.scope === 'daily') {
      periodStart = now;
      periodEnd = now;
    } else if (goal.scope === 'weekly') {
      periodStart = startOfWeek(now);
      periodEnd = endOfWeek(now);
    } else if (goal.scope === 'monthly') {
      periodStart = startOfMonth(now);
      periodEnd = endOfMonth(now);
    } else {
      continue;
    }
    const actual = await sumShiftMetric(periodStart, periodEnd, goal.type);
    const hit = actual >= num(goal.target, Infinity);
    const startStr = toYmd(periodStart);
    const endStr = toYmd(periodEnd);
    if (!startStr || !endStr) continue;
    const existing = await db.goalHistory
      .filter((row) => row.goalId === goal.id && row.periodStart === startStr && row.periodEnd === endStr)
      .first();
    if (existing) {
      await db.goalHistory.update(existing.id, {
        actual,
        hit,
        target: num(goal.target, 0),
        notes: hit ? 'Goal hit' : '',
      });
    } else {
      await db.goalHistory.add({
        goalId: goal.id,
        periodStart: startStr,
        periodEnd: endStr,
        target: num(goal.target, 0),
        actual,
        hit,
        notes: hit ? 'Goal hit' : '',
        createdAt: nowIso(),
      });
    }
    if (goal.scope === 'weekly' && goal.type === 'earnings' && hit) {
      const streak = num(await getAppState(APP_STATE_KEYS.WEEK_GOAL_STREAK), 0) + 1;
      await setAppState(APP_STATE_KEYS.WEEK_GOAL_STREAK, streak);
    }
    if (hit) {
      const gctx = { goal, hit };
      for (const b of BadgeRegistry.getAll()) {
        if (b.id === 'placeholder') continue;
        if (typeof b.checkFromGoalHistory !== 'function') continue;
        if (await b.checkFromGoalHistory(gctx)) await maybeUnlockBadge(b.id);
      }
    }
  }
}

export async function awardXP(action, meta = {}) {
  const xp = num(XP_BY_ACTION[action], 5);
  const total = num(await getAppState(APP_STATE_KEYS.XP_TOTAL), 0) + xp;
  const level = xpLevelFromTotal(total);
  await setAppState(APP_STATE_KEYS.XP_TOTAL, total);
  await setAppState(APP_STATE_KEYS.XP_LEVEL, level);
  await db.xpLog.add({
    action,
    xp,
    description: JSON.stringify(meta),
    createdAt: nowIso(),
  });
  bus.emit(XP_EARNED, { action, xp, total, level });
  return { action, xp, total, level };
}

export async function checkPersonalRecords(newShift) {
  const stored = (await getAppState(APP_STATE_KEYS.PERSONAL_RECORDS)) || {};
  const records = {
    bestShiftGross: num(stored.bestShiftGross, 0),
    bestNetHourly: num(stored.bestNetHourly, 0),
  };

  let changed = false;
  let changedGross = false;
  let changedNetHourly = false;
  const base = newShift?.grossEarnings != null ? num(newShift.grossEarnings) / 100 : num(newShift?.gross ?? newShift?.grossEarnings, 0);
  const tips = newShift?.grossEarnings != null ? num(newShift.tips ?? 0) / 100 : num(newShift?.tips, 0);
  const bonus = newShift?.grossEarnings != null ? num(newShift.bonusEarnings ?? newShift.bonus ?? 0) / 100 : num(newShift?.bonus, 0);
  const gross = base + tips + bonus;
  if (gross > records.bestShiftGross) {
    records.bestShiftGross = gross;
    changed = true;
    changedGross = true;
  }

  const minutes = num(newShift?.activeMinutes ?? newShift?.durationMinutes, 0);
  const netHourly = minutes > 0 ? (gross / minutes) * 60 : 0;
  if (netHourly > records.bestNetHourly) {
    records.bestNetHourly = netHourly;
    changed = true;
    changedNetHourly = true;
  }

  if (changedGross || changedNetHourly) {
    for (const b of BadgeRegistry.getAll()) {
      if (b.id === 'placeholder') continue;
      if (typeof b.checkFromPersonalRecords !== 'function') continue;
      if (await b.checkFromPersonalRecords({ changedGross, changedNetHourly })) await maybeUnlockBadge(b.id);
    }
  }

  if (changed) {
    await setAppState(APP_STATE_KEYS.PERSONAL_RECORDS, records);
    await awardXP('personal_record');
  }
  return records;
}

async function updateDayStreak(shiftDate) {
  const currentDate = toYmd(shiftDate);
  if (!currentDate) return num(await getAppState(APP_STATE_KEYS.STREAK_COUNT), 0);
  const lastDate = await getAppState(APP_STATE_KEYS.STREAK_LAST_DAY);
  const previous = lastDate ? new Date(`${lastDate}T00:00:00`) : null;
  const current = new Date(`${currentDate}T00:00:00`);

  let streak = num(await getAppState(APP_STATE_KEYS.STREAK_COUNT), 0);
  let freezes = num(await getAppState(APP_STATE_KEYS.STREAK_FROZEN_COUNT), 1);
  if (previous) {
    const diffDays = Math.round((current.getTime() - previous.getTime()) / 86400000);
    if (diffDays === 1) streak += 1;
    else if (diffDays === 0) streak = Math.max(streak, 1);
    else if (diffDays > 1 && freezes > 0) freezes -= 1;
    else if (diffDays > 1) streak = 1;
  } else {
    streak = 1;
  }

  await setAppState(APP_STATE_KEYS.STREAK_LAST_DAY, currentDate);
  await setAppState(APP_STATE_KEYS.STREAK_COUNT, streak);
  await setAppState(APP_STATE_KEYS.STREAK_FROZEN_COUNT, freezes);

  return streak;
}

export async function checkAllBadges() {
  const [shiftCount, expenseCount, weekendShifts, streakCount] = await Promise.all([
    getShiftCount(),
    getExpenseCount(),
    getWeekendShiftCount(),
    getCurrentStreakCount(),
  ]);
  const stats = { shiftCount, expenseCount, weekendShifts, streakCount };
  for (const b of BadgeRegistry.getAll()) {
    if (b.id === 'placeholder') continue;
    if (typeof b.checkFromSweep !== 'function') continue;
    if (await b.checkFromSweep(stats)) await maybeUnlockBadge(b.id);
  }
}

async function handleShiftSaved(payload) {
  const shiftId = payload && Number.isFinite(Number(payload.id)) ? Number(payload.id) : null;
  if (!shiftId) return;
  const shift = await db.shifts.get(shiftId);
  if (!shift || shift.deletedAt != null) return;

  await awardXP('shift_saved', { shiftId });
  const streak = await updateDayStreak(shift.date);
  await checkPersonalRecords(shift);
  await checkAllBadges();

  const base = shift.grossEarnings != null ? num(shift.grossEarnings) / 100 : num(shift.gross ?? shift.grossEarnings, 0);
  const tips = shift.grossEarnings != null ? num(shift.tips ?? 0) / 100 : num(shift.tips, 0);
  const bonus = shift.grossEarnings != null ? num(shift.bonusEarnings ?? shift.bonus ?? 0) / 100 : num(shift.bonus, 0);
  const gross = base + tips + bonus;
  const weekGross = await sumShiftMetric(startOfWeek(new Date()), endOfWeek(new Date()), 'earnings');
  const monthGross = await sumShiftMetric(startOfMonth(new Date()), endOfMonth(new Date()), 'earnings');
  const shiftCtx = { shift, gross, weekGross, monthGross };
  for (const b of BadgeRegistry.getAll()) {
    if (b.id === 'placeholder') continue;
    if (typeof b.checkFromShift !== 'function') continue;
    if (await b.checkFromShift(shiftCtx)) await maybeUnlockBadge(b.id);
  }

  const deliveries = num(shift.orders ?? shift.deliveryCount, 0);
  await refreshChallengeProgress({ earnings: weekGross, deliveries, streak });
  await evaluateGoalHistory();
  bus.emit(GOAL_UPDATED, { source: 'shift_saved', shiftId });
}

async function ensureChallengeSeeds() {
  for (const def of DEFAULT_CHALLENGES) {
    const existing = await db.challenges.get(def.id);
    if (!existing) {
      await db.challenges.put({
        id: def.id,
        name: def.name,
        description: def.description,
        metric: def.metric,
        target: def.target,
        current: 0,
        active: true,
        completedAt: null,
        startedAt: nowIso(),
        expiresAt: null,
      });
    }
  }
}

export async function ensureGoalScaffold() {
  const goals = await db.goals.toArray();
  if (goals.length === 0) {
    const t = nowIso();
    await db.goals.bulkAdd([
      { type: 'earnings', scope: 'daily', platformId: null, target: 80, active: true, createdAt: t },
      { type: 'earnings', scope: 'weekly', platformId: null, target: 500, active: true, createdAt: t },
      { type: 'earnings', scope: 'monthly', platformId: null, target: 2000, active: true, createdAt: t },
    ]);
  }
  await ensureChallengeSeeds();
}

export async function initGoalsModule() {
  if (initialized) return;
  initialized = true;
  await ensureGoalScaffold();
  bus.on(SHIFT_SAVED, (payload) => {
    void handleShiftSaved(payload).catch((err) => {
      console.warn('[comma goals] shift handler failed', err);
    });
  });
}

export async function listGoals() {
  return db.goals.toArray();
}

export async function upsertGoal(goal) {
  const scope = String(goal.scope || '').toLowerCase();
  const type = String(goal.type || '').toLowerCase();
  if (!GOAL_SCOPES.has(scope)) throw new Error('goal:scope:invalid');
  if (!GOAL_TYPES.has(type)) throw new Error('goal:type:invalid');
  const row = {
    id: goal.id ? Number(goal.id) : undefined,
    type,
    scope,
    platformId: goal.platformId ?? null,
    target: Math.max(0, num(goal.target, 0)),
    active: goal.active !== false,
    createdAt: goal.createdAt || nowIso(),
  };
  if (row.id) await db.goals.put(row);
  else row.id = await db.goals.add(row);
  bus.emit(GOAL_UPDATED, { source: 'upsert_goal', goalId: row.id });
  return row;
}

export async function listGoalHistory(limit = 30) {
  const rows = await db.goalHistory.orderBy('periodStart').reverse().limit(limit).toArray();
  return rows;
}

export async function listBadges() {
  return db.badges.toArray();
}

export async function listChallenges() {
  return db.challenges.toArray();
}

export async function getActiveGoalsWithProgress() {
  const activeGoals = await db.goals.filter((g) => g.active === true).toArray();
  const now = new Date();
  const results = [];
  for (const goal of activeGoals) {
    let periodStart;
    let periodEnd;
    if (goal.scope === 'daily') {
      periodStart = now;
      periodEnd = now;
    } else if (goal.scope === 'weekly') {
      periodStart = startOfWeek(now);
      periodEnd = endOfWeek(now);
    } else if (goal.scope === 'monthly') {
      periodStart = startOfMonth(now);
      periodEnd = endOfMonth(now);
    } else {
      results.push({ ...goal, current: 0, progress: 0 });
      continue;
    }
    const current = await sumShiftMetric(periodStart, periodEnd, goal.type);
    const progress = goal.target > 0 ? Math.min(1, current / goal.target) : 0;
    results.push({ ...goal, current, progress });
  }
  return results;
}

export async function getEarningsThermometer() {
  const weeklyGoal = await db.goals
    .filter((g) => g.active === true && g.scope === 'weekly' && g.type === 'earnings')
    .first();
  const target = Math.max(1, num(weeklyGoal?.target, 500));
  const current = await sumShiftMetric(startOfWeek(new Date()), endOfWeek(new Date()), 'earnings');
  const progress = Math.min(1, current / target);
  return { current, target, progress };
}

export async function getGoalDashboardData() {
  const [goals, badges, challenges, history, thermometer] = await Promise.all([
    getActiveGoalsWithProgress(),
    listBadges(),
    listChallenges(),
    listGoalHistory(10),
    getEarningsThermometer(),
  ]);
  const streakDays = num(await getAppState(APP_STATE_KEYS.STREAK_COUNT), 0);
  const weekGoalStreak = num(await getAppState(APP_STATE_KEYS.WEEK_GOAL_STREAK), 0);
  const xpTotal = num(await getAppState(APP_STATE_KEYS.XP_TOTAL), 0);
  const xpLevel = num(await getAppState(APP_STATE_KEYS.XP_LEVEL), 1);
  const records = (await getAppState(APP_STATE_KEYS.PERSONAL_RECORDS)) || {};

  return {
    goals,
    badges,
    challenges,
    history,
    thermometer,
    streakDays,
    weekGoalStreak,
    xpTotal,
    xpLevel,
    records,
  };
}
