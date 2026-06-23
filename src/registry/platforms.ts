export const PLATFORMS = {
  ubereats:    { label: "Uber Eats",       color: "#06C167", textColor: "#000000" },
  doordash:    { label: "DoorDash",         color: "#FF3008", textColor: "#FFFFFF" },
  skip:        { label: "SkipTheDishes",    color: "#FF6600", textColor: "#FFFFFF" },
  instacart:   { label: "Instacart",        color: "#43B02A", textColor: "#FFFFFF" },
  lyft:        { label: "Lyft",             color: "#FF00BF", textColor: "#FFFFFF" },
  amazon:      { label: "Amazon Flex",      color: "#FF9900", textColor: "#000000" },
  other:       { label: "Other",            color: "#6B7280", textColor: "#FFFFFF" },
} as const;

export type PlatformKey = keyof typeof PLATFORMS;
