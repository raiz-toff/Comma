import { getCountryDef } from "./countries/index";

export interface ExpenseCategory {
  id: string;
  label: string;
  icon: string;
  taxCode: string | null;
  taxCodeLabel: string | null;
  defaultDeductiblePct: number;  // 0–100
  deductibleNote: string | null; // shown as warning when < 100
}

// ─── Canada CRA — T2125 Motor Vehicle Expenses ────────────────────────────────
export const CANADIAN_CRA_CATEGORIES: ExpenseCategory[] = [
  { id: "fuel",        label: "Fuel & Oil",      icon: "⛽", taxCode: "9270", taxCodeLabel: "Fuel and oil",                          defaultDeductiblePct: 100, deductibleNote: null },
  { id: "maintenance", label: "Maintenance",     icon: "🔧", taxCode: "9281", taxCodeLabel: "Repairs and maintenance",               defaultDeductiblePct: 100, deductibleNote: null },
  { id: "insurance",   label: "Insurance",       icon: "🛡️", taxCode: "9281", taxCodeLabel: "Insurance",                             defaultDeductiblePct: 100, deductibleNote: null },
  { id: "licensing",   label: "License & Reg.",  icon: "🪪", taxCode: "9270", taxCodeLabel: "License and registration",              defaultDeductiblePct: 100, deductibleNote: null },
  { id: "interest",    label: "Interest (Loan)", icon: "📈", taxCode: "9270", taxCodeLabel: "Interest on vehicle loan",              defaultDeductiblePct: 100, deductibleNote: null },
  { id: "leasing",     label: "Lease Costs",     icon: "🤝", taxCode: "9281", taxCodeLabel: "Lease payments",                       defaultDeductiblePct: 100, deductibleNote: null },
  { id: "fees",        label: "Dues & Fees",     icon: "💼", taxCode: "9270", taxCodeLabel: "Dues and memberships",                 defaultDeductiblePct: 100, deductibleNote: null },
  { id: "phone",       label: "Phone/Internet",  icon: "📱", taxCode: "9270", taxCodeLabel: "Phone and utilities",                  defaultDeductiblePct: 50,  deductibleNote: "CRA limits mixed-use phones to 50% unless you track personal vs. business minutes separately." },
  { id: "supplies",    label: "Supplies",        icon: "🎒", taxCode: "9270", taxCodeLabel: "Office expenses",                      defaultDeductiblePct: 100, deductibleNote: null },
  { id: "wash",        label: "Wash/Cleaning",   icon: "🚿", taxCode: "9281", taxCodeLabel: "Other expenses – vehicle cleaning",   defaultDeductiblePct: 100, deductibleNote: null },
  { id: "parking",     label: "Parking",         icon: "🅿️", taxCode: "8910", taxCodeLabel: "Parking, meter, and tolls",            defaultDeductiblePct: 100, deductibleNote: null },
  { id: "tolls",       label: "Tolls",           icon: "🛣️", taxCode: "8910", taxCodeLabel: "Parking, meter, and tolls",            defaultDeductiblePct: 100, deductibleNote: null },
  { id: "data_plan",   label: "Data Plan",       icon: "📶", taxCode: "9220", taxCodeLabel: "Telephone and utilities",              defaultDeductiblePct: 50,  deductibleNote: "CRA limits mixed-use data plans to 50% unless you track personal vs. business use separately." },
  { id: "meals",       label: "Meals",           icon: "🍽️", taxCode: "8523", taxCodeLabel: "Meals and entertainment",              defaultDeductiblePct: 50,  deductibleNote: "CRA limits meals and entertainment to 50% of the amount paid." },
  { id: "bank_fees",   label: "Bank Fees",       icon: "🏦", taxCode: "8710", taxCodeLabel: "Interest and bank charges",            defaultDeductiblePct: 100, deductibleNote: null },
  { id: "accounting",  label: "Accounting",      icon: "🧮", taxCode: "8860", taxCodeLabel: "Professional fees",                    defaultDeductiblePct: 100, deductibleNote: null },
  { id: "software",    label: "Software",        icon: "💻", taxCode: "9270", taxCodeLabel: "Other expenses",                       defaultDeductiblePct: 100, deductibleNote: null },
  { id: "bike_maintenance", label: "Bike Maintenance", icon: "🚲", taxCode: "8590", taxCodeLabel: "Maintenance and repairs",        defaultDeductiblePct: 100, deductibleNote: null },
  { id: "out_of_pocket", label: "Out of Pocket", icon: "💳", taxCode: null,   taxCodeLabel: null,                                   defaultDeductiblePct: 0,   deductibleNote: "Personal or reimbursed costs are not deductible — tracked for your records only." },
  { id: "other",       label: "Other Expenses",  icon: "💵", taxCode: "9270", taxCodeLabel: "Other expenses",                       defaultDeductiblePct: 100, deductibleNote: null },
];

