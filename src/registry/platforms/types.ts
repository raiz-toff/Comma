/**
 * PlatformDef — rich typed definition of a gig platform.
 * Replaces the old flat `PLATFORMS` map. Backward-compat shim exported at bottom.
 */

import { type OperationalModelId } from "../operationalModels/index";

// ─── Core type ────────────────────────────────────────────────────────────────

export interface PlatformDef {
  /** Unique string ID (same as the old PLATFORMS key) */
  id: string;
  /** Full brand name */
  label: string;
  /** Abbreviated name for tight spaces */
  shortLabel?: string;
  /** Brand HEX color */
  color: string;
  /** Text color that contrasts on top of brand color */
  textColor: string;
  /** Countries this platform operates in (ISO-2 uppercase: "CA", "US", "NP", …) */
  availableInCountries: string[];
  /**
   * Which operational model describes how this platform works.
   * Drives revenue fields, terminology, mileage tracking, cash tools, etc.
   */
  operationalModel: OperationalModelId;
  /** Whether the platform issues a tax document (1099-NEC, T4A, P60, etc.) */
  issuesTaxForm: boolean;
  /** Whether the platform independently tracks mileage (GPS deduction logic adjusts) */
  platformTracksOwnMileage: boolean;
  /** Whether the platform offers a per-mile reimbursement rate built into base pay */
  offersMileageReimbursement: boolean;
  /**
   * ISO-4217 currency code this platform pays in.
   * May differ from the user's home currency (e.g. InDriver pays NPR everywhere).
   */
  paymentCurrency?: string;
  /**
   * Restrict to specific province/state/region codes within an available country.
   * null / absent = available across all regions of the listed countries.
   */
  restrictedToRegions?: string[];
  /**
   * Platform-level terminology overrides — take priority over model defaults.
   * e.g. DoorDash calls drivers "Dashers" even though the delivery_fixed model says "Courier".
   */
  terminology?: Partial<{
    driverTerm: string;
    sessionTerm: string;
    tripTerm: string;
  }>;
}
