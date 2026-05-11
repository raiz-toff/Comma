/**
 * P8 — Notifications System.
 * On app-open checks with persistence in `notifications` table.
 */

import { db, getAppState, getUser } from '../../core/db.js';
import { isUserVaultActive } from '../../core/vault-gate.js';
import { showNotifyCard } from '../../ui/components.js';
import { getNextTaxDeadline } from '../../utils/locale.js';

const NOTIFICATION_TYPES = {
  dailySummary: 'daily_summary',
  midWeekGoal: 'mid_week_goal',
  weeklyGoalHit: 'weekly_goal_hit',
  weeklyGoalMiss: 'weekly_goal_miss',
  personalBest: 'personal_best',
  maintenanceDue: 'maintenance_due',
  insuranceExpiry: 'insurance_expiry',
  taxInstallment: 'tax_installment_due',
  streakRisk: 'streak_risk',
  backupOverdue: 'backup_overdue',
  lowHourlyRate: 'low_hourly_rate',
  highExpense: 'high_expense',
  milestoneProximity: 'milestone_proximity',
  crossPlatformArbitrage: 'cross_platform_arbitrage',
};

const DEFAULT_NOTIFICATION_SETTINGS = Object.freeze({
  frequency: 'immediate',
  enabled: true,
});

function nowIso() {
  return new Date().toISOString();
}

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function daysBetween(a, b) {
  const ms = startOfDay(b).getTime() - startOfDay(a).getTime();
  return Math.floor(ms / 86400000);
}

/**
 * @param {Date} date
 * @param {number} weekStartDay
 */
function weekBounds(date, weekStartDay) {
  const base = startOfDay(date);
  const dow = base.getDay();
  const diff = (dow - weekStartDay + 7) % 7;
  const start = new Date(base);
  start.setDate(base.getDate() - diff);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start, end };
}

/**
 * @param {string} type
 * @param {Date} date
 * @param {'day'|'week'|'ever'} scope
 */
function makeNotificationId(type, date, scope = 'day') {
  if (scope === 'ever') return `notif:${type}:ever`;
  if (scope === 'week') {
    const wk = weekBounds(date, 1);
    return `notif:${type}:week:${ymd(wk.start)}`;
  }
  return `notif:${type}:day:${ymd(date)}`;
}

/**
 * @param {unknown} raw
 * @returns {{ enabled: boolean, frequency: 'off'|'immediate'|'daily'|'weekly' }}
 */
function normalizeTypePref(raw) {
  if (raw === false) return { enabled: false, frequency: 'off' };
  if (raw === true || raw == null) return { ...DEFAULT_NOTIFICATION_SETTINGS };
  if (typeof raw !== 'object') return { ...DEFAULT_NOTIFICATION_SETTINGS };
  const obj = /** @type {{ enabled?: unknown, frequency?: unknown }} */ (raw);
  const enabled = obj.enabled == null ? true : Boolean(obj.enabled);
  const freqRaw = String(obj.frequency || 'immediate').toLowerCase();
  const frequency =
    freqRaw === 'off' || freqRaw === 'daily' || freqRaw === 'weekly'
      ? freqRaw
      : 'immediate';
  return { enabled, frequency };
}

/**
 * @param {Record<string, unknown> | null | undefined} prefs
 * @param {string} type
 */
function getPrefForType(prefs, type) {
  if (!prefs || typeof prefs !== 'object') return { ...DEFAULT_NOTIFICATION_SETTINGS };
  return normalizeTypePref(prefs[type]);
}

/**
 * @param {string} type
 * @param {string} title
 * @param {string} message
 * @param {{ tone?: 'info'|'warning'|'success'|'celebration', scope?: 'day'|'week'|'ever', dedupeKey?: string }} [opts]
 */
async function createNotification(type, title, message, opts = {}) {
  const user = await getUser();
  if (!isUserVaultActive(user)) return false;
  const pref = getPrefForType(user?.notificationPrefs, type);
  if (!pref.enabled || pref.frequency === 'off') return false;

  const createdAt = nowIso();
  const now = new Date(createdAt);
  const id = opts.dedupeKey || makeNotificationId(type, now, opts.scope || 'day');
  const existing = await db.notifications.get(id);
  if (existing) return false;

  await db.notifications.put({
    id,
    type,
    title,
    message,
    read: false,
    dismissed: false,
    createdAt,
    shownAt: null,
  });

  showNotifyCard({
    title,
    message,
    type: opts.tone || 'info',
    duration: 7000,
  });

  await db.notifications.update(id, {
    shownAt: nowIso(),
  });
  return true;
}

