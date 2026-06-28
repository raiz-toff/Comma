import { CA_PROVINCES } from "../index";

export const WITHHOLDING_PRESETS_CA: Record<string, number> = Object.freeze(
  Object.fromEntries(
    CA_PROVINCES.map((p) => [p.id, p.withholdingPct ?? 0])
  )
);
