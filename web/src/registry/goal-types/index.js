/**
 * Goal metric types + scopes (Category C). Dexie `goals.type` / `goals.scope` must match these keys.
 * @see docs/feature_modularity.md
 */

/** @typedef {{ key: string; unit: 'currency' | 'count' | 'hours' | 'km' | 'currency_net' | 'currency_tips' }} GoalTypeDef */

/** @type {GoalTypeDef[]} */
const GOAL_TYPES_LIST = [
  { key: 'earnings', unit: 'currency' },
  { key: 'deliveries', unit: 'count' },
  { key: 'hours', unit: 'hours' },
  { key: 'distance', unit: 'km' },
  { key: 'net_profit', unit: 'currency_net' },
  { key: 'tips', unit: 'currency_tips' },
];

const GOAL_SCOPES_LIST = ['daily', 'weekly', 'monthly'];

/** @type {Map<string, GoalTypeDef>} */
const typeById = new Map(GOAL_TYPES_LIST.map((g) => [g.key, g]));

/**
 * @param {GoalTypeDef} def
 */
function validateGoalTypeDef(def) {
  if (!def || typeof def.key !== 'string' || !def.key) throw new Error('Goal type missing key');
  if (!def.unit) throw new Error(`Goal type ${def.key} missing unit`);
}

export const GoalTypeRegistry = {
  /** @returns {readonly GoalTypeDef[]} */
  getAll: () => GOAL_TYPES_LIST,

  /**
   * @param {string | null | undefined} key
   * @returns {GoalTypeDef | undefined}
   */
  getById: (key) => typeById.get(String(key || '').toLowerCase()),

  /** @returns {ReadonlySet<string>} */
  keysAsSet: () => new Set(GOAL_TYPES_LIST.map((g) => g.key)),
};

export const GoalScopeRegistry = {
  /** @returns {readonly string[]} */
  getAll: () => GOAL_SCOPES_LIST,

  /** @returns {ReadonlySet<string>} */
  keysAsSet: () => new Set(GOAL_SCOPES_LIST),
};

export function assertGoalTypeRegistryValid() {
  for (const g of GOAL_TYPES_LIST) validateGoalTypeDef(g);
  for (const s of GOAL_SCOPES_LIST) {
    if (typeof s !== 'string' || !s) throw new Error('Invalid goal scope entry');
  }
}
