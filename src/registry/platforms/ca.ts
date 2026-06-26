/**
 * Canada-specific platform definitions.
 * All platforms here are available in at least one CA market.
 */

import { type PlatformDef } from "./types";

export const doordash_ca: PlatformDef = {
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

export const ubereats_ca: PlatformDef = {
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

export const skip: PlatformDef = {
  id: "skip",
  label: "SkipTheDishes",
  shortLabel: "Skip",
  color: "#ED5A1F",
  textColor: "#FFFFFF",
  availableInCountries: ["CA"],
  operationalModel: "delivery_fixed",
  issuesTaxForm: true,
  platformTracksOwnMileage: false,
  offersMileageReimbursement: false,
  terminology: { driverTerm: "Courier" },
};

export const foodora: PlatformDef = {
  id: "foodora",
  label: "Foodora",
  shortLabel: "FD",
  color: "#D8003F",
  textColor: "#FFFFFF",
  availableInCountries: ["CA"],
  operationalModel: "delivery_fixed",
  issuesTaxForm: true,
  platformTracksOwnMileage: false,
  offersMileageReimbursement: false,
};

export const instacart_ca: PlatformDef = {
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

export const amazonflex_ca: PlatformDef = {
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

// Convenience array for registry assembly
export const CA_PLATFORMS: PlatformDef[] = [
  doordash_ca, ubereats_ca, skip, foodora, instacart_ca, amazonflex_ca,
];