async function getWeeklyGoal(user, weekStart, weekEnd) {
  const activeGoal = await db.goals
    .filter((g) => g.active === true && g.scope === 'weekly' && g.type === 'earnings')
    .first();
  if (activeGoal && num(activeGoal.target) > 0) return num(activeGoal.target);
  const platformTargets = await db.platforms.filter((p) => p.active === true).toArray();
  const platformSum = platformTargets.reduce((sum, p) => sum + Math.max(0, num(p.weeklyGoal)), 0);
  if (platformSum > 0) return platformSum;
  const fallback = num(user?.weeklyGoal);
  if (fallback > 0) return fallback;

  const history = await db.shifts
    .filter((s) => s.deletedAt == null && String(s.date) >= weekStart && String(s.date) <= weekEnd)
    .toArray();
  return history.reduce((sum, s) => sum + Math.max(0, num(s.gross)), 0);
}

/**
 * @param {Array<Record<string, unknown>>} shifts
 */
function sumGross(shifts) {
  return shifts.reduce((sum, s) => sum + Math.max(0, num(s.gross ?? s.grossEarnings)), 0);
}

/**
 * @param {Array<Record<string, unknown>>} shifts
 */
function sumActiveMinutes(shifts) {
  return shifts.reduce((sum, s) => {
    const active = num(s.activeMinutes);
    if (active > 0) return sum + active;
    const online = num(s.onlineMinutes);
    if (online > 0) return sum + online;
    return sum;
  }, 0);
}

async function checkDailySummary(todayShifts) {
  const gross = sumGross(todayShifts);
  await createNotification(
    NOTIFICATION_TYPES.dailySummary,
    'Daily summary',
    `Today: ${todayShifts.length} shift${todayShifts.length === 1 ? '' : 's'}, gross ${gross.toFixed(2)}.`,
    { scope: 'day' },
  );
}

async function checkGoalNotifications(user, weekShifts, now) {
  const weekStartDay = Math.max(0, Math.min(6, num(user?.locale?.weekStartDay, 0)));
  const week = weekBounds(now, weekStartDay);
  const goal = await getWeeklyGoal(user, ymd(week.start), ymd(week.end));
  if (goal <= 0) return;

  const gross = sumGross(weekShifts);
  const progress = gross / goal;

  if (progress >= 1) {
    await createNotification(
      NOTIFICATION_TYPES.weeklyGoalHit,
      'Weekly goal complete',
      `Great work - you have reached your weekly goal (${gross.toFixed(0)} / ${goal.toFixed(0)}).`,
      { scope: 'week', tone: 'celebration' },
    );
  }

  if (now.getDay() === 3 && progress < 0.5) {
    await createNotification(
      NOTIFICATION_TYPES.midWeekGoal,
      'Mid-week check-in',
      `You are at ${(progress * 100).toFixed(0)}% of your weekly goal. Small focused sessions can close the gap.`,
      { scope: 'week', tone: 'warning' },
    );
  }

  if (now.getDay() === weekStartDay + 1) {
    const prevStart = new Date(week.start);
    prevStart.setDate(prevStart.getDate() - 7);
    const prevEnd = new Date(week.start);
    prevEnd.setDate(prevEnd.getDate() - 1);
    const prevRows = await db.shifts
      .filter((s) => s.deletedAt == null && s.date >= ymd(prevStart) && s.date <= ymd(prevEnd))
      .toArray();
    const prevGross = sumGross(prevRows);
    if (prevRows.length > 0 && prevGross < goal) {
      await createNotification(
        NOTIFICATION_TYPES.weeklyGoalMiss,
        'Last week reflection',
        `Last week finished at ${((prevGross / goal) * 100).toFixed(0)}% of goal. You can reset and build this week.`,
        { scope: 'week', tone: 'info', dedupeKey: `notif:${NOTIFICATION_TYPES.weeklyGoalMiss}:week:${ymd(prevStart)}` },
      );
    }
  }
}

async function checkPersonalBest(allShifts, weekShifts) {
  if (allShifts.length < 2 || weekShifts.length === 0) return;
  const sorted = [...allShifts]
    .filter((s) => s.deletedAt == null)
    .sort((a, b) => new Date(String(b.createdAt || b.updatedAt || '')).getTime() - new Date(String(a.createdAt || a.updatedAt || '')).getTime());
  const latest = sorted[0];
  if (!latest) return;
  const latestGross = num(latest.gross ?? latest.grossEarnings);
  const historicMax = allShifts.reduce((max, s) => Math.max(max, num(s.gross ?? s.grossEarnings)), 0);
  if (latestGross > 0 && latestGross >= historicMax) {
    await createNotification(
      NOTIFICATION_TYPES.personalBest,
      'New personal best',
      `New single-shift high: ${latestGross.toFixed(2)}. Keep this playbook for future sessions.`,
      { scope: 'week', tone: 'celebration' },
    );
  }
}

