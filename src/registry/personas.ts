import { type VocabularyKey } from "./vocabulary";
import { type FeatureKey } from "./modules";

export type PersonaKey =
  | 'platform_driver'  // Combined rideshare & delivery
  | 'business_driver'  // Sales reps, realtors, consultants — MileIQ territory
  | 'contractor'       // Trades, freelance, field service
  | 'mileage_tracker'; // Mileage tracking only for reimbursement / personal records

export interface PersonaConfig {
  key: PersonaKey;
  label: string;
  description: string;
  showPlatformSelectorInOnboarding: boolean;
  vocabulary: Record<VocabularyKey, string>;
  defaultFeatures: Record<FeatureKey, boolean>;
}

// ─── Vocabulary Presets for Platform Drivers ──────────────────────────────────

export const RIDESHARE_VOCABULARY: Record<VocabularyKey, string> = {
  session: 'drive',
  session_plural: 'drives',
  platform: 'app',
  active_miles: 'fare miles',
  dead_miles: 'deadhead miles',
  revenue: 'earnings',
  start_cta: 'Go online',
  end_cta: 'Go offline',
  history_tab: 'Drives',
  active_indicator: 'Online',
  no_sessions_yet: 'No drives yet',
};

export const DELIVERY_VOCABULARY: Record<VocabularyKey, string> = {
  session: 'shift',
  session_plural: 'shifts',
  platform: 'platform',
  active_miles: 'active miles',
  dead_miles: 'dead miles',
  revenue: 'earnings',
  start_cta: 'Start shift',
  end_cta: 'End shift',
  history_tab: 'Shifts',
  active_indicator: 'Active shift',
  no_sessions_yet: 'No shifts yet',
};

export const BOTH_VOCABULARY: Record<VocabularyKey, string> = {
  session: 'shift',
  session_plural: 'shifts',
  platform: 'app',
  active_miles: 'active miles',
  dead_miles: 'deadhead miles',
  revenue: 'earnings',
  start_cta: 'Start work',
  end_cta: 'End work',
  history_tab: 'Activity',
  active_indicator: 'Active',
  no_sessions_yet: 'No activity yet',
};

// ─── Persona Configurations ──────────────────────────────────────────────────

export const PERSONAS: Record<PersonaKey, PersonaConfig> = {
  platform_driver: {
    key: 'platform_driver',
    label: 'Platform Driver (Delivery & Rideshare)',
    description: 'Food/grocery delivery, rideshare passenger transport, and parcel courier (Uber, DoorDash, Lyft, etc.)',
    showPlatformSelectorInOnboarding: true,
    vocabulary: BOTH_VOCABULARY,
    defaultFeatures: {
      session_tracking_gps: true,
      session_tracking_manual: true,
      expense_tracking: true,
      analytics_basic: true,
      vehicle_profiles: true,
      csv_export: true,
      google_drive_backup: true,
      analytics_advanced: true, // Both couriers & rideshare drivers get advanced analytics now!
      tax_workspace: false,
      goals: false,
      schedule: false,
      gamification: false,
      pdf_reports: false,
      csv_import: false,
      android_widget: false,
      business_personal_split: false,
      mileage_log_export: false,
    },
  },
  business_driver: {
    key: 'business_driver',
    label: 'Business Driver / Realtor',
    description: 'Realtors, sales reps, consultants, or corporate employees tracking drives for corporate reimbursement',
    showPlatformSelectorInOnboarding: false,
    vocabulary: {
      session: 'drive',
      session_plural: 'drives',
      platform: 'purpose',
      active_miles: 'business miles',
      dead_miles: 'personal miles',
      revenue: 'reimbursable',
      start_cta: 'Start drive',
      end_cta: 'End drive',
      history_tab: 'Drives',
      active_indicator: 'On drive',
      no_sessions_yet: 'No drives yet',
    },
    defaultFeatures: {
      session_tracking_gps: true,
      session_tracking_manual: true,
      expense_tracking: true,
      analytics_basic: true,
      vehicle_profiles: true,
      csv_export: true,
      google_drive_backup: true,
      analytics_advanced: false,
      tax_workspace: false, // Turn off W-2 tax workspace to avoid tax audits/liability
      goals: false,
      schedule: false,
      gamification: false,
      pdf_reports: true, // Turn on PDF report exports by default for reimbursement submissions
      csv_import: false,
      android_widget: false,
      business_personal_split: true,
      mileage_log_export: true,
    },
  },
  contractor: {
    key: 'contractor',
    label: 'Contractor / Services',
    description: 'Trades, cleaners, mobile therapists, general freelancers servicing specific clients',
    showPlatformSelectorInOnboarding: false,
    vocabulary: {
      session: 'job',
      session_plural: 'jobs',
      platform: 'client',
      active_miles: 'work miles',
      dead_miles: 'supply / run miles', // Changed from "personal miles" to preserve deductible miles (Home Depot runs, etc.)
      revenue: 'revenue',
      start_cta: 'Start job',
      end_cta: 'End job',
      history_tab: 'Jobs',
      active_indicator: 'On job',
      no_sessions_yet: 'No jobs yet',
    },
    defaultFeatures: {
      session_tracking_gps: true,
      session_tracking_manual: true,
      expense_tracking: true,
      analytics_basic: true,
      vehicle_profiles: true,
      csv_export: true,
      google_drive_backup: true,
      analytics_advanced: false,
      tax_workspace: true,
      goals: false,
      schedule: false,
      gamification: false,
      pdf_reports: false,
      csv_import: false,
      android_widget: false,
      business_personal_split: true,
      mileage_log_export: true,
    },
  },
  mileage_tracker: {
    key: 'mileage_tracker',
    label: 'Mileage Tracker',
    description: 'Reimbursement or personal records tracking drives only',
    showPlatformSelectorInOnboarding: false,
    vocabulary: {
      session: 'trip',
      session_plural: 'trips',
      platform: 'purpose',
      active_miles: 'tracked miles',
      dead_miles: 'personal miles',
      revenue: 'reimbursement',
      start_cta: 'Start tracking',
      end_cta: 'Stop tracking',
      history_tab: 'Trips',
      active_indicator: 'On trip',
      no_sessions_yet: 'No trips yet',
    },
    defaultFeatures: {
      session_tracking_gps: true,
      session_tracking_manual: true,
      expense_tracking: true,
      analytics_basic: true,
      vehicle_profiles: true,
      csv_export: true,
      google_drive_backup: true,
      analytics_advanced: false,
      tax_workspace: false,
      goals: false,
      schedule: false,
      gamification: false,
      pdf_reports: false,
      csv_import: false,
      android_widget: false,
      business_personal_split: true,
      mileage_log_export: true,
    },
  },
};
