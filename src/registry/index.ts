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
  type ProvinceDef,
} from "./provinces/index";

export {
  WITHHOLDING_PRESETS_CA,
  WITHHOLDING_PRESETS_US,
  getWithholdingPresetPct,
  listCaProvinceCodes,
  listUsStateCodes,
} from "./tax/withholdingPresets";

export {
  getMarketContext,
  getMarketPlatforms,
  resolveAvailablePlatformIds,
  type MarketContext,
} from "./market/resolve";

export { PLATFORMS, type PlatformKey } from "./platforms";

export {
  CANADIAN_CRA_CATEGORIES,
  US_IRS_CATEGORIES,
  getExpenseCategories,
  getCategoryMeta,
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