async function checkMaintenanceAndInsurance() {
  const expenses = await db.expenses.filter((e) => e.deletedAt == null).toArray();
  const now = new Date();

  const maintenanceRows = expenses.filter((e) => String(e.category || '') === 'maintenance');
  if (maintenanceRows.length > 0) {
    const last = maintenanceRows
      .map((e) => new Date(String(e.date || e.createdAt || nowIso())))
      .filter((d) => !Number.isNaN(d.getTime()))
      .sort((a, b) => b.getTime() - a.getTime())[0];
    if (last && daysBetween(last, now) >= 90) {
      await createNotification(
        NOTIFICATION_TYPES.maintenanceDue,
        'Maintenance check due',
        'No maintenance expense has been logged in about 90 days. Consider a quick vehicle check.',
        { scope: 'week', tone: 'warning' },
      );
    }
  }

  const insuranceRows = expenses.filter((e) => String(e.category || '') === 'insurance');
  if (insuranceRows.length > 0) {
    const lastInsurance = insuranceRows
      .map((e) => new Date(String(e.date || e.createdAt || nowIso())))
      .filter((d) => !Number.isNaN(d.getTime()))
      .sort((a, b) => b.getTime() - a.getTime())[0];
    if (lastInsurance && daysBetween(lastInsurance, now) >= 330) {
      await createNotification(
        NOTIFICATION_TYPES.insuranceExpiry,
        'Insurance renewal reminder',
        'Insurance appears to be nearing renewal based on your last logged insurance expense.',
        { scope: 'week', tone: 'warning' },
      );
    }
  }
}

async function checkTaxAndStreak(user, todayShifts) {
  const country = String(user?.locale?.country || 'US').toUpperCase();
  const nextTax = getNextTaxDeadline(country);
  if (nextTax.daysUntil >= 0 && nextTax.daysUntil <= 10) {
    await createNotification(
      NOTIFICATION_TYPES.taxInstallment,
      'Tax installment due soon',
      `${nextTax.label} is in ${nextTax.daysUntil} day${nextTax.daysUntil === 1 ? '' : 's'}.`,
      { scope: 'week', tone: 'warning' },
    );
  }

  const streakCount = Math.max(0, num(await getAppState('streak_count')));
  if (streakCount > 0 && todayShifts.length === 0) {
    await createNotification(
      NOTIFICATION_TYPES.streakRisk,
      'Streak at risk',
      `You are on a ${streakCount}-day streak. Logging even one short shift today keeps it alive.`,
      { scope: 'day', tone: 'warning' },
    );
  }
}

async function checkBackupAndRatios(weekShifts, weekExpenses) {
  const lastBackup = await getAppState('last_backup');
  if (typeof lastBackup === 'string' && lastBackup) {
    const d = new Date(lastBackup);
    if (!Number.isNaN(d.getTime()) && daysBetween(d, new Date()) >= 14) {
      await createNotification(
        NOTIFICATION_TYPES.backupOverdue,
        'Backup recommended',
        'Your last backup is over 14 days old. A fresh export keeps your data safe.',
        { scope: 'week', tone: 'warning' },
      );
    }
  }

  const weekGross = sumGross(weekShifts);
  const weekMinutes = sumActiveMinutes(weekShifts);
  if (weekGross > 0 && weekMinutes > 0) {
    const hourly = (weekGross / weekMinutes) * 60;
    if (hourly < 15) {
      await createNotification(
        NOTIFICATION_TYPES.lowHourlyRate,
        'Low hourly rate warning',
        `This week is averaging ${hourly.toFixed(2)} per hour. Consider adjusting zone, timing, or platform mix.`,
        { scope: 'week', tone: 'warning' },
      );
    }
  }

  const expenseTotal = weekExpenses.reduce(
    (sum, e) => sum + Math.max(0, num(e.amount)) * (Math.max(0, Math.min(100, num(e.businessPct, 100))) / 100),
    0,
  );
  if (weekGross > 0) {
    const ratio = (expenseTotal / weekGross) * 100;
    if (ratio >= 35) {
      await createNotification(
        NOTIFICATION_TYPES.highExpense,
        'High expense ratio',
        `Expenses are ${ratio.toFixed(0)}% of weekly gross. Review categories for savings opportunities.`,
        { scope: 'week', tone: 'warning' },
      );
    }
  }
}

