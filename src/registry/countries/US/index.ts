import { type CountryDef, type ProvinceDef } from "../types";
import { AL } from "./provinces/AL";
import { AK } from "./provinces/AK";
import { AZ } from "./provinces/AZ";
import { AR } from "./provinces/AR";
import { CA } from "./provinces/CA";
import { CO } from "./provinces/CO";
import { CT } from "./provinces/CT";
import { DE } from "./provinces/DE";
import { DC } from "./provinces/DC";
import { FL } from "./provinces/FL";
import { GA } from "./provinces/GA";
import { HI } from "./provinces/HI";
import { ID } from "./provinces/ID";
import { IL } from "./provinces/IL";
import { IN } from "./provinces/IN";
import { IA } from "./provinces/IA";
import { KS } from "./provinces/KS";
import { KY } from "./provinces/KY";
import { LA } from "./provinces/LA";
import { ME } from "./provinces/ME";
import { MD } from "./provinces/MD";
import { MA } from "./provinces/MA";
import { MI } from "./provinces/MI";
import { MN } from "./provinces/MN";
import { MS } from "./provinces/MS";
import { MO } from "./provinces/MO";
import { MT } from "./provinces/MT";
import { NE } from "./provinces/NE";
import { NV } from "./provinces/NV";
import { NH } from "./provinces/NH";
import { NJ } from "./provinces/NJ";
import { NM } from "./provinces/NM";
import { NY } from "./provinces/NY";
import { NC } from "./provinces/NC";
import { ND } from "./provinces/ND";
import { OH } from "./provinces/OH";
import { OK } from "./provinces/OK";
import { OR } from "./provinces/OR";
import { PA } from "./provinces/PA";
import { RI } from "./provinces/RI";
import { SC } from "./provinces/SC";
import { SD } from "./provinces/SD";
import { TN } from "./provinces/TN";
import { TX } from "./provinces/TX";
import { UT } from "./provinces/UT";
import { VT } from "./provinces/VT";
import { VA } from "./provinces/VA";
import { WA } from "./provinces/WA";
import { WV } from "./provinces/WV";
import { WI } from "./provinces/WI";
import { WY } from "./provinces/WY";

export const US_STATES: ProvinceDef[] = [
  AL,
  AK,
  AZ,
  AR,
  CA,
  CO,
  CT,
  DE,
  DC,
  FL,
  GA,
  HI,
  ID,
  IL,
  IN,
  IA,
  KS,
  KY,
  LA,
  ME,
  MD,
  MA,
  MI,
  MN,
  MS,
  MO,
  MT,
  NE,
  NV,
  NH,
  NJ,
  NM,
  NY,
  NC,
  ND,
  OH,
  OK,
  OR,
  PA,
  RI,
  SC,
  SD,
  TN,
  TX,
  UT,
  VT,
  VA,
  WA,
  WV,
  WI,
  WY
];

export const US: CountryDef = {
  id: "US",
  label: "United States",
  currency: "USD",
  symbol: "$",
  distanceUnit: "mi",
  hasContractorEconomy: true,
  hasSelfAssessmentTax: true,
  hasMileageDeduction: true,
  mileageDeductionLabel: "IRS Standard Rate",
  cashEconomyPrimary: false,
  expenseProfile: "irs",
  taxInstallmentDates: [
    { month: 4, day: 15, label: "Q1 Estimated Payment" },
    { month: 6, day: 15, label: "Q2 Estimated Payment" },
    { month: 9, day: 15, label: "Q3 Estimated Payment" },
    { month: 1, day: 15, label: "Q4 Estimated Payment", followYear: true },
    { month: 4, day: 15, label: "Federal Tax Return Filing", followYear: true },
  ],
  hasSETax: true,
  mileageRateSource: "IRS",
  defaultAvailablePlatforms: ["doordash", "ubereats", "instacart", "amazonflex", "lyft", "other"],
  tax: {
    intlLocaleTag: "en-US",
    defaultWithholdingPct: 25,
    regionPresetType: "US",
    fallbackCurrency: "USD",
    hstOnboarding: false,
    hstRateWhenRegistered: 0,
    calcCpp: false,
    calcSeTax: true,
    regionLabel: "state",
    secondaryEstimator: "se",
    footnote: "us",
    defaultRegionCode: "CA",
    taxInstallmentReminderDays: 10,
  },
  featureOverrides: {
    force_on: [],
    force_off: [],
  },
  vocabularyOverrides: {},
};
