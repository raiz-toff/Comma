/**
 * Platform Registry — single source of truth for platform definitions.
 */

import { type PlatformDef } from "./types";
import { resolveProvinceDef } from "../countries/index";
import {
  DoorDashLogo,
  UberEatsLogo,
  SkipLogo,
  FoodoraLogo,
  InstacartLogo,
  LyftLogo,
  UberLogo,
  AmazonFlexLogo,
} from "./logos";

export const doordash: PlatformDef = {
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
  logo: DoorDashLogo,
};

export const ubereats: PlatformDef = {
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
  logo: UberEatsLogo,
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
  logo: SkipLogo,
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
  logo: FoodoraLogo,
};

export const instacart: PlatformDef = {
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
  logo: InstacartLogo,
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
  logo: LyftLogo,
};

export const uber: PlatformDef = {
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
  logo: UberLogo,
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

export const amazonflex: PlatformDef = {
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
  logo: AmazonFlexLogo,
};

export const pathao: PlatformDef = {
  id: "pathao",
  label: "Pathao",
  shortLabel: "PT",
  color: "#FF4444",
  textColor: "#FFFFFF",
  availableInCountries: ["NP", "BD"],
  operationalModel: "rideshare_bidding",
  issuesTaxForm: false,
  platformTracksOwnMileage: true,
  offersMileageReimbursement: false,
  paymentCurrency: "NPR",
  terminology: {
    driverTerm: "Partner",
    sessionTerm: "Session",
    tripTerm: "Ride",
  },
};

export const pathao_food: PlatformDef = {
  id: "pathao_food",
  label: "Pathao Food",
  shortLabel: "PTF",
  color: "#CC2222",
  textColor: "#FFFFFF",
  availableInCountries: ["NP"],
  operationalModel: "delivery_negotiated",
  issuesTaxForm: false,
  platformTracksOwnMileage: true,
  offersMileageReimbursement: false,
  paymentCurrency: "NPR",
  terminology: {
    driverTerm: "Rider",
    sessionTerm: "Session",
    tripTerm: "Delivery",
  },
};

export const indriver: PlatformDef = {
  id: "indriver",
  label: "InDriver",
  shortLabel: "ID",
  color: "#1DBF73",
  textColor: "#FFFFFF",
  availableInCountries: ["NP", "KZ", "UZ", "PK", "NG", "GH"],
  operationalModel: "rideshare_bidding",
  issuesTaxForm: false,
  platformTracksOwnMileage: false,
  offersMileageReimbursement: false,
  paymentCurrency: "NPR",
  terminology: {
    driverTerm: "Driver",
    sessionTerm: "Session",
    tripTerm: "Ride",
  },
};

export const foodmandu: PlatformDef = {
  id: "foodmandu",
  label: "Foodmandu",
  shortLabel: "FM",
  color: "#E04B2E",
  textColor: "#FFFFFF",
  availableInCountries: ["NP"],
  operationalModel: "delivery_fixed",
  issuesTaxForm: false,
  platformTracksOwnMileage: false,
  offersMileageReimbursement: false,
  paymentCurrency: "NPR",
  terminology: {
    driverTerm: "Rider",
    sessionTerm: "Shift",
    tripTerm: "Order",
  },
};

export const bhoj: PlatformDef = {
  id: "bhoj",
  label: "Bhoj",
  shortLabel: "BJ",
  color: "#F97316",
  textColor: "#FFFFFF",
  availableInCountries: ["NP"],
  operationalModel: "delivery_fixed",
  issuesTaxForm: false,
  platformTracksOwnMileage: false,
  offersMileageReimbursement: false,
  paymentCurrency: "NPR",
  terminology: {
    driverTerm: "Rider",
    sessionTerm: "Shift",
    tripTerm: "Order",
  },
};

export const other: PlatformDef = {
  id: "other",
  label: "Other",
  shortLabel: "OTH",
  color: "#6B7280",
  textColor: "#FFFFFF",
  availableInCountries: ["CA", "US", "UK", "NP", "AU", "BD", "KZ", "UZ", "PK", "NG", "GH"],
  operationalModel: "delivery_fixed",
  issuesTaxForm: false,
  platformTracksOwnMileage: false,
  offersMileageReimbursement: false,
};

const ALL_PLATFORMS_LIST: PlatformDef[] = [
  doordash,
  ubereats,
  skip,
  foodora,
  instacart,
  lyft,
  uber,
  deliveroo,
  stuart,
  amazonflex,
  pathao,
  pathao_food,
  indriver,
  foodmandu,
  bhoj,
  other,
];

export const PLATFORM_REGISTRY: Record<string, PlatformDef> = {};
for (const p of ALL_PLATFORMS_LIST) {
  if (!PLATFORM_REGISTRY[p.id]) {
    PLATFORM_REGISTRY[p.id] = p;
  }
}

export function getPlatformDef(platformId: string): PlatformDef {
  return PLATFORM_REGISTRY[platformId] ?? PLATFORM_REGISTRY["other"]!;
}

export function getPlatformsByCountry(countryId: string): PlatformDef[] {
  const seen = new Set<string>();
  const result: PlatformDef[] = [];
  for (const p of ALL_PLATFORMS_LIST) {
    if (!seen.has(p.id) && p.availableInCountries.includes(countryId)) {
      seen.add(p.id);
      result.push(p);
    }
  }
  return result;
}

export function resolveMarketPlatformIds(
  countryId: string,
  regionCode?: string
): string[] {
  const countryPlatforms = getPlatformsByCountry(countryId);
  if (!regionCode) {
    return countryPlatforms.map((p) => p.id);
  }

  const province = resolveProvinceDef(countryId, regionCode);
  const banned = province?.bannedPlatforms || [];

  return countryPlatforms
    .filter((p) => {
      if (banned.includes(p.id)) return false;
      if (p.restrictedToRegions && p.restrictedToRegions.length > 0) {
        return p.restrictedToRegions.includes(regionCode);
      }
      return true;
    })
    .map((p) => p.id);
}

export const PLATFORMS: Record<string, { label: string; color: string; textColor: string }> =
  Object.fromEntries(
    Object.entries(PLATFORM_REGISTRY).map(([id, p]) => [
      id,
      { label: p.label, color: p.color, textColor: p.textColor },
    ])
  );

export type { PlatformDef };
export type PlatformKey = keyof typeof PLATFORM_REGISTRY;
