import { getCountryDef } from "./countries/index";

export interface ExpenseCategory {
  id: string;
  label: string;
  icon: string;
}

export const CANADIAN_CRA_CATEGORIES: ExpenseCategory[] = [
  { id: "fuel",        label: "Fuel & Oil",      icon: "⛽" },
  { id: "maintenance", label: "Maintenance",     icon: "🔧" },
  { id: "insurance",   label: "Insurance",       icon: "🛡️" },
  { id: "licensing",   label: "License & Reg.",  icon: "🪪" },
  { id: "interest",    label: "Interest (Loan)", icon: "📈" },
  { id: "leasing",     label: "Lease Costs",     icon: "🤝" },
  { id: "fees",        label: "Dues & Fees",     icon: "💼" },
  { id: "phone",       label: "Phone/Internet",  icon: "📱" },
  { id: "supplies",    label: "Supplies",        icon: "🎒" },
  { id: "wash",        label: "Wash/Cleaning",   icon: "🚿" },
  { id: "other",       label: "Other Expenses",  icon: "💵" },
];

export const US_IRS_CATEGORIES: ExpenseCategory[] = [
  { id: "fuel",        label: "Gas & Fuel",      icon: "⛽" },
  { id: "maintenance", label: "Maintenance",     icon: "🔧" },
  { id: "insurance",   label: "Auto Insurance",  icon: "🛡️" },
  { id: "licensing",   label: "Taxes & Lic.",    icon: "🪪" },
  { id: "interest",    label: "Loan Interest",   icon: "📈" },
  { id: "leasing",     label: "Lease & Rental",  icon: "🤝" },
  { id: "phone",       label: "Phone & Data",    icon: "📱" },
  { id: "supplies",    label: "Tools/Supplies",  icon: "🎒" },
  { id: "parking",     label: "Tolls & Parking", icon: "🅿️" },
  { id: "other",       label: "Other Expenses",  icon: "💵" },
];

export const UK_HMRC_CATEGORIES: ExpenseCategory[] = [
  { id: "fuel",        label: "Fuel & Oil",      icon: "⛽" },
  { id: "maintenance", label: "Repairs & Serv.", icon: "🔧" },
  { id: "insurance",   label: "Car Insurance",   icon: "🛡️" },
  { id: "licensing",   label: "Road Tax & Reg.", icon: "🪪" },
  { id: "interest",    label: "Finance Interest",icon: "📈" },
  { id: "leasing",     label: "Vehicle Hire",    icon: "🤝" },
  { id: "phone",       label: "Mobile & Data",   icon: "📱" },
  { id: "supplies",    label: "Equipment",       icon: "🎒" },
  { id: "parking",     label: "Parking & Tolls", icon: "🅿️" },
  { id: "other",       label: "Other Expenses",  icon: "💵" },
];

export const GENERIC_CATEGORIES: ExpenseCategory[] = [
  { id: "fuel",        label: "Fuel & Gas",      icon: "⛽" },
  { id: "maintenance", label: "Maintenance",     icon: "🔧" },
  { id: "insurance",   label: "Insurance",       icon: "🛡️" },
  { id: "phone",       label: "Phone & Data",    icon: "📱" },
  { id: "supplies",    label: "Tools & Supplies",icon: "🎒" },
  { id: "other",       label: "Other Expenses",  icon: "💵" },
];

export type ExpenseCategoryKey = string;

export function getExpenseCategories(
  countryOrProfile: string = "CA",
  customCategories: ExpenseCategory[] = []
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
    profile === "cra"
      ? CANADIAN_CRA_CATEGORIES
      : profile === "irs"
      ? US_IRS_CATEGORIES
      : profile === "hmrc"
      ? UK_HMRC_CATEGORIES
      : GENERIC_CATEGORIES;

  return [...base, ...customCategories];
}

export function getCategoryMeta(
  id: string,
  countryOrProfile: string = "CA",
  customCategories: ExpenseCategory[] = []
): ExpenseCategory {
  const list = getExpenseCategories(countryOrProfile, customCategories);
  return list.find((c) => c.id === id) ?? { id: "other", label: "Other Expenses", icon: "💵" };
}

