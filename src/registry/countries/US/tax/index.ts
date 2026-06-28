import { US_STATES } from "../index";

export const WITHHOLDING_PRESETS_US: Record<string, number> = Object.freeze(
  Object.fromEntries(
    US_STATES.map((p) => [p.id, p.withholdingPct ?? 0])
  )
);
