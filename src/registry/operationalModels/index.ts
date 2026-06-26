/**
 * Operational Model Registry
 *
 * Defines HOW a gig platform works — independently of which specific platform it is.
 * A platform's operational model drives: revenue fields shown, terminology used,
 * whether cash/tips/mileage apply, and what deduction logic runs.
 *
 * Adding a new type of gig work means adding one model here — all UI adapts automatically.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type OperationalModelId =
  | "delivery_fixed"       // Platform-set price, tip optional. e.g. DoorDash, UberEats
  | "delivery_negotiated"  // Negotiated fare, cash common. e.g. Pathao Food, Talabat
  | "rideshare_metered"    // Surge+base, metered by app. e.g. Lyft, Uber
  | "rideshare_bidding"    // Driver bids/sets price, cash common. e.g. InDriver, Pathao Ride
  | "grocery_batch"        // Batch of orders, per-item bonus. e.g. Instacart
  | "parcel_route";        // Block/route-based, fixed per route. e.g. Amazon Flex, Lalamove

/**
 * A revenue field to display on the shift-logging form.
 * All revenue ultimately maps to existing DB columns.
 */
export interface RevenueFieldDef {
  /** Maps to an existing column in the shifts DB table */
  key: "grossRevenue" | "tipsRevenue" | "bonusRevenue" | "surgeRevenue" | "cashRevenue";
  /** Label shown to the driver */
  label: string;
  /** Short hint under the input */
  hint: string;
  /** Whether this field must be filled in */
  required: boolean;
  /** Whether this amount is included in taxable income calculations */
  isTaxable: boolean;
}

/**
 * Full definition of how a type of gig platform operates.
 * Consumed by the shift-logging form, display cards, and tax screen.
 */
export interface OperationalModelDef {
  id: OperationalModelId;

  // ── Display ────────────────────────────────────────────────────────────────
  label: string;
  description: string;

  // ── Terminology ────────────────────────────────────────────────────────────
  /** What the worker is called (platform can override this) */
  driverTerm: string;     // "Driver" | "Dasher" | "Courier" | "Shopper" | "Partner"
  /** What a working session is called */
  sessionTerm: string;    // "Shift" | "Session" | "Block" | "Route"
  /** What an individual job within a session is called */
  tripTerm: string;       // "Order" | "Ride" | "Delivery" | "Batch" | "Package"

  // ── Revenue ────────────────────────────────────────────────────────────────
  /** Ordered list of revenue input fields for the shift form */
  revenueFields: RevenueFieldDef[];

  // ── Feature flags ─────────────────────────────────────────────────────────
  /** Whether GPS mileage tracking is relevant for this model */
  tracksMileage: boolean;
  /** If true, platform reimburses mileage — GPS tracking is for records, not deductions */
  mileageReimbursedByPlatform: boolean;
  /** Whether cash payments are common (enables cash reconciliation tools) */
  supportsCashPayments: boolean;
  /** Whether tip income is expected/possible */
  hasTips: boolean;
  /** Whether surge/dynamic pricing is a concept on this model */
  hasSurge: boolean;
  /** Whether the driver negotiates or sets their own price */
  driverSetsPricing: boolean;
  /** Whether the platform issues a tax document (1099, T4A, etc.) */
  platformIssuesTaxForm: boolean;

  // ── Expense / Deduction profile ────────────────────────────────────────────
  /** Which expense category set is most relevant */
  expenseProfile: "cra" | "irs" | "hmrc" | "generic";
}

// ─── Model definitions ────────────────────────────────────────────────────────

const DELIVERY_FIXED: OperationalModelDef = {
  id: "delivery_fixed",
  label: "Fixed-Price Delivery",
  description: "Platform sets delivery price. Driver accepts or declines orders. Tips optional.",
  driverTerm: "Courier",
  sessionTerm: "Shift",
  tripTerm: "Order",
  revenueFields: [
    {
      key: "grossRevenue",
      label: "Gross Revenue",
      hint: "Total amount earned from deliveries (before tips)",
      required: true,
      isTaxable: true,
    },
    {
      key: "tipsRevenue",
      label: "Tips Received",
      hint: "Customer tips received during this shift",
      required: false,
      isTaxable: true,
    },
    {
      key: "bonusRevenue",
      label: "Bonuses & Incentives",
      hint: "Peak pay, challenges, or promotional bonuses",
      required: false,
      isTaxable: true,
    },
  ],
  tracksMileage: true,
  mileageReimbursedByPlatform: false,
  supportsCashPayments: false,
  hasTips: true,
  hasSurge: false,
  driverSetsPricing: false,
  platformIssuesTaxForm: true,
  expenseProfile: "generic",
};

const DELIVERY_NEGOTIATED: OperationalModelDef = {
  id: "delivery_negotiated",
  label: "Negotiated Delivery",
  description: "Fare is negotiated between driver and customer. Cash payments common.",
  driverTerm: "Partner",
  sessionTerm: "Session",
  tripTerm: "Delivery",
  revenueFields: [
    {
      key: "grossRevenue",
      label: "Total Fare Collected",
      hint: "Total amount received for all deliveries this session",
      required: true,
      isTaxable: true,
    },
    {
      key: "cashRevenue",
      label: "Cash Portion",
      hint: "How much of the total was received in cash",
      required: false,
      isTaxable: true,
    },
  ],
  tracksMileage: true,
  mileageReimbursedByPlatform: false,
  supportsCashPayments: true,
  hasTips: false,
  hasSurge: false,
  driverSetsPricing: true,
  platformIssuesTaxForm: false,
  expenseProfile: "generic",
};

