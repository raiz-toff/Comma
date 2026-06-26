/**
 * Nepal-specific platform definitions.
 *
 * Nepal operates primarily on a bid-based / negotiated model with cash payments.
 * No formal contractor tax documentation (no 1099 equivalent).
 * Distance tracked in km.
 */

import { type PlatformDef } from "./types";

export const pathao_ride: PlatformDef = {
  id: "pathao",
  label: "Pathao",
  shortLabel: "PT",
  color: "#FF4444",
  textColor: "#FFFFFF",
  availableInCountries: ["NP", "BD"],
  operationalModel: "rideshare_bidding",
  issuesTaxForm: false,
  platformTracksOwnMileage: true,       // Pathao app tracks distance internally
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
  platformTracksOwnMileage: false,      // Driver tracks own mileage
  offersMileageReimbursement: false,
  paymentCurrency: "NPR",               // Resolved at runtime from country registry
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
  operationalModel: "delivery_fixed",   // Foodmandu sets the delivery price
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

export const NP_PLATFORMS: PlatformDef[] = [
  pathao_ride, pathao_food, indriver, foodmandu, bhoj,
];
