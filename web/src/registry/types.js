/**
 * Shared registry typedefs (avoid circular imports with registry/platform surfaces).
 *
 * @typedef {{ driver?: string; delivery?: string; bonus?: string; surge?: string }} PlatformTerms
 *
 * @typedef {{
 *   key: string;
 *   kind: 'number' | 'string' | 'object' | 'stringArray';
 *   min?: number;
 *   max?: number;
 *   labelKey?: string;
 * }} PlatformSpecificFieldDef
 *
 * @typedef {{
 *   inputKey: string;
 *   min: number;
 *   max: number;
 *   below: number;
 *   alertType: string;
 *   payloadKey: string;
 * }} PlatformAlertCheckDef
 *
 * @typedef {{
 *   id: string;
 *   name: string;
 *   color: string;
 *   terminology: PlatformTerms;
 *   logo: string;
 *   relevantFields: string[];
 *   helpUrl: string;
 *   specificSchema?: PlatformSpecificFieldDef[];
 *   payoutWeekday?: number;
 *   alertChecks?: PlatformAlertCheckDef[];
 *   analyticsModules?: {
 *     bonusTracking?: boolean;
 *     surgeAnalysis?: boolean;
 *     blockEarnings?: boolean;
 *     batchTracking?: boolean;
 *     orderTypeTracking?: boolean;
 *     questTracking?: boolean;
 *     promotionsTracking?: boolean;
 *   };
 * }} PlatformCatalogEntry
 */

export {};
