/**
 * Global / cross-market platforms available in multiple countries.
 */

import { type PlatformDef } from "./types";

export const amazonflex_global: PlatformDef = {
  id: "amazonflex",
  label: "Amazon Flex",
  shortLabel: "AF",
  color: "#232F3E",
  textColor: "#FF9900",
  availableInCountries: ["CA", "US", "UK"],
  operationalModel: "parcel_route",
  issuesTaxForm: true,
  platformTracksOwnMileage: false,
  offersMileageReimbursement: true,
  terminology: { sessionTerm: "Block" },
};

export const other: PlatformDef = {
  id: "other",
  label: "Other",
  shortLabel: "OTH",
  color: "#6B7280",
  textColor: "#FFFFFF",
  availableInCountries: ["CA", "US", "UK", "NP", "AU", "BD", "KZ", "UZ", "PK", "NG", "GH"],
  operationalModel: "delivery_fixed",   // Neutral fallback model
  issuesTaxForm: false,
  platformTracksOwnMileage: false,
  offersMileageReimbursement: false,
};

export const GLOBAL_PLATFORMS: PlatformDef[] = [amazonflex_global, other];
