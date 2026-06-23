export const PLATFORMS = {
  doordash:    { label: "DoorDash",        color: "#FF3008", textColor: "#FFFFFF" },
  ubereats:    { label: "Uber Eats",        color: "#06C167", textColor: "#000000" },
  skip:        { label: "SkipTheDishes",    color: "#ED5A1F", textColor: "#FFFFFF" },
  instacart:   { label: "Instacart",        color: "#0AAD0A", textColor: "#FFFFFF" },
  amazonflex:  { label: "Amazon Flex",      color: "#232F3E", textColor: "#FFFFFF" },
  foodora:     { label: "Foodora",          color: "#D8003F", textColor: "#FFFFFF" },
  lyft:        { label: "Lyft",             color: "#FF00BF", textColor: "#FFFFFF" },
  amazon:      { label: "Amazon Flex",      color: "#232F3E", textColor: "#FFFFFF" },
  other:       { label: "Other",            color: "#6B7280", textColor: "#FFFFFF" },
} as const;

export type PlatformKey = keyof typeof PLATFORMS;
