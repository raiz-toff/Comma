/**
 * Registry barrel export — single import point for all registry modules.
 * Mirrors PWA: src/registry/index.js
 */

export {
  getCountryDef,
  getCountryTaxProfile,
  listCountries,
  type CountryDef,
  type TaxProfile,
} from "./countries/index";

export {
  resolveProvinceDef,
  getRegionsByCountry,
  getSalesTaxRate,
  getMileagePresetRate,
  getMileagePresetLabel,
  type ProvinceDef,
} from "./countries/index";

export {
  WITHHOLDING_PRESETS_CA,
  getWithholdingPresetPct,
  listCaProvinceCodes,
} from "./countries/tax/index";

export {
  getMarketContext,
  getMarketPlatforms,
  resolveAvailablePlatformIds,
  type MarketContext,
} from "./market/resolve";

// ── New modular platform registry ────────────────────────────────────────────
export {
  PLATFORMS,
  PLATFORM_REGISTRY,
  getPlatformDef,
  getPlatformsByCountry,
  resolveMarketPlatformIds,
  type PlatformDef,
  type PlatformKey,
} from "./platforms/index";

// ── Operational models ────────────────────────────────────────────────────────
export {
  getOperationalModel,
  listOperationalModels,
  resolveTerminology,
  type OperationalModelDef,
  type OperationalModelId,
  type RevenueFieldDef,
} from "./operationalModels/index";

// ── Vocabulary shape (used by country vocabularyOverrides) ────────────────────
export {
  type VocabularyKey,
} from "./vocabulary";

// ── Feature modules ───────────────────────────────────────────────────────────
export {
  type FeatureKey,
  type FeatureModule,
  FEATURE_MODULES,
  TOGGLEABLE_FEATURE_KEYS,
  FEATURE_MODULE_MAP,
} from "./modules";

// ── Other registries ──────────────────────────────────────────────────────────
export {
  CANADIAN_CRA_CATEGORIES,
  US_IRS_CATEGORIES,
  getExpenseCategories,
  getCategoryMeta,
  canonicalCategoryId,
  LEGACY_CATEGORY_ALIASES,
  type ExpenseCategory,
  type ExpenseCategoryKey,
} from "./expenseCategories";

export {
  BadgeRegistry,
  BADGES,
  type BadgeDefinition,
  type BadgeContext,
  type BadgeSweepStats,
} from "./badges/index";
