/**
 * Category D — global keyboard shortcut catalog (docs/feature_modularity.md).
 * Single place to add rows shown in Settings → “Keyboard shortcuts” and to document combos.
 *
 * Note: actual shortcut dispatch may live in other modules (e.g. search); keep descriptions in sync.
 */

import { t } from '../../utils/strings.js';

/**
 * @typedef {{
 *   id: string;
 *   kind: 'sequence' | 'combo' | 'key';
 *   keys?: string[];
 *   combo?: { ctrl?: boolean; meta?: boolean; shift?: boolean; key: string };
 *   singleKey?: string;
 *   description: () => string;
 * }} KeyboardShortcutRow
 */

/** @type {KeyboardShortcutRow[]} */
export const SETTINGS_KEYBOARD_SHORTCUTS = [
  {
    id: 'go-dashboard',
    kind: 'sequence',
    keys: ['g', 'd'],
    description: () => t('app.navDashboard'),
  },
  {
    id: 'go-shifts',
    kind: 'sequence',
    keys: ['g', 's'],
    description: () => t('app.navShifts'),
  },
  {
    id: 'go-tax',
    kind: 'sequence',
    keys: ['g', 't'],
    description: () => t('app.navTax'),
  },
  {
    id: 'go-vehicles',
    kind: 'sequence',
    keys: ['g', 'v'],
    description: () => t('app.navVehicles'),
  },
  {
    id: 'search-cmdk',
    kind: 'combo',
    combo: { ctrl: true, meta: true, key: 'K' },
    description: () => t('settings.shortcuts.searchCmdK'),
  },
  {
    id: 'search-slash',
    kind: 'key',
    singleKey: '/',
    description: () => t('settings.shortcuts.searchSlash'),
  },
  {
    id: 'escape',
    kind: 'key',
    singleKey: 'Esc',
    description: () => t('settings.shortcuts.escOverlays'),
  },
];

/**
 * @param {(s: string) => string} esc
 * @returns {string}
 */
export function formatShortcutOverlayListItems(esc) {
  return SETTINGS_KEYBOARD_SHORTCUTS.map((row) => {
    if (row.kind === 'sequence' && row.keys && row.keys.length >= 2) {
      const [a, b] = row.keys;
      return `<li><kbd>${esc(a)}</kbd> then <kbd>${esc(b)}</kbd> — ${esc(row.description())}</li>`;
    }
    if (row.kind === 'combo' && row.combo) {
      const mod = t('settings.shortcuts.ctrlOrCmd');
      return `<li><kbd>${esc(mod)}</kbd> + <kbd>${esc(row.combo.key)}</kbd> — ${esc(row.description())}</li>`;
    }
    if (row.kind === 'key' && row.singleKey) {
      return `<li><kbd>${esc(row.singleKey)}</kbd> — ${esc(row.description())}</li>`;
    }
    return '';
  })
    .filter(Boolean)
    .join('\n        ');
}
