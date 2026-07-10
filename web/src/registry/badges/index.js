/**
 * Badge / achievement registry (Category B).
 * @see docs/feature_modularity.md
 */

import bonusHunter from './bonus_hunter.badge.js';
import centuryDay from './century_day.badge.js';
import dataArchivist from './data_archivist.badge.js';
import earlyBird from './early_bird.badge.js';
import expenseSavvy from './expense_savvy.badge.js';
import firstShift from './first_shift.badge.js';
import fiveHundredWeek from './five_hundred_week.badge.js';
import goalMonthHit from './goal_month_hit.badge.js';
import goalWeekHit from './goal_week_hit.badge.js';
import marathonShift from './marathon_shift.badge.js';
import multiAppMaster from './multi_app_master.badge.js';
import nightOwl from './night_owl.badge.js';
import peakCollector from './peak_collector.badge.js';
import perfectWeek from './perfect_week.badge.js';
import personalBestEarnings from './personal_best_earnings.badge.js';
import personalBestHours from './personal_best_hours.badge.js';
import placeholder from './placeholder.badge.js';
import rainRider from './rain_rider.badge.js';
import streak100 from './streak_100.badge.js';
import streak30 from './streak_30.badge.js';
import streak7 from './streak_7.badge.js';
import thousandMonth from './thousand_month.badge.js';
import tipChampion from './tip_champion.badge.js';
import vehicleCaretaker from './vehicle_caretaker.badge.js';
import weekendWarrior from './weekend_warrior.badge.js';

/** @typedef {typeof placeholder} BadgeDefinition */

/** @type {BadgeDefinition[]} */
const BADGES = [
  firstShift,
  centuryDay,
  fiveHundredWeek,
  thousandMonth,
  earlyBird,
  nightOwl,
  marathonShift,
  multiAppMaster,
  tipChampion,
  bonusHunter,
  goalWeekHit,
  goalMonthHit,
  streak7,
  streak30,
  streak100,
  expenseSavvy,
  vehicleCaretaker,
  dataArchivist,
  personalBestEarnings,
  personalBestHours,
  weekendWarrior,
  rainRider,
  peakCollector,
  perfectWeek,
  placeholder,
];

/** @type {Map<string, BadgeDefinition>} */
const byId = new Map(BADGES.map((b) => [String(b.id).toLowerCase(), b]));

/**
 * @param {BadgeDefinition} def
 * @returns {boolean}
 */
function validateBadgeDefinition(def) {
  const required = ['id', 'name', 'description', 'icon', 'condition'];
  const missing = required.filter((k) => def[k] == null);
  if (missing.length) throw new Error(`Badge definition missing: ${missing.join(', ')}`);
  if (typeof def.condition !== 'function') throw new Error(`Badge ${def.id} missing condition`);
  return true;
}

export const BadgeRegistry = {
  /** @returns {readonly BadgeDefinition[]} */
  getAll: () => BADGES,

  /**
   * @param {string | null | undefined} id
   * @returns {BadgeDefinition | undefined}
   */
  getById: (id) => {
    const key = String(id || '').toLowerCase();
    return byId.get(key);
  },

  /** @param {BadgeDefinition} def */
  validate: (def) => validateBadgeDefinition(def),
};

export function assertBadgeRegistryValid() {
  for (const b of BADGES) validateBadgeDefinition(b);
}
