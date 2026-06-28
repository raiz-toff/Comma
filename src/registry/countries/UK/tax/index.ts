import { UK_REGIONS } from "../index";

export const WITHHOLDING_PRESETS_UK: Record<string, number> = Object.freeze(
  Object.fromEntries(
    UK_REGIONS.map((p) => [p.id, p.withholdingPct ?? 0])
  )
);
