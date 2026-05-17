/**
 * Preset expense categories (Category C). Custom categories stay in appState.
 * @see docs/feature_modularity.md
 */

/** @typedef {{ id: string; emoji: string; deductible: boolean; vehicleRelated: boolean }} ExpenseCategoryDef */

/** @type {ExpenseCategoryDef[]} */
const PRESET_EXPENSE_CATEGORIES = [
  { id: 'fuel', emoji: '⛽', deductible: true, vehicleRelated: true },
  { id: 'maintenance', emoji: '🔧', deductible: true, vehicleRelated: true },
  { id: 'parking', emoji: '🅿️', deductible: true, vehicleRelated: true },
  { id: 'tolls', emoji: '🛣️', deductible: true, vehicleRelated: true },
  { id: 'insurance', emoji: '🛡️', deductible: true, vehicleRelated: true },
  { id: 'registration', emoji: '📄', deductible: true, vehicleRelated: true },
  { id: 'phone', emoji: '📱', deductible: true, vehicleRelated: false },
  { id: 'data_plan', emoji: '📶', deductible: true, vehicleRelated: false },
  { id: 'car_wash', emoji: '🧼', deductible: true, vehicleRelated: true },
  { id: 'supplies', emoji: '🧰', deductible: true, vehicleRelated: false },
  { id: 'meals', emoji: '🍽️', deductible: true, vehicleRelated: false },
  { id: 'bank_fees', emoji: '🏦', deductible: true, vehicleRelated: false },
  { id: 'software', emoji: '💻', deductible: true, vehicleRelated: false },
  { id: 'accounting', emoji: '🧮', deductible: true, vehicleRelated: false },
  { id: 'out_of_pocket', emoji: '💳', deductible: false, vehicleRelated: false },
  { id: 'other', emoji: '🧾', deductible: true, vehicleRelated: false },
];

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
  getById: (id) => byId.get(String(id || '')),

  /** @returns {readonly ExpenseCategoryDef[]} */
  getDeductible: () => PRESET_EXPENSE_CATEGORIES.filter((c) => c.deductible),

  /** @returns {readonly ExpenseCategoryDef[]} */
  getVehicleRelated: () => PRESET_EXPENSE_CATEGORIES.filter((c) => c.vehicleRelated),
};

export function assertExpenseCategoryRegistryValid() {
  for (const c of PRESET_EXPENSE_CATEGORIES) validateExpenseCategoryDef(c);
}