// ─── USA IRS — Schedule C ────────────────────────────────────────────────────
export const US_IRS_CATEGORIES: ExpenseCategory[] = [
  { id: "fuel",        label: "Gas & Fuel",      icon: "⛽", taxCode: "Part II Line 9",    taxCodeLabel: "Car and truck expenses",             defaultDeductiblePct: 100, deductibleNote: null },
  { id: "maintenance", label: "Maintenance",     icon: "🔧", taxCode: "Part II Line 9",    taxCodeLabel: "Car and truck expenses",             defaultDeductiblePct: 100, deductibleNote: null },
  { id: "insurance",   label: "Auto Insurance",  icon: "🛡️", taxCode: "Part II Line 15",   taxCodeLabel: "Insurance",                          defaultDeductiblePct: 100, deductibleNote: null },
  { id: "licensing",   label: "Taxes & Lic.",    icon: "🪪", taxCode: "Part II Line 23",   taxCodeLabel: "Taxes and licenses",                 defaultDeductiblePct: 100, deductibleNote: null },
  { id: "interest",    label: "Loan Interest",   icon: "📈", taxCode: "Part II Line 16b",  taxCodeLabel: "Interest – other",                   defaultDeductiblePct: 100, deductibleNote: null },
  { id: "leasing",     label: "Lease & Rental",  icon: "🤝", taxCode: "Part II Line 20b",  taxCodeLabel: "Rent or lease – vehicles",           defaultDeductiblePct: 100, deductibleNote: null },
  { id: "phone",       label: "Phone & Data",    icon: "📱", taxCode: "Part II Line 25",   taxCodeLabel: "Utilities",                          defaultDeductiblePct: 50,  deductibleNote: "IRS treats cell phones as listed property. 50% applies unless you log business vs. personal use each month." },
  { id: "supplies",    label: "Tools/Supplies",  icon: "🎒", taxCode: "Part II Line 22",   taxCodeLabel: "Supplies",                           defaultDeductiblePct: 100, deductibleNote: null },
  { id: "parking",     label: "Parking",         icon: "🅿️", taxCode: "Part II Line 9",    taxCodeLabel: "Car and truck – tolls and parking",  defaultDeductiblePct: 100, deductibleNote: null },
  { id: "tolls",       label: "Tolls",           icon: "🛣️", taxCode: "Part II Line 9",    taxCodeLabel: "Car and truck – tolls and parking",  defaultDeductiblePct: 100, deductibleNote: null },
  { id: "fees",        label: "Dues & Fees",     icon: "💼", taxCode: "Part II Line 27a",  taxCodeLabel: "Other expenses – dues and fees",     defaultDeductiblePct: 100, deductibleNote: null },
  { id: "wash",        label: "Car Wash",        icon: "🚿", taxCode: "Part II Line 9",    taxCodeLabel: "Car and truck expenses",             defaultDeductiblePct: 100, deductibleNote: null },
  { id: "data_plan",   label: "Data Plan",       icon: "📶", taxCode: "Part II Line 25",   taxCodeLabel: "Utilities",                          defaultDeductiblePct: 50,  deductibleNote: "50% applies unless you log business vs. personal data use each month." },
  { id: "meals",       label: "Meals",           icon: "🍽️", taxCode: "Part II Line 24b",  taxCodeLabel: "Deductible meals",                   defaultDeductiblePct: 50,  deductibleNote: "IRS generally limits business meals to 50% of the cost." },
  { id: "bank_fees",   label: "Bank Fees",       icon: "🏦", taxCode: "Part II Line 27a",  taxCodeLabel: "Other expenses – bank charges",      defaultDeductiblePct: 100, deductibleNote: null },
  { id: "accounting",  label: "Accounting",      icon: "🧮", taxCode: "Part II Line 17",   taxCodeLabel: "Legal and professional services",    defaultDeductiblePct: 100, deductibleNote: null },
  { id: "software",    label: "Software",        icon: "💻", taxCode: "Part II Line 18",   taxCodeLabel: "Office expense",                     defaultDeductiblePct: 100, deductibleNote: null },
  { id: "bike_maintenance", label: "Bike Maintenance", icon: "🚲", taxCode: "Part II Line 27a", taxCodeLabel: "Other expenses",                defaultDeductiblePct: 100, deductibleNote: null },
  { id: "out_of_pocket", label: "Out of Pocket", icon: "💳", taxCode: null,                taxCodeLabel: null,                                 defaultDeductiblePct: 0,   deductibleNote: "Personal or reimbursed costs are not deductible — tracked for your records only." },
  { id: "other",       label: "Other Expenses",  icon: "💵", taxCode: "Part II Line 27a",  taxCodeLabel: "Other expenses",                     defaultDeductiblePct: 100, deductibleNote: null },
];

