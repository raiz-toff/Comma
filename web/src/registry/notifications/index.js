/**
 * Notification type registry (Category B).
 * @see docs/feature_modularity.md
 */

import backupOverdue from './backup_overdue.notification.js';
import bestDayOfWeek from './best_day_of_week.notification.js';
import crossPlatformArbitrage from './cross_platform_arbitrage.notification.js';
import dailySummary from './daily_summary.notification.js';
import dataEntryGap from './data_entry_gap.notification.js';
import earningsTrend from './earnings_trend.notification.js';
import highExpense from './high_expense.notification.js';
import hstRemittanceUpcoming from './hst_remittance_upcoming.notification.js';
import hstThresholdApproaching from './hst_threshold_approaching.notification.js';
import idleDayAlert from './idle_day_alert.notification.js';
import insuranceExpiry from './insurance_expiry.notification.js';
import longShiftAlert from './long_shift_alert.notification.js';
import lowHourlyRate from './low_hourly_rate.notification.js';
import maintenanceDue from './maintenance_due.notification.js';
import mileageLogReminder from './mileage_log_reminder.notification.js';
import milestoneProximity from './milestone_proximity.notification.js';
import midWeekGoal from './mid_week_goal.notification.js';
import personalBest from './personal_best.notification.js';
import placeholder from './placeholder.notification.js';
import platformConcentration from './platform_concentration.notification.js';
import streakRisk from './streak_risk.notification.js';
import t4aSeason from './t4a_season.notification.js';
import taxInstallmentDue from './tax_installment_due.notification.js';
import vehicleServiceDue from './vehicle_service_due.notification.js';
import weeklyGoalHit from './weekly_goal_hit.notification.js';
import weeklyGoalMiss from './weekly_goal_miss.notification.js';

/** @typedef {typeof placeholder} NotificationDefinition */

const TYPES = new Set(['toast', 'card', 'celebration']);

/** @type {NotificationDefinition[]} */
const NOTIFICATIONS = [
  dailySummary,
  weeklyGoalHit,
  midWeekGoal,
  weeklyGoalMiss,
  personalBest,
  maintenanceDue,
  insuranceExpiry,
  taxInstallmentDue,
  streakRisk,
  backupOverdue,
  lowHourlyRate,
  highExpense,
  milestoneProximity,
  crossPlatformArbitrage,
  hstThresholdApproaching,
  mileageLogReminder,
  t4aSeason,
  hstRemittanceUpcoming,
  idleDayAlert,
  dataEntryGap,
  vehicleServiceDue,
  longShiftAlert,
  platformConcentration,
  earningsTrend,
  bestDayOfWeek,
  placeholder,
];

/** @type {Map<string, NotificationDefinition>} */
const byId = new Map(NOTIFICATIONS.map((n) => [n.id, n]));

/**
 * @param {NotificationDefinition} def
 * @returns {boolean}
 */
function validateNotificationDefinition(def) {
  const required = ['id', 'type', 'cooldown', 'message', 'priority'];
  const missing = required.filter((k) => def[k] == null);
  if (missing.length) throw new Error(`Notification definition missing: ${missing.join(', ')}`);
  if (!TYPES.has(def.type)) throw new Error(`Notification ${def.id} has invalid type`);
  if (typeof def.evaluate !== 'function' && typeof def.condition !== 'function') {
    throw new Error(`Notification ${def.id} needs evaluate or condition`);
  }
  const msg = def.message;
  if (typeof msg !== 'function' && typeof msg !== 'string') throw new Error(`Notification ${def.id} missing message`);
  return true;
}

export const NotificationRegistry = {
  /** @returns {readonly NotificationDefinition[]} */
  getAll: () => NOTIFICATIONS,

  /**
   * @param {string | null | undefined} id
   * @returns {NotificationDefinition | undefined}
   */
  getById: (id) => {
    const key = String(id || '').toLowerCase();
    return byId.get(key);
  },

  /** @param {NotificationDefinition} def */
  validate: (def) => validateNotificationDefinition(def),
};

export function assertNotificationRegistryValid() {
  const invalid = NOTIFICATIONS.filter(
    (d) => !d.id || !d.priority || typeof d.evaluate !== 'function'
  );
  if (invalid.length) {
    console.error('Invalid notification definitions:', invalid.map((d) => d.id));
  }
}
