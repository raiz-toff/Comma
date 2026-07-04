/**
 * Preset expense categories (Category C). Custom categories stay in appState.
 * @see docs/feature_modularity.md
 *
 * IDs are the CANONICAL cross-app vocabulary shared with mobile
 * (`commaApp/src/registry/expenseCategories.ts`) — the synced `expenses.category` column
 * stores these slugs verbatim, so any new id must be added to BOTH registries with the
 * SAME spelling or the other app renders it as "Other". Labels/tax lines may differ per
 * app and per country; ids may not.
 */

/** @typedef {{ id: string; emoji: string; deductible: boolean; vehicleRelated: boolean }} ExpenseCategoryDef */

/** @type {ExpenseCategoryDef[]} */
const PRESET_EXPENSE_CATEGORIES = [
  { id: 'fuel', emoji: '⛽', deductible: true, vehicleRelated: true },
  { id: 'maintenance', emoji: '🔧', deductible: true, vehicleRelated: true },
  { id: 'parking', emoji: '🅿️', deductible: true, vehicleRelated: true },
  { id: 'tolls', emoji: '🛣️', deductible: true, vehicleRelated: true },
  { id: 'insurance', emoji: '🛡️', deductible: true, vehicleRelated: true },
  { id: 'licensing', emoji: '📄', deductible: true, vehicleRelated: true },
  { id: 'interest', emoji: '📈', deductible: true, vehicleRelated: true },
  { id: 'leasing', emoji: '🤝', deductible: true, vehicleRelated: true },
  { id: 'fees', emoji: '💼', deductible: true, vehicleRelated: false },
  { id: 'phone', emoji: '📱', deductible: true, vehicleRelated: false },
  { id: 'data_plan', emoji: '📶', deductible: true, vehicleRelated: false },
  { id: 'wash', emoji: '🧼', deductible: true, vehicleRelated: true },
  { id: 'supplies', emoji: '🧰', deductible: true, vehicleRelated: false },
  { id: 'meals', emoji: '🍽️', deductible: true, vehicleRelated: false },
  { id: 'bank_fees', emoji: '🏦', deductible: true, vehicleRelated: false },
  { id: 'software', emoji: '💻', deductible: true, vehicleRelated: false },
  { id: 'accounting', emoji: '🧮', deductible: true, vehicleRelated: false },
  { id: 'bike_maintenance', emoji: '🚲', deductible: true, vehicleRelated: true },
  { id: 'out_of_pocket', emoji: '💳', deductible: false, vehicleRelated: false },
  { id: 'other', emoji: '🧾', deductible: true, vehicleRelated: false },
];

/**
 * Legacy → canonical id aliases (2026-07-04 category unification, mobile vocabulary wins).
 * Old local rows, old change-logs/snapshots still in Drive, and pre-fix vault backups can
 * all carry these — remap wherever a category id enters the system. Never add NEW ids here.
 * @type {Record<string, string>}
 */
export const LEGACY_CATEGORY_ALIASES = {
  car_wash: 'wash',
  registration: 'licensing',
};

/**
 * @param {string | null | undefined} id
 * @returns {string} the canonical form of a possibly-legacy category id
 */
export function canonicalCategoryId(id) {
  const s = String(id || '');
  return LEGACY_CATEGORY_ALIASES[s] || s;
}

/** @type {Map<string, ExpenseCategoryDef>} */
const byId = new Map(PRESET_EXPENSE_CATEGORIES.map((c) => [c.id, c]));

/**
 * @param {ExpenseCategoryDef} def
 */
function validateExpenseCategoryDef(def) {
  if (!def || typeof def.id !== 'string' || !def.id) throw new Error('Expense category missing id');
  if (typeof def.emoji !== 'string') throw new Error(`Expense category ${def.id} missing emoji`);
  if (typeof def.deductible !== 'boolean' || typeof def.vehicleRelated !== 'boolean') {
    throw new Error(`Expense category ${def.id} missing deductible/vehicleRelated`);
  }
}

export const ExpenseCategoryRegistry = {
  /** @returns {readonly ExpenseCategoryDef[]} */
  getAll: () => PRESET_EXPENSE_CATEGORIES,

  /**
   * @param {string | null | undefined} id
   * @returns {ExpenseCategoryDef | undefined}
   */
  getById: (id) => byId.get(canonicalCategoryId(id)),

  /** @returns {readonly ExpenseCategoryDef[]} */
  getDeductible: () => PRESET_EXPENSE_CATEGORIES.filter((c) => c.deductible),

  /** @returns {readonly ExpenseCategoryDef[]} */
  getVehicleRelated: () => PRESET_EXPENSE_CATEGORIES.filter((c) => c.vehicleRelated),
};

export function assertExpenseCategoryRegistryValid() {
  for (const c of PRESET_EXPENSE_CATEGORIES) validateExpenseCategoryDef(c);
}