// ─── UK HMRC — SA103F ────────────────────────────────────────────────────────
export const UK_HMRC_CATEGORIES: ExpenseCategory[] = [
  { id: "fuel",        label: "Fuel & Oil",      icon: "⛽", taxCode: "Box 17", taxCodeLabel: "Car, van and travel expenses",                          defaultDeductiblePct: 100, deductibleNote: null },
  { id: "maintenance", label: "Repairs & Serv.", icon: "🔧", taxCode: "Box 17", taxCodeLabel: "Car, van and travel expenses",                          defaultDeductiblePct: 100, deductibleNote: null },
  { id: "insurance",   label: "Car Insurance",   icon: "🛡️", taxCode: "Box 17", taxCodeLabel: "Car, van and travel expenses",                          defaultDeductiblePct: 100, deductibleNote: null },
  { id: "licensing",   label: "Road Tax & Reg.", icon: "🪪", taxCode: "Box 17", taxCodeLabel: "Car, van and travel expenses",                          defaultDeductiblePct: 100, deductibleNote: null },
  { id: "interest",    label: "Finance Interest",icon: "📈", taxCode: "Box 19", taxCodeLabel: "Interest on bank and other loans",                      defaultDeductiblePct: 100, deductibleNote: null },
  { id: "leasing",     label: "Vehicle Hire",    icon: "🤝", taxCode: "Box 17", taxCodeLabel: "Car, van and travel expenses",                          defaultDeductiblePct: 100, deductibleNote: null },
  { id: "phone",       label: "Mobile & Data",   icon: "📱", taxCode: "Box 20", taxCodeLabel: "Phone, fax, stationery and other office costs",         defaultDeductiblePct: 100, deductibleNote: null },
  { id: "supplies",    label: "Equipment",       icon: "🎒", taxCode: "Box 20", taxCodeLabel: "Phone, fax, stationery and other office costs",         defaultDeductiblePct: 100, deductibleNote: null },
  { id: "parking",     label: "Parking",         icon: "🅿️", taxCode: "Box 17", taxCodeLabel: "Car, van and travel expenses",                          defaultDeductiblePct: 100, deductibleNote: null },
  { id: "tolls",       label: "Tolls",           icon: "🛣️", taxCode: "Box 17", taxCodeLabel: "Car, van and travel expenses",                          defaultDeductiblePct: 100, deductibleNote: null },
  { id: "fees",        label: "Dues & Fees",     icon: "💼", taxCode: "Box 20", taxCodeLabel: "Other allowable business expenses",                     defaultDeductiblePct: 100, deductibleNote: null },
  { id: "wash",        label: "Car Wash",        icon: "🚿", taxCode: "Box 17", taxCodeLabel: "Car, van and travel expenses",                          defaultDeductiblePct: 100, deductibleNote: null },
  { id: "data_plan",   label: "Data Plan",       icon: "📶", taxCode: "Box 20", taxCodeLabel: "Phone, fax, stationery and other office costs",         defaultDeductiblePct: 100, deductibleNote: null },
  { id: "meals",       label: "Meals",           icon: "🍽️", taxCode: "Box 17", taxCodeLabel: "Car, van and travel expenses (subsistence)",            defaultDeductiblePct: 100, deductibleNote: "HMRC only allows subsistence on qualifying business journeys." },
  { id: "bank_fees",   label: "Bank Fees",       icon: "🏦", taxCode: "Box 26", taxCodeLabel: "Bank, credit card and other financial charges",         defaultDeductiblePct: 100, deductibleNote: null },
  { id: "accounting",  label: "Accounting",      icon: "🧮", taxCode: "Box 27", taxCodeLabel: "Accountancy, legal and other professional fees",        defaultDeductiblePct: 100, deductibleNote: null },
  { id: "software",    label: "Software",        icon: "💻", taxCode: "Box 20", taxCodeLabel: "Phone, fax, stationery and other office costs",         defaultDeductiblePct: 100, deductibleNote: null },
  { id: "bike_maintenance", label: "Bike Maintenance", icon: "🚲", taxCode: "Box 17", taxCodeLabel: "Car, van and travel expenses",                    defaultDeductiblePct: 100, deductibleNote: null },
  { id: "out_of_pocket", label: "Out of Pocket", icon: "💳", taxCode: null,     taxCodeLabel: null,                                                    defaultDeductiblePct: 0,   deductibleNote: "Personal or reimbursed costs are not deductible — tracked for your records only." },
  { id: "other",       label: "Other Expenses",  icon: "💵", taxCode: "Box 20", taxCodeLabel: "Other allowable business expenses",                     defaultDeductiblePct: 100, deductibleNote: null },
];

