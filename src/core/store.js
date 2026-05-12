/**
 * Reactive working memory (F6) — pub/sub state synced with Dexie via `loadFromDB` / `refresh`.
 * F5 shell/router keep using `store.get('user'|'isOnline')`, `set`, `subscribe`, `loadFromDB`.
 */

import {
  db,
  getUser,
  getAppState,
} from './db.js';
import {
  bus,
  BADGE_UNLOCKED,
  DATA_IMPORTED,
  GOAL_UPDATED,
  NAVIGATION,
  ONBOARDING_COMPLETE,
  PLATFORM_CHANGED,
  SHIFT_SAVED,
  SHIFT_DELETED,
  SHIFT_TIMER_START,
  SHIFT_TIMER_STOP,
  THEME_CHANGED,
  VAULT_RESET,
  XP_EARNED,
} from './events.js';
import { t } from '../utils/strings.js';
import { getCountryDef, resolveProvinceDef } from '../utils/locale.js';
import { getMarketContext } from '../registry/market/resolve.js';
import { syncPlatformTerminologyFromRows } from '../registry/platforms/terminology.js';

const THEME_KEY = 'macadam-theme';
const ALLOWED_THEMES = new Set(['light', 'dark', 'auto']);

/** @typedef {{ startTime: string | null, platformId: string | null } | null} ActiveShiftTimer */

const STATE_KEYS = [
  'user',
  'countryDef',
  'provinceDef',
  'marketContext',
  'activePlatformId',
  'platforms',
  'activeShiftTimer',
  'currentWeekEarnings',
  'currentWeekGoal',
  'streakDays',
  'xpTotal',
  'xpLevel',
  'theme',
  'isOnline',
  'pendingBadgeUnlock',
  'lastRoute',
  'demoMode',
];

/** @type {Record<string, unknown>} */
const state = {
  user: null,
  countryDef: null,
  provinceDef: null,
  marketContext: null,
  activePlatformId: 'all',
  platforms: [],
  /** @type {ActiveShiftTimer} */
  activeShiftTimer: null,
  currentWeekEarnings: 0,
  currentWeekGoal: 0,
  streakDays: 0,
  xpTotal: 0,
  xpLevel: 1,
  theme: 'auto',
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  pendingBadgeUnlock: null,
  lastRoute: null,
  demoMode: false,
};

/** @type {Map<string, Set<(v: unknown, old: unknown) => void>>} */
const subs = new Map();

function notify(key, value, old) {
  const set = subs.get(key);
  if (!set) return;
  for (const fn of [...set]) {
    try {
      fn(value, old);
    } catch (e) {
      console.error(`[macadam store] subscriber error for "${key}"`, e);
    }
  }
}

function applyUserTheme(theme) {
  if (typeof document === 'undefined') return;
  const th = ALLOWED_THEMES.has(theme) ? theme : 'auto';
  document.documentElement.setAttribute('data-theme', th);
  try {
    localStorage.setItem(THEME_KEY, th);
  } catch {
    /* private mode */
  }
}

/**
 * @param {unknown} raw
 * @returns {ActiveShiftTimer}
 */
function normalizeActiveShiftTimer(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'object' && raw !== null) {
    const o = /** @type {Record<string, unknown>} */ (raw);
    const startTime =
      typeof o.startTime === 'string'
        ? o.startTime
        : typeof o.start === 'string'
          ? o.start
          : null;
    const platformId = typeof o.platformId === 'string' ? o.platformId : null;
    if (startTime != null || platformId != null) return { startTime, platformId };
  }
  if (typeof raw === 'string') return { startTime: raw, platformId: null };
  return null;
}

function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * @param {Date} now
 * @param {number} weekStartDay 0 = Sunday … 6 = Saturday (user.locale.weekStartDay)
 */
function weekRangeStrings(now, weekStartDay) {
  const wsd = Number.isFinite(Number(weekStartDay)) ? Number(weekStartDay) : 0;
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dow = d.getDay();
  const diff = (dow - wsd + 7) % 7;
  const start = new Date(d);
  start.setDate(start.getDate() - diff);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return { startStr: ymd(start), endStr: ymd(end) };
}

