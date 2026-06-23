export const EXPENSE_CATEGORIES = {
  fuel:        { label: "Fuel",        icon: "ti-gas-station"   },
  maintenance: { label: "Maintenance", icon: "ti-tool"           },
  phone:       { label: "Phone/Data",  icon: "ti-device-mobile"  },
  insurance:   { label: "Insurance",   icon: "ti-shield"         },
  supplies:    { label: "Supplies",    icon: "ti-shopping-bag"   },
  parking:     { label: "Parking",     icon: "ti-parking"        },
  other:       { label: "Other",       icon: "ti-dots"           },
} as const;

export type ExpenseCategoryKey = keyof typeof EXPENSE_CATEGORIES;
