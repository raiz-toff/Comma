/**
 * App-wide event bus (F5). Cross-module decoupling; debuggable via `window.__comma.bus`.
 */

export const SHIFT_SAVED = 'shift:saved';
export const SHIFT_DELETED = 'shift:deleted';
export const EXPENSE_SAVED = 'expense:saved';
export const GOAL_UPDATED = 'goal:updated';
export const PLATFORM_CHANGED = 'platform:changed';
export const VEHICLE_FILTER_CHANGED = 'vehicle:filter:changed';
export const THEME_CHANGED = 'theme:changed';
export const BADGE_UNLOCKED = 'badge:unlocked';
export const XP_EARNED = 'xp:earned';
export const SHIFT_TIMER_START = 'shift:timer:start';
export const SHIFT_TIMER_STOP = 'shift:timer:stop';
export const ONBOARDING_COMPLETE = 'onboarding:complete';
export const NAVIGATION = 'app:navigation';
export const DATA_IMPORTED = 'data:imported';
export const VAULT_RESET = 'vault:reset';

export class EventBus {
  constructor() {
    /** @type {Map<string, Set<(...args: unknown[]) => void>>} */
    this._listeners = new Map();
  }

  /**
   * @param {string} event
   * @param {(...args: unknown[]) => void} handler
   */
  on(event, handler) {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    this._listeners.get(event).add(handler);
    return () => this.off(event, handler);
  }

  /**
   * @param {string} event
   * @param {(...args: unknown[]) => void} handler
   */
  off(event, handler) {
    const set = this._listeners.get(event);
    if (!set) return;
    set.delete(handler);
    if (set.size === 0) this._listeners.delete(event);
  }

  /**
   * @param {string} event
   * @param {unknown} [data]
   */
  emit(event, data) {
    const set = this._listeners.get(event);
    if (!set) return;
    for (const fn of [...set]) {
      try {
        fn(data);
      } catch (e) {
        console.error(`[comma bus] handler error for "${event}"`, e);
      }
    }
  }
}

export const bus = new EventBus();
