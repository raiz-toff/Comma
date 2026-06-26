/**
 * United Kingdom-specific platform definitions.
 */

import { type PlatformDef } from "./types";

export const ubereats_uk: PlatformDef = {
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

export const deliveroo: PlatformDef = {
  id: "deliveroo",
  label: "Deliveroo",
  shortLabel: "DR",
  color: "#00CCBC",
  textColor: "#FFFFFF",
  availableInCountries: ["UK"],
  operationalModel: "delivery_fixed",
  issuesTaxForm: true,
  platformTracksOwnMileage: false,
  offersMileageReimbursement: false,
  terminology: { driverTerm: "Rider" },
};

export const stuart: PlatformDef = {
  id: "stuart",
  label: "Stuart",
  shortLabel: "ST",
  color: "#7C3AED",
  textColor: "#FFFFFF",
  availableInCountries: ["UK"],
  operationalModel: "delivery_fixed",
  issuesTaxForm: true,
  platformTracksOwnMileage: false,
  offersMileageReimbursement: false,
  terminology: { driverTerm: "Courier" },
};

export const doordash_uk: PlatformDef = {
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

export const amazonflex_uk: PlatformDef = {
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

export const UK_PLATFORMS: PlatformDef[] = [
  ubereats_uk, deliveroo, stuart, amazonflex_uk,
];