// ─── Generic (Nepal + unknown countries) ─────────────────────────────────────
export const GENERIC_CATEGORIES: ExpenseCategory[] = [
  { id: "fuel",        label: "Fuel & Gas",       icon: "⛽", taxCode: null, taxCodeLabel: null, defaultDeductiblePct: 100, deductibleNote: null },
  { id: "maintenance", label: "Maintenance",      icon: "🔧", taxCode: null, taxCodeLabel: null, defaultDeductiblePct: 100, deductibleNote: null },
  { id: "insurance",   label: "Insurance",        icon: "🛡️", taxCode: null, taxCodeLabel: null, defaultDeductiblePct: 100, deductibleNote: null },
  { id: "licensing",   label: "License & Reg.",   icon: "🪪", taxCode: null, taxCodeLabel: null, defaultDeductiblePct: 100, deductibleNote: null },
  { id: "interest",    label: "Loan Interest",    icon: "📈", taxCode: null, taxCodeLabel: null, defaultDeductiblePct: 100, deductibleNote: null },
  { id: "leasing",     label: "Lease & Rental",   icon: "🤝", taxCode: null, taxCodeLabel: null, defaultDeductiblePct: 100, deductibleNote: null },
  { id: "fees",        label: "Dues & Fees",      icon: "💼", taxCode: null, taxCodeLabel: null, defaultDeductiblePct: 100, deductibleNote: null },
  { id: "phone",       label: "Phone & Data",     icon: "📱", taxCode: null, taxCodeLabel: null, defaultDeductiblePct: 100, deductibleNote: null },
  { id: "data_plan",   label: "Data Plan",        icon: "📶", taxCode: null, taxCodeLabel: null, defaultDeductiblePct: 100, deductibleNote: null },
  { id: "supplies",    label: "Tools & Supplies", icon: "🎒", taxCode: null, taxCodeLabel: null, defaultDeductiblePct: 100, deductibleNote: null },
  { id: "wash",        label: "Wash/Cleaning",    icon: "🚿", taxCode: null, taxCodeLabel: null, defaultDeductiblePct: 100, deductibleNote: null },
  { id: "parking",     label: "Parking",          icon: "🅿️", taxCode: null, taxCodeLabel: null, defaultDeductiblePct: 100, deductibleNote: null },
  { id: "tolls",       label: "Tolls",            icon: "🛣️", taxCode: null, taxCodeLabel: null, defaultDeductiblePct: 100, deductibleNote: null },
  { id: "meals",       label: "Meals",            icon: "🍽️", taxCode: null, taxCodeLabel: null, defaultDeductiblePct: 100, deductibleNote: null },
  { id: "bank_fees",   label: "Bank Fees",        icon: "🏦", taxCode: null, taxCodeLabel: null, defaultDeductiblePct: 100, deductibleNote: null },
  { id: "accounting",  label: "Accounting",       icon: "🧮", taxCode: null, taxCodeLabel: null, defaultDeductiblePct: 100, deductibleNote: null },
  { id: "software",    label: "Software",         icon: "💻", taxCode: null, taxCodeLabel: null, defaultDeductiblePct: 100, deductibleNote: null },
  { id: "bike_maintenance", label: "Bike Maintenance", icon: "🚲", taxCode: null, taxCodeLabel: null, defaultDeductiblePct: 100, deductibleNote: null },
  { id: "out_of_pocket", label: "Out of Pocket",  icon: "💳", taxCode: null, taxCodeLabel: null, defaultDeductiblePct: 0,   deductibleNote: "Personal or reimbursed costs are not deductible — tracked for your records only." },
  { id: "other",       label: "Other Expenses",   icon: "💵", taxCode: null, taxCodeLabel: null, defaultDeductiblePct: 100, deductibleNote: null },
];