async function checkMilestonesAndArbitrage(user, allShifts, weekShifts) {
  const lifetimeGross = sumGross(allShifts);
  const milestones = [1000, 5000, 10000, 25000, 50000, 100000];
  const nextMilestone = milestones.find((m) => lifetimeGross < m);
  if (nextMilestone != null) {
    const gap = nextMilestone - lifetimeGross;
    if (gap > 0 && gap <= nextMilestone * 0.1) {
      await createNotification(
        NOTIFICATION_TYPES.milestoneProximity,
        'Milestone nearby',
        `You are ${gap.toFixed(0)} away from ${nextMilestone.toLocaleString()} lifetime gross.`,
        { scope: 'week', tone: 'info' },
      );
    }
  }

  const activePlatforms = await db.platforms.filter((p) => p.active === true).toArray();
  if (activePlatforms.length < 2) return;
  const map = new Map();
  for (const s of weekShifts) {
    const pid = String(s.platformId || '');
    if (!pid) continue;
    const gross = Math.max(0, num(s.gross ?? s.grossEarnings));
    const minutes = Math.max(0, num(s.activeMinutes) || num(s.onlineMinutes));
    if (minutes <= 0 || gross <= 0) continue;
    const rec = map.get(pid) || { gross: 0, minutes: 0 };
    rec.gross += gross;
    rec.minutes += minutes;
    map.set(pid, rec);
  }
  const rates = [...map.entries()]
    .map(([pid, rec]) => ({ pid, hourly: (rec.gross / rec.minutes) * 60 }))
    .sort((a, b) => b.hourly - a.hourly);
  if (rates.length < 2) return;
  const top = rates[0];
  const runnerUp = rates[1];
  if (top.hourly > 0 && (top.hourly - runnerUp.hourly) / top.hourly >= 0.25) {
    const label = activePlatforms.find((p) => String(p.id) === top.pid)?.name || top.pid;
    await createNotification(
      NOTIFICATION_TYPES.crossPlatformArbitrage,
      'Cross-platform opportunity',
      `${label} is outperforming your next platform this week. Consider prioritizing its peak windows.`,
      { scope: 'week', tone: 'info' },
    );
  }
  void user;
}

/**
 * Full P8 notification sweep, intended for app-open.
 * @returns {Promise<void>}
 */
export async function checkAllNotifications() {
  const user = await getUser();
  if (!user || !isUserVaultActive(user)) return;
  const now = new Date();
  const today = ymd(now);
  const weekStartDay = Math.max(0, Math.min(6, num(user?.locale?.weekStartDay, 0)));
  const week = weekBounds(now, weekStartDay);
  const weekStart = ymd(week.start);
  const weekEnd = ymd(week.end);

  const [allShifts, todayShifts, weekShifts, weekExpenses] = await Promise.all([
    db.shifts.filter((s) => s.deletedAt == null).toArray(),
    db.shifts.filter((s) => s.deletedAt == null && s.date === today).toArray(),
    db.shifts.filter((s) => s.deletedAt == null && s.date >= weekStart && s.date <= weekEnd).toArray(),
    db.expenses.filter((e) => e.deletedAt == null && e.date >= weekStart && e.date <= weekEnd).toArray(),
  ]);

  await checkDailySummary(todayShifts);
  await checkGoalNotifications(user, weekShifts, now);
  await checkPersonalBest(allShifts, weekShifts);
  await checkMaintenanceAndInsurance();
  await checkTaxAndStreak(user, todayShifts);
  await checkBackupAndRatios(weekShifts, weekExpenses);
  await checkMilestonesAndArbitrage(user, allShifts, weekShifts);
}

/** @returns {Promise<void>} */
export async function runOnOpenNotificationCheck() {
  await checkAllNotifications();
}

/**
 * Mark a notification as read (Feature: read tracking).
 * @param {string} id
 */
export async function markNotificationRead(id) {
  if (!id) return;
  await db.notifications.update(id, { read: true, readAt: nowIso() });
}

/**
 * Mark a notification as dismissed (Feature: dismiss tracking).
 * @param {string} id
 */
export async function dismissNotification(id) {
  if (!id) return;
  await db.notifications.update(id, { dismissed: true, dismissedAt: nowIso(), read: true });
}
