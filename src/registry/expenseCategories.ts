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

export type ExpenseCategoryKey = string;

export function getExpenseCategories(
  country: string = "CA",
  customCategories: ExpenseCategory[] = []
): ExpenseCategory[] {
  const base = country === "US" ? US_IRS_CATEGORIES : CANADIAN_CRA_CATEGORIES;
  return [...base, ...customCategories];
}

export function getCategoryMeta(
  id: string,
  country: string = "CA",
  customCategories: ExpenseCategory[] = []
): ExpenseCategory {
  const list = getExpenseCategories(country, customCategories);
  return list.find((c) => c.id === id) ?? { id: "other", label: "Other Expenses", icon: "💵" };
}