export type ExpenseCategoryKey = string;

/**
 * Legacy → canonical category id aliases (2026-07-04 web↔mobile category unification).
 * The web app historically used its own slugs for two concepts; the canonical vocabulary
 * (this registry) wins. Kept as a lookup safety net for rows written before migration
 * 0023_category_canonicalize / web logical migration 6, and for old change-logs still in
 * Drive. New ids must NEVER be added here — extend the profile lists instead, with the
 * SAME id on both apps (web: `web/src/registry/expense-categories/index.js`).
 */
export const LEGACY_CATEGORY_ALIASES: Record<string, string> = {
  car_wash: "wash",
  registration: "licensing",
};

/** Resolve a possibly-legacy category id to its canonical form. */
export function canonicalCategoryId(id: string): string {
  return LEGACY_CATEGORY_ALIASES[id] ?? id;
}

function normalizeCategory(
  c: Partial<ExpenseCategory> & { id: string; label: string; icon: string }
): ExpenseCategory {
  return {
    taxCode: null,
    taxCodeLabel: null,
    defaultDeductiblePct: 100,
    deductibleNote: null,
    ...c,
  };
}

export function getExpenseCategories(
  countryOrProfile: string = "CA",
  customCategories: Array<Partial<ExpenseCategory> & { id: string; label: string; icon: string }> = []
): ExpenseCategory[] {
  let profile: "cra" | "irs" | "hmrc" | "generic" = "generic";
  const input = String(countryOrProfile).trim();

  if (input === "cra") profile = "cra";
  else if (input === "irs") profile = "irs";
  else if (input === "hmrc") profile = "hmrc";
  else if (input === "generic") profile = "generic";
  else {
    const country = getCountryDef(input);
    profile = country.expenseProfile || "generic";
  }

  const base =
    profile === "cra"   ? CANADIAN_CRA_CATEGORIES :
    profile === "irs"   ? US_IRS_CATEGORIES :
    profile === "hmrc"  ? UK_HMRC_CATEGORIES :
                          GENERIC_CATEGORIES;

  return [...base, ...customCategories.map(normalizeCategory)];
}

export function getCategoryMeta(
  id: string,
  countryOrProfile: string = "CA",
  customCategories: Array<Partial<ExpenseCategory> & { id: string; label: string; icon: string }> = []
): ExpenseCategory {
  const list = getExpenseCategories(countryOrProfile, customCategories);
  const canonical = canonicalCategoryId(id);
  return (
    list.find((c) => c.id === canonical) ??
    { id: "other", label: "Other Expenses", icon: "💵", taxCode: null, taxCodeLabel: null, defaultDeductiblePct: 100, deductibleNote: null }
  );
}

export function getCategoryDefaultPct(
  id: string,
  countryOrProfile: string = "CA",
  customCategories: Array<Partial<ExpenseCategory> & { id: string; label: string; icon: string }> = []
): number {
  return getCategoryMeta(id, countryOrProfile, customCategories).defaultDeductiblePct;
}
