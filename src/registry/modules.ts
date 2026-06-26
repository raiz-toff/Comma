/**
 * Feature Module Registry
 *
 * Defines the features compiled in the binary, their metadata, dependencies,
 * and whether they are user-toggleable or core.
 */

export type FeatureKey =
  // Core — always on, not shown in settings
  | 'session_tracking_gps'
  | 'session_tracking_manual'
  | 'expense_tracking'
  | 'analytics_basic'
  | 'vehicle_profiles'
  | 'csv_export'
  | 'google_drive_backup'
  // Optional — compiled in, gated by persona/country/user
  | 'analytics_advanced'
  | 'tax_workspace'
  | 'goals'
  | 'schedule'
  | 'gamification'
  | 'pdf_reports'
  | 'csv_import'
  | 'android_widget'
  | 'business_personal_split'
  | 'mileage_log_export';

export interface FeatureModule {
  key: FeatureKey;
  label: string;
  description: string;
  category: 'tracking' | 'financial' | 'analytics' | 'tax' | 'export' | 'productivity' | 'platform_native';
  core: boolean;
  userToggleable: boolean;
  requires: FeatureKey[];   // enabling this auto-enables these deps
}

export const FEATURE_MODULES: FeatureModule[] = [
  // ── Core Features ──────────────────────────────────────────────────────────
  {
    key: 'session_tracking_gps',
    label: 'GPS Session Tracking',
    description: 'Track mileage and routes in the background via GPS.',
    category: 'tracking',
    core: true,
    userToggleable: false,
    requires: [],
  },
  {
    key: 'session_tracking_manual',
    label: 'Manual Session Entry',
    description: 'Manually enter work session details.',
    category: 'tracking',
    core: true,
    userToggleable: false,
    requires: [],
  },
  {
    key: 'expense_tracking',
    label: 'Expense Ledger',
    description: 'Record business expenses and capture receipts.',
    category: 'financial',
    core: true,
    userToggleable: false,
    requires: [],
  },
  {
    key: 'analytics_basic',
    label: 'Basic Analytics',
    description: 'View basic aggregate metrics on the dashboard.',
    category: 'analytics',
    core: true,
    userToggleable: false,
    requires: [],
  },
  {
    key: 'vehicle_profiles',
    label: 'Vehicles & Maintenance',
    description: 'Manage vehicles and log maintenance histories.',
    category: 'productivity',
    core: true,
    userToggleable: false,
    requires: [],
  },
  {
    key: 'csv_export',
    label: 'CSV Data Export',
    description: 'Export work sessions and expenses data to CSV sheets.',
    category: 'export',
    core: true,
    userToggleable: false,
    requires: [],
  },
  {
    key: 'google_drive_backup',
    label: 'Google Drive Vault Backup',
    description: 'Securely sync and backup encrypted database to Google Drive.',
    category: 'productivity',
    core: true,
    userToggleable: false,
    requires: [],
  },

  // ── Optional Features ───────────────────────────────────────────────────────
  {
    key: 'analytics_advanced',
    label: 'Advanced Analytics',
    description: 'View charts detailing best hours, best platforms, and trends.',
    category: 'analytics',
    core: false,
    userToggleable: true,
    requires: [],
  },
  {
    key: 'tax_workspace',
    label: 'Self-Employed Tax Estimator',
    description: 'Local tax estimator (Schedule C, T2125, CPP, SE-Tax, HST).',
    category: 'tax',
    core: false,
    userToggleable: true,
    requires: [],
  },
  {
    key: 'goals',
    label: 'Earning Goals Tracker',
    description: 'Set and track daily/weekly/monthly revenue and time goals.',
    category: 'productivity',
    core: false,
    userToggleable: true,
    requires: [],
  },
  {
    key: 'schedule',
    label: 'Work Calendar & Reminders',
    description: 'Plan upcoming shifts, set repeat presets, and configure notification alerts.',
    category: 'productivity',
    core: false,
    userToggleable: true,
    requires: [],
  },
  {
    key: 'gamification',
    label: 'Streaks & Achievements',
    description: 'Gamify your work with levels, daily streaks, and badges.',
    category: 'productivity',
    core: false,
    userToggleable: true,
    requires: [],
  },
  {
    key: 'pdf_reports',
    label: 'PDF Performance Reports',
    description: 'Generate professional HTML-to-PDF summaries using expo-print.',
    category: 'export',
    core: false,
    userToggleable: true,
    requires: [],
  },
  {
    key: 'csv_import',
    label: 'CSV Statements Import Wizard',
    description: 'Bulk import shifts from platform CSV statement files.',
    category: 'export',
    core: false,
    userToggleable: true,
    requires: [],
  },
  {
    key: 'android_widget',
    label: 'Android Home Screen Widget',
    description: 'View active tracking status directly on your Android home screen.',
    category: 'platform_native',
    core: false,
    userToggleable: true,
    requires: [],
  },
  {
    key: 'business_personal_split',
    label: 'Business vs. Personal Classification',
    description: 'Enable flagging of mileage and expenses as business or personal.',
    category: 'tracking',
    core: false,
    userToggleable: true,
    requires: [],
  },
  {
    key: 'mileage_log_export',
    label: 'Audit-Ready Mileage Log Export',
    description: 'Export detailed, audit-compliant vehicle mileage logs.',
    category: 'export',
    core: false,
    userToggleable: true,
    requires: ['business_personal_split'],
  },
];

export const TOGGLEABLE_FEATURE_KEYS = FEATURE_MODULES
  .filter((f) => !f.core && f.userToggleable)
  .map((f) => f.key);

export const FEATURE_MODULE_MAP = FEATURE_MODULES.reduce((acc, curr) => {
  acc[curr.key] = curr;
  return acc;
}, {} as Record<FeatureKey, FeatureModule>);
