import React from "react";
import { View } from "react-native";
import { RatioBar } from "../ui/RatioBar";
import { StatRow } from "../ui/StatRow";
import { KPI } from "@/src/theme/colors";

interface IncomeBreakdownWidgetProps {
  totalRevenue: number;
  netIncome: number;
  taxWithholdingPct: number;
  country: string;
}

export default function IncomeBreakdownWidget({
  totalRevenue,
  netIncome,
  taxWithholdingPct,
  country,
}: IncomeBreakdownWidgetProps) {
  const taxWithholding = totalRevenue * (taxWithholdingPct / 100);
  const expenseClaim = Math.max(0, totalRevenue - netIncome);
  const takeHome = Math.max(0, netIncome - taxWithholding);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: country === "CA" ? "CAD" : "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(val);
  };

  const netPct = totalRevenue > 0 ? (takeHome / totalRevenue) * 100 : 0;
  const taxPct = totalRevenue > 0 ? (taxWithholding / totalRevenue) * 100 : 0;
  const expPct = totalRevenue > 0 ? (expenseClaim / totalRevenue) * 100 : 0;

  return (
    <View style={{ gap: 16, paddingTop: 4 }}>
      <RatioBar
        mode="percent"
        accessibilityLabel={`Income breakdown: true net ${formatCurrency(takeHome)}, estimated taxes ${formatCurrency(taxWithholding)}, expenses ${formatCurrency(expenseClaim)}`}
        segments={[
          { value: netPct, color: KPI.net },
          { value: taxPct, color: KPI.tax },
          { value: expPct, color: KPI.expenses },
        ]}
      />

      <View style={{ gap: 12 }}>
        <StatRow label="True Net" value={formatCurrency(takeHome)} dotColor={KPI.net} />
        <StatRow label="Est. Taxes" value={formatCurrency(taxWithholding)} dotColor={KPI.tax} />
        <StatRow label="Expenses" value={formatCurrency(expenseClaim)} dotColor={KPI.expenses} />
      </View>
    </View>
  );
}
