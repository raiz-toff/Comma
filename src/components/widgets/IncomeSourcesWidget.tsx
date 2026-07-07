import React from "react";
import SegmentedWidget from "./SegmentedWidget";
import PlatformActivityWidget from "./PlatformActivityWidget";
import IncomeBreakdownWidget from "./IncomeBreakdownWidget";

interface PlatformShare { platform: string; total: number; count: number; share: number }

interface IncomeSourcesWidgetProps {
  platformData: PlatformShare[];
  totalRevenue: number;
  netIncome: number;
  taxWithholdingPct: number;
  country: string;
}

/** Merges platformActivity + incomeBreakdown — both answer "where did the money come from." */
export default function IncomeSourcesWidget({ platformData, totalRevenue, netIncome, taxWithholdingPct, country }: IncomeSourcesWidgetProps) {
  return (
    <SegmentedWidget
      segments={[
        { key: "platform", label: "Platform", render: () => <PlatformActivityWidget platformData={platformData} /> },
        { key: "breakdown", label: "Breakdown", render: () => <IncomeBreakdownWidget totalRevenue={totalRevenue} netIncome={netIncome} taxWithholdingPct={taxWithholdingPct} country={country} /> },
      ]}
    />
  );
}
