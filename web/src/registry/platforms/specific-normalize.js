/**
 * Registry-driven `platformSpecific` payload coercion (docs/Registry_arch.md).
 * @see ../types.js — `PlatformSpecificFieldDef`
 */

/**
 * @param {unknown} value
 * @param {{ min?: number, max?: number }} [opts]
 */
export function toNumberField(value, opts = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (typeof opts.min === 'number' && n < opts.min) return null;
  if (typeof opts.max === 'number' && n > opts.max) return null;
  return n;
}

/**
 * @param {unknown} value
 * @returns {string[]}
 */
export function normalizeStringArrayField(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => String(v || '').toLowerCase().trim())
    .filter(Boolean)
    .filter((v, i, arr) => arr.indexOf(v) === i);
}

/**
 * @param {import('../types.js').PlatformSpecificFieldDef[]} schema
 * @param {Record<string, unknown>} raw
 * @returns {Record<string, unknown>}
 */
export function normalizeFromSpecificSchema(schema, raw) {
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const field of schema) {
    const v = raw[field.key];
    if (field.kind === 'number') {
      out[field.key] = toNumberField(v, { min: field.min, max: field.max });
    } else if (field.kind === 'string') {
      out[field.key] = v ? String(v).trim() : '';
    } else if (field.kind === 'object') {
      out[field.key] = v && typeof v === 'object' ? /** @type {Record<string, unknown>} */ (v) : {};
    } else if (field.kind === 'stringArray') {
      out[field.key] = normalizeStringArrayField(v);
    }
  }
  return out;
}

const DEFAULT_OTHER_CONFIG = {
  customFields: [],
};

/**
 * @param {Record<string, unknown>} raw
 */
export function normalizeOtherPlatformSpecific(raw) {
  const fields = Array.isArray(raw.customFields)
    ? raw.customFields
        .filter((x) => x && typeof x === 'object')
        .map((x) => ({
          key: String(/** @type {any} */ (x).key || '').trim(),
          label: String(/** @type {any} */ (x).label || '').trim(),
          type: String(/** @type {any} */ (x).type || 'text').trim() || 'text',
        }))
        .filter((x) => x.key && x.label)
    : [];
  return {
    ...DEFAULT_OTHER_CONFIG,
    customFields: fields,
  };
}

/**
 * @param {import('../types.js').PlatformCatalogEntry} def
 * @param {unknown} input
 */
export function normalizePlatformSpecificFromDef(def, input) {
  const raw = input && typeof input === 'object' ? /** @type {Record<string, unknown>} */ (input) : {};
  if (def.id === 'other' || !Array.isArray(def.specificSchema) || def.specificSchema.length === 0) {
    return normalizeOtherPlatformSpecific(raw);
  }
  return normalizeFromSpecificSchema(def.specificSchema, raw);
}