function num(x, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * @param {unknown} user
 */
function syncLocaleDefsFromUser(user) {
  if (!user || typeof user !== 'object') {
    state.countryDef = null;
    state.provinceDef = null;
    state.marketContext = null;
    return;
  }
  const u = /** @type {Record<string, unknown>} */ (user);
  const countryId =
    typeof u.countryId === 'string' && u.countryId
      ? String(u.countryId).toUpperCase()
      : typeof /** @type {{ country?: unknown }} */ (u.locale)?.country === 'string'
        ? String(u.locale.country).toUpperCase()
        : 'CA';
  let provinceId = typeof u.provinceId === 'string' && u.provinceId.trim() ? String(u.provinceId).trim().toUpperCase() : '';
  if (!provinceId && countryId === 'CA') provinceId = 'ON';
  state.countryDef = getCountryDef(countryId);
  state.provinceDef = resolveProvinceDef(countryId, provinceId);
  state.marketContext = getMarketContext(countryId, provinceId);
}

/**
 * @param {unknown} user
 */
async function fetchWeeklyGoalTarget(user) {
  try {
    const row = await db.goals
      .filter((g) => g.active === true && g.scope === 'weekly' && g.type === 'earnings')
      .first();
    if (row && row.target != null) return num(row.target);
  } catch {
    /* ignore */
  }
  const wg = num(/** @type {{ weeklyGoal?: unknown }} */ (user)?.weeklyGoal);
  if (wg > 0) return wg / 100;
  return 0;
}

/**
 * @param {unknown} user
 */
async function computeCurrentWeekEarnings(user) {
  const locale = /** @type {{ weekStartDay?: unknown }} | null | undefined} */ (
    /** @type {{ locale?: unknown }} */ (user)?.locale
  )?.weekStartDay;
  const { startStr, endStr } = weekRangeStrings(new Date(), num(locale, 0));
  try {
    const shifts = await db.shifts
      .where('date')
      .between(startStr, endStr, true, true)
      .filter((s) => s.deletedAt == null)
      .toArray();
    let sum = 0;
    for (const s of shifts) {
      const raw = s?.grossEarnings ?? s?.gross;
      const dollars = s?.grossEarnings != null ? num(raw) / 100 : num(raw);
      sum += dollars;
    }
    return sum;
  } catch {
    return 0;
  }
}

async function loadActivePlatforms() {
  const rows = await db.platforms
    .filter((p) => p.active === true)
    .toArray();
  rows.sort((a, b) => (Number(a.priority) || 0) - (Number(b.priority) || 0));
  syncPlatformTerminologyFromRows(rows);
  return rows;
}

function noop() {}

export function bindText(selector, storeKey, formatter) {
  const el = typeof selector === 'string' ? document.querySelector(selector) : selector;
  if (!el) {
    console.warn('[macadam store] bindText:', t('errors.storeBindMissing'));
    return noop;
  }
  const fmt = typeof formatter === 'function' ? formatter : (v) => (v == null ? '' : String(v));
  const apply = (v) => {
    el.textContent = fmt(v);
  };
  apply(store.get(storeKey));
  /** @param {unknown} v */
  const fn = (v) => apply(v);
  store.subscribe(storeKey, fn);
  return () => store.unsubscribe(storeKey, fn);
}

/**
 * Maps `String(store.get(storeKey))` to a CSS class to apply; other mapped classes are removed.
 * @param {string | Element | null} selector
 * @param {string} storeKey
 * @param {Record<string, string>} classMap valueString → className
 */
export function bindClass(selector, storeKey, classMap) {
  const el = typeof selector === 'string' ? document.querySelector(selector) : selector;
  if (!el || !classMap || typeof classMap !== 'object') {
    if (!el) console.warn('[macadam store] bindClass:', t('errors.storeBindMissing'));
    return noop;
  }
  const classes = [...new Set(Object.values(classMap))];
  const apply = (v) => {
    const key = v == null ? '' : String(v);
    const match = classMap[key];
    for (const c of classes) el.classList.remove(c);
    if (match) el.classList.add(match);
  };
  apply(store.get(storeKey));
  /** @param {unknown} v */
  const fn = (v) => apply(v);
  store.subscribe(storeKey, fn);
  return () => store.unsubscribe(storeKey, fn);
}

/**
 * @param {string | Element | null} selector
 * @param {string} storeKey
 * @param {(value: unknown) => boolean} condition
 */
export function bindVisibility(selector, storeKey, condition) {
  const el = typeof selector === 'string' ? document.querySelector(selector) : selector;
  if (!el || typeof condition !== 'function') {
    if (!el) console.warn('[macadam store] bindVisibility:', t('errors.storeBindMissing'));
    return noop;
  }
  const apply = (v) => {
    el.hidden = !condition(v);
  };
  apply(store.get(storeKey));
  /** @param {unknown} v */
  const fn = (v) => apply(v);
  store.subscribe(storeKey, fn);
  return () => store.unsubscribe(storeKey, fn);
}

export const store = {
  /**
   * @template K
   * @param {string} key
   * @returns {K}
   */
  get(key) {
    if (key in state) return /** @type {K} */ (state[key]);
    return /** @type {K} */ (undefined);
  },

  /**
   * @param {string} key
   * @param {unknown} value
   */
  set(key, value) {
    if (!(key in state)) return;
    const old = state[key];
    /** @type {unknown} */
    let prevMarketContext = null;
    if (key === 'user') {
      prevMarketContext = state.marketContext;
      state.user = /** @type {typeof state.user} */ (value);
      if (!state.user) {
        state.countryDef = null;
        state.provinceDef = null;
        state.marketContext = null;
        state.theme = 'auto';
        applyUserTheme('auto');
      } else {
        syncLocaleDefsFromUser(state.user);
        const th = state.user?.theme;
        if (typeof th === 'string' && ALLOWED_THEMES.has(th)) {
          state.theme = th;
          applyUserTheme(th);
        } else {
          state.theme = 'auto';
          applyUserTheme('auto');
        }
      }
    } else if (key === 'theme') {
      const th = typeof value === 'string' && ALLOWED_THEMES.has(value) ? value : 'auto';
      state.theme = th;
      applyUserTheme(th);
      if (state.user && typeof state.user === 'object') {
        state.user = { ...state.user, theme: th };
      }
    } else if (key === 'isOnline') {
      state.isOnline = Boolean(value);
    } else {
      /** @type {Record<string, unknown>} */ (state)[key] = value;
    }
    if (key === 'user') {
      notify('countryDef', state.countryDef, old);
      notify('provinceDef', state.provinceDef, old);
      notify('marketContext', state.marketContext, prevMarketContext);
    }
    notify(key, state[key], old);
  },

  /**
   * @param {string} key
   * @param {(newVal: unknown, oldVal: unknown) => void} fn
   */
  subscribe(key, fn) {
    if (!subs.has(key)) subs.set(key, new Set());
    subs.get(key).add(fn);
  },

  /**
   * @param {string} key
   * @param {(newVal: unknown, oldVal: unknown) => void} fn
   */
  unsubscribe(key, fn) {
    subs.get(key)?.delete(fn);
  },

  bindText,
  bindClass,
  bindVisibility,

  /**
   * Re-query Dexie for a single store key (or related group) and `set` when values change.
   * @param {string} key
   */
  async refresh(key) {
    try {
      switch (key) {
        case 'user': {
          const u = await getUser();
          this.set('user', u ?? null);
          break;
        }
        case 'platforms': {
          const pl = await loadActivePlatforms();
          this.set('platforms', pl);
          break;
        }
        case 'activeShiftTimer': {
          const raw = await getAppState('active_shift_start');
          this.set('activeShiftTimer', normalizeActiveShiftTimer(raw));
          break;
        }
        case 'streakDays': {
          const c = await getAppState('streak_count');
          this.set('streakDays', num(c, 0));
          break;
        }
        case 'xpTotal': {
          const x = await getAppState('xp_total');
          this.set('xpTotal', num(x, 0));
          break;
        }
        case 'xpLevel': {
          const lv = await getAppState('xp_level');
          const n = Math.floor(num(lv, 1));
          this.set('xpLevel', Number.isFinite(n) && n >= 1 ? n : 1);
          break;
        }
        case 'currentWeekGoal': {
          const u = await getUser();
          const g = await fetchWeeklyGoalTarget(u);
          this.set('currentWeekGoal', g);
          break;
        }
        case 'currentWeekEarnings': {
          const u = await getUser();
          const e = await computeCurrentWeekEarnings(u);
          this.set('currentWeekEarnings', e);
          break;
        }
        case 'demoMode': {
          const raw = await getAppState('demo_mode');
          this.set('demoMode', raw === true);
          break;
        }
        case 'theme': {
          const u = await getUser();
          const th = u?.theme && ALLOWED_THEMES.has(u.theme) ? u.theme : 'auto';
          this.set('theme', th);
          break;
        }
        default:
          break;
      }
    } catch (e) {
      console.warn(`[macadam store] refresh("${key}") failed`, e);
    }
  },

  async loadFromDB() {
    const u = await getUser();
    this.set('user', u ?? null);

    const [
      platforms,
      activeRaw,
      streakRaw,
      xpTotalRaw,
      xpLevelRaw,
      demoRaw,
    ] = await Promise.all([
      loadActivePlatforms(),
      getAppState('active_shift_start'),
      getAppState('streak_count'),
      getAppState('xp_total'),
      getAppState('xp_level'),
      getAppState('demo_mode'),
    ]);

    this.set('platforms', platforms);
    this.set('demoMode', demoRaw === true);
    this.set('activeShiftTimer', normalizeActiveShiftTimer(activeRaw));
    this.set('streakDays', num(streakRaw, 0));
    this.set('xpTotal', num(xpTotalRaw, 0));
    {
      const n = Math.floor(num(xpLevelRaw, 1));
      this.set('xpLevel', Number.isFinite(n) && n >= 1 ? n : 1);
    }

    const weekGoal = await fetchWeeklyGoalTarget(u);
    this.set('currentWeekGoal', weekGoal);
    const weekEarn = await computeCurrentWeekEarnings(u);
    this.set('currentWeekEarnings', weekEarn);

    if (typeof navigator !== 'undefined') {
      this.set('isOnline', navigator.onLine);
    }

    return u;
  },
};

for (const k of STATE_KEYS) {
  Object.defineProperty(store, k, {
    configurable: true,
    enumerable: true,
    get() {
      return state[k];
    },
  });
}

function wireStoreToBus() {
  const raf =
    typeof requestAnimationFrame === 'function'
      ? requestAnimationFrame
      : (cb) => setTimeout(cb, 0);

  const schedule = (fn) => {
    raf(() => {
      void fn();
    });
  };

  bus.on(SHIFT_SAVED, () => schedule(() => store.refresh('currentWeekEarnings')));
  bus.on(SHIFT_DELETED, () => schedule(() => store.refresh('currentWeekEarnings')));
  bus.on(GOAL_UPDATED, () =>
    schedule(async () => {
      await store.refresh('currentWeekGoal');
      await store.refresh('demoMode');
    }),
  );
  bus.on(PLATFORM_CHANGED, () => schedule(() => store.refresh('platforms')));
  bus.on(SHIFT_TIMER_START, () => schedule(() => store.refresh('activeShiftTimer')));
  bus.on(SHIFT_TIMER_STOP, () => schedule(() => store.refresh('activeShiftTimer')));
  bus.on(XP_EARNED, () => {
    schedule(async () => {
      await store.refresh('xpTotal');
      await store.refresh('xpLevel');
    });
  });
  bus.on(THEME_CHANGED, () => schedule(() => store.refresh('theme')));
  bus.on(BADGE_UNLOCKED, (data) => {
    const id =
      data && typeof /** @type {{ id?: unknown }} */ (data).id === 'string'
        ? /** @type {{ id: string }} */ (data).id
        : data && typeof data === 'string'
          ? data
          : null;
    store.set('pendingBadgeUnlock', id);
  });
  bus.on(NAVIGATION, (data) => {
    const name = data && typeof /** @type {{ name?: unknown }} */ (data).name === 'string' ? data.name : null;
    const hash = data && typeof /** @type {{ hash?: unknown }} */ (data).hash === 'string' ? data.hash : null;
    store.set('lastRoute', name || hash || null);
  });
  bus.on(ONBOARDING_COMPLETE, () => schedule(() => store.refresh('user')));
  bus.on(DATA_IMPORTED, () =>
    schedule(async () => {
      await store.loadFromDB();
    }),
  );
  bus.on(VAULT_RESET, () =>
    schedule(async () => {
      await store.loadFromDB();
    }),
  );
}

wireStoreToBus();
