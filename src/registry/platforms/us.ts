/**
 * United States-specific platform definitions.
 */

import { type PlatformDef } from "./types";

export const doordash_us: PlatformDef = {
  id: "doordash",
  label: "DoorDash",
  shortLabel: "DD",
  color: "#FF3008",
  textColor: "#FFFFFF",
  availableInCountries: ["CA", "US", "AU"],
  operationalModel: "delivery_fixed",
  issuesTaxForm: true,
  platformTracksOwnMileage: false,
  offersMileageReimbursement: false,
  terminology: { driverTerm: "Dasher" },
};

export const ubereats_us: PlatformDef = {
  id: "ubereats",
  label: "Uber Eats",
  shortLabel: "UE",
  color: "#06C167",
  textColor: "#000000",
  availableInCountries: ["CA", "US", "UK", "AU"],
  operationalModel: "delivery_fixed",
  issuesTaxForm: true,
  platformTracksOwnMileage: false,
  offersMileageReimbursement: false,
  terminology: { driverTerm: "Courier" },
};

export const lyft: PlatformDef = {
  id: "lyft",
  label: "Lyft",
  shortLabel: "LY",
  color: "#FF00BF",
  textColor: "#FFFFFF",
  availableInCountries: ["US"],
  operationalModel: "rideshare_metered",
  issuesTaxForm: true,
  platformTracksOwnMileage: false,
  offersMileageReimbursement: false,
  terminology: { driverTerm: "Driver" },
};

export const uber_rideshare: PlatformDef = {
  id: "uber",
  label: "Uber",
  shortLabel: "UB",
  color: "#000000",
  textColor: "#FFFFFF",
  availableInCountries: ["US", "UK", "CA", "AU"],
  operationalModel: "rideshare_metered",
  issuesTaxForm: true,
  platformTracksOwnMileage: false,
  offersMileageReimbursement: false,
  terminology: { driverTerm: "Driver" },
};

export const instacart_us: PlatformDef = {
  id: "instacart",
  label: "Instacart",
  shortLabel: "IC",
  color: "#0AAD0A",
  textColor: "#FFFFFF",
  availableInCountries: ["CA", "US"],
  operationalModel: "grocery_batch",
  issuesTaxForm: true,
  platformTracksOwnMileage: false,
  offersMileageReimbursement: false,
  terminology: { driverTerm: "Shopper", sessionTerm: "Batch" },
};

export const amazonflex_us: PlatformDef = {
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

export const US_PLATFORMS: PlatformDef[] = [
  doordash_us, ubereats_us, lyft, uber_rideshare, instacart_us, amazonflex_us,
];