const RIDESHARE_METERED: OperationalModelDef = {
  id: "rideshare_metered",
  label: "Metered Rideshare",
  description: "App meters the fare with base rate + surge multiplier. Tips optional.",
  driverTerm: "Driver",
  sessionTerm: "Shift",
  tripTerm: "Trip",
  revenueFields: [
    {
      key: "grossRevenue",
      label: "Gross Fares",
      hint: "Total ride fares earned before platform commission",
      required: true,
      isTaxable: true,
    },
    {
      key: "surgeRevenue",
      label: "Surge Earnings",
      hint: "Additional earnings from surge pricing (if tracked separately)",
      required: false,
      isTaxable: true,
    },
    {
      key: "tipsRevenue",
      label: "Tips",
      hint: "In-app and cash tips received",
      required: false,
      isTaxable: true,
    },
    {
      key: "bonusRevenue",
      label: "Bonuses",
      hint: "Quest bonuses, streak rewards, referral bonuses",
      required: false,
      isTaxable: true,
    },
  ],
  tracksMileage: true,
  mileageReimbursedByPlatform: false,
  supportsCashPayments: false,
  hasTips: true,
  hasSurge: true,
  driverSetsPricing: false,
  platformIssuesTaxForm: true,
  expenseProfile: "generic",
};

const RIDESHARE_BIDDING: OperationalModelDef = {
  id: "rideshare_bidding",
  label: "Bid-Based Rideshare",
  description: "Driver proposes or accepts fares. Mostly cash. No platform tax document.",
  driverTerm: "Driver",
  sessionTerm: "Session",
  tripTerm: "Ride",
  revenueFields: [
    {
      key: "grossRevenue",
      label: "Total Fares",
      hint: "Total fare amount collected for all rides this session",
      required: true,
      isTaxable: true,
    },
    {
      key: "cashRevenue",
      label: "Cash Received",
      hint: "Amount collected in cash (for cash reconciliation)",
      required: false,
      isTaxable: true,
    },
  ],
  tracksMileage: true,
  mileageReimbursedByPlatform: false,
  supportsCashPayments: true,
  hasTips: false,
  hasSurge: false,
  driverSetsPricing: true,
  platformIssuesTaxForm: false,
  expenseProfile: "generic",
};

const GROCERY_BATCH: OperationalModelDef = {
  id: "grocery_batch",
  label: "Grocery / Batch Shopping",
  description: "Shop and deliver batched grocery orders. Per-item bonuses possible.",
  driverTerm: "Shopper",
  sessionTerm: "Batch",
  tripTerm: "Order",
  revenueFields: [
    {
      key: "grossRevenue",
      label: "Batch Pay",
      hint: "Base pay for completing the grocery batch",
      required: true,
      isTaxable: true,
    },
    {
      key: "tipsRevenue",
      label: "Tips",
      hint: "Customer tips received on this batch",
      required: false,
      isTaxable: true,
    },
    {
      key: "bonusRevenue",
      label: "Peak / Heavy Pay",
      hint: "Extra pay for heavy orders or peak demand periods",
      required: false,
      isTaxable: true,
    },
  ],
  tracksMileage: true,
  mileageReimbursedByPlatform: false,
  supportsCashPayments: false,
  hasTips: true,
  hasSurge: false,
  driverSetsPricing: false,
  platformIssuesTaxForm: true,
  expenseProfile: "generic",
};

const PARCEL_ROUTE: OperationalModelDef = {
  id: "parcel_route",
  label: "Parcel Route / Block",
  description: "Fixed pay per route or block. No tips. Mileage often reimbursed by platform.",
  driverTerm: "Driver",
  sessionTerm: "Block",
  tripTerm: "Package",
  revenueFields: [
    {
      key: "grossRevenue",
      label: "Block Pay",
      hint: "Fixed earnings for completing this delivery block or route",
      required: true,
      isTaxable: true,
    },
    {
      key: "bonusRevenue",
      label: "Reschedule / Extra Pay",
      hint: "Any additional compensation for extra stops or rescheduled blocks",
      required: false,
      isTaxable: true,
    },
  ],
  tracksMileage: true,
  mileageReimbursedByPlatform: true,   // Amazon Flex pays a per-mile rate
  supportsCashPayments: false,
  hasTips: false,
  hasSurge: false,
  driverSetsPricing: false,
  platformIssuesTaxForm: true,
  expenseProfile: "generic",
};

// ─── Registry map ─────────────────────────────────────────────────────────────

const OPERATIONAL_MODELS: Record<OperationalModelId, OperationalModelDef> = {
  delivery_fixed: DELIVERY_FIXED,
  delivery_negotiated: DELIVERY_NEGOTIATED,
  rideshare_metered: RIDESHARE_METERED,
  rideshare_bidding: RIDESHARE_BIDDING,
  grocery_batch: GROCERY_BATCH,
  parcel_route: PARCEL_ROUTE,
};

// ─── Public helpers ───────────────────────────────────────────────────────────

export function getOperationalModel(id: OperationalModelId): OperationalModelDef {
  return OPERATIONAL_MODELS[id];
}

export function listOperationalModels(): OperationalModelDef[] {
  return Object.values(OPERATIONAL_MODELS);
}

/**
 * Resolve the effective terminology for a platform, allowing platform-level
 * overrides to take priority over the model default.
 */
export function resolveTerminology(
  model: OperationalModelDef,
  overrides?: Partial<{ driverTerm: string; sessionTerm: string; tripTerm: string }>
): { driverTerm: string; sessionTerm: string; tripTerm: string } {
  return {
    driverTerm: overrides?.driverTerm ?? model.driverTerm,
    sessionTerm: overrides?.sessionTerm ?? model.sessionTerm,
    tripTerm: overrides?.tripTerm ?? model.tripTerm,
  };
}
