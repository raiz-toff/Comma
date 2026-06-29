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
  { id: "parking",     label: "Tolls & Parking", icon: "🅿️", taxCode: "Part II Line 9",    taxCodeLabel: "Car and truck – tolls and parking",  defaultDeductiblePct: 100, deductibleNote: null },
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
  { id: "parking",     label: "Parking & Tolls", icon: "🅿️", taxCode: "Box 17", taxCodeLabel: "Car, van and travel expenses",                          defaultDeductiblePct: 100, deductibleNote: null },
  { id: "other",       label: "Other Expenses",  icon: "💵", taxCode: "Box 20", taxCodeLabel: "Other allowable business expenses",                     defaultDeductiblePct: 100, deductibleNote: null },
];

// ─── Generic (Nepal + unknown countries) ─────────────────────────────────────
export const GENERIC_CATEGORIES: ExpenseCategory[] = [
  { id: "fuel",        label: "Fuel & Gas",       icon: "⛽", taxCode: null, taxCodeLabel: null, defaultDeductiblePct: 100, deductibleNote: null },
  { id: "maintenance", label: "Maintenance",      icon: "🔧", taxCode: null, taxCodeLabel: null, defaultDeductiblePct: 100, deductibleNote: null },
  { id: "insurance",   label: "Insurance",        icon: "🛡️", taxCode: null, taxCodeLabel: null, defaultDeductiblePct: 100, deductibleNote: null },
  { id: "phone",       label: "Phone & Data",     icon: "📱", taxCode: null, taxCodeLabel: null, defaultDeductiblePct: 100, deductibleNote: null },
  { id: "supplies",    label: "Tools & Supplies", icon: "🎒", taxCode: null, taxCodeLabel: null, defaultDeductiblePct: 100, deductibleNote: null },
  { id: "other",       label: "Other Expenses",   icon: "💵", taxCode: null, taxCodeLabel: null, defaultDeductiblePct: 100, deductibleNote: null },
];

export type ExpenseCategoryKey = string;

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
  return (
    list.find((c) => c.id === id) ??
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
