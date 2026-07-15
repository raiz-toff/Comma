/**
 * Registry entrypoints — platform & country catalogs plus Category B feature registries.
 * @see docs/Registry_arch.md
 * @see docs/feature_modularity.md
 */

export {
  PlatformRegistry,
  assertPlatformRegistryValid,
  getDefaultSamplePlatformId,
} from './platforms/index.js';
export {
  CountryRegistry,
  assertCountryRegistryValid,
  countryDefToLocaleConfig,
  getCountryTaxProfile,
} from './countries/index.js';
export { ProvinceRegistry, assertProvinceRegistryValid } from './provinces/index.js';

export {
  WITHHOLDING_PRESETS_CA,
  getWithholdingPresetPct,
} from './tax/withholding-presets.js';
export { getMarketContext, resolveAvailablePlatformIds } from './market/resolve.js';

export { WidgetRegistry, assertWidgetRegistryValid } from './widgets/index.js';
export { NotificationRegistry, assertNotificationRegistryValid } from './notifications/index.js';
export { BadgeRegistry, assertBadgeRegistryValid } from './badges/index.js';
export { MetricRegistry, assertMetricRegistryValid } from './metrics/index.js';
export { ReportRegistry, assertReportRegistryValid } from './reports/index.js';

export {
  ExpenseCategoryRegistry,
  assertExpenseCategoryRegistryValid,
} from './expense-categories/index.js';
export { GoalTypeRegistry, GoalScopeRegistry, assertGoalTypeRegistryValid } from './goal-types/index.js';
export { ShiftFieldRegistry, assertShiftFieldRegistryValid } from './shift-fields/index.js';
