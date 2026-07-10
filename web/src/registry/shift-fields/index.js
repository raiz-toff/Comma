/**
 * Global shift form fields (Category C). Platform-specific fields live on platform defs (`specificSchema`).
 * Metadata here drives documentation and future form generators; labels use `shifts.*` string keys.
 * @see docs/feature_modularity.md
 */

/**
 * @typedef {'currency' | 'number' | 'time' | 'date' | 'select' | 'textarea' | 'hidden' | 'text' | 'platformExtras'} ShiftFieldInputKind
 * @typedef {'core' | 'earnings' | 'time' | 'details' | 'context'} ShiftFieldSection
 */

/**
 * @typedef {{
 *   key: string;
 *   labelKey: string;
 *   input: ShiftFieldInputKind;
 *   section: ShiftFieldSection;
 *   showInBasicMode: boolean;
 *   nameAttr?: string;
 * }} GlobalShiftFieldDef
 */

/** @type {GlobalShiftFieldDef[]} */
const GLOBAL_SHIFT_FIELDS = [
  { key: 'platformId', labelKey: 'shifts.platform', input: 'select', section: 'core', showInBasicMode: true, nameAttr: 'platformId' },
  { key: 'date', labelKey: 'shifts.date', input: 'date', section: 'core', showInBasicMode: true, nameAttr: 'date' },
  { key: 'startTime', labelKey: 'shifts.startTime', input: 'time', section: 'core', showInBasicMode: true, nameAttr: 'startTime' },
  { key: 'endTime', labelKey: 'shifts.endTime', input: 'time', section: 'core', showInBasicMode: true, nameAttr: 'endTime' },
  { key: 'gross', labelKey: 'shifts.gross', input: 'currency', section: 'earnings', showInBasicMode: true, nameAttr: 'gross' },
  { key: 'tips', labelKey: 'shifts.tips', input: 'currency', section: 'earnings', showInBasicMode: false, nameAttr: 'tips' },
  { key: 'bonus', labelKey: 'shifts.bonus', input: 'currency', section: 'earnings', showInBasicMode: false, nameAttr: 'bonus' },
  { key: 'orders', labelKey: 'shifts.orders', input: 'number', section: 'details', showInBasicMode: false, nameAttr: 'orders' },
  { key: 'distanceKm', labelKey: 'shifts.distance', input: 'number', section: 'details', showInBasicMode: false, nameAttr: 'distance' },
  { key: 'deadMilesKm', labelKey: 'shifts.deadMiles', input: 'number', section: 'details', showInBasicMode: false, nameAttr: 'deadMilesKm' },
  { key: 'onlineMinutes', labelKey: 'shifts.onlineMinutes', input: 'number', section: 'time', showInBasicMode: false, nameAttr: 'onlineMinutes' },
  { key: 'activeMinutes', labelKey: 'shifts.activeMinutes', input: 'number', section: 'time', showInBasicMode: false, nameAttr: 'activeMinutes' },
  { key: 'vehicleId', labelKey: 'shifts.vehicle', input: 'select', section: 'context', showInBasicMode: false, nameAttr: 'vehicleId' },
  { key: 'weather', labelKey: 'shifts.weather', input: 'select', section: 'context', showInBasicMode: false, nameAttr: 'weather' },
  { key: 'platformSpecific', labelKey: 'shifts.platformExtras', input: 'platformExtras', section: 'details', showInBasicMode: false },
  { key: 'mood', labelKey: 'shifts.mood', input: 'hidden', section: 'context', showInBasicMode: false, nameAttr: 'mood' },
  { key: 'notes', labelKey: 'shifts.notes', input: 'textarea', section: 'context', showInBasicMode: false, nameAttr: 'notes' },
];

/** @type {Map<string, GlobalShiftFieldDef>} */
const byKey = new Map(GLOBAL_SHIFT_FIELDS.map((f) => [f.key, f]));

/**
 * @param {GlobalShiftFieldDef} def
 */
function validateShiftFieldDef(def) {
  if (!def || typeof def.key !== 'string' || !def.key) throw new Error('Shift field missing key');
  if (typeof def.labelKey !== 'string' || !def.labelKey) throw new Error(`Shift field ${def.key} missing labelKey`);
  if (!def.input || !def.section) throw new Error(`Shift field ${def.key} missing input/section`);
  if (typeof def.showInBasicMode !== 'boolean') throw new Error(`Shift field ${def.key} missing showInBasicMode`);
}

export const ShiftFieldRegistry = {
  /** @returns {readonly GlobalShiftFieldDef[]} */
  getAll: () => GLOBAL_SHIFT_FIELDS,

  /** @returns {readonly GlobalShiftFieldDef[]} */
  getBasic: () => GLOBAL_SHIFT_FIELDS.filter((f) => f.showInBasicMode),

  /**
   * @param {ShiftFieldSection} section
   * @returns {readonly GlobalShiftFieldDef[]}
   */
  getSection: (section) => GLOBAL_SHIFT_FIELDS.filter((f) => f.section === section),

  /**
   * @param {string | null | undefined} key
   * @returns {GlobalShiftFieldDef | undefined}
   */
  getByKey: (key) => byKey.get(String(key || '')),
};

export function assertShiftFieldRegistryValid() {
  for (const f of GLOBAL_SHIFT_FIELDS) validateShiftFieldDef(f);
}
