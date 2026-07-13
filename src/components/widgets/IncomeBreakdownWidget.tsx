import React from "react";
import { View } from "react-native";
import { Text } from "../ui/text";
import { KPI } from "@/src/theme/colors";
import { useColors } from "@/src/theme/useColors";

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
  const C = useColors();
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
      {/* Stacked Bar */}
      <View
        accessible={true}
        accessibilityLabel={`Income breakdown: true net ${formatCurrency(takeHome)}, estimated taxes ${formatCurrency(taxWithholding)}, expenses ${formatCurrency(expenseClaim)}`}
        style={{ height: 12, flexDirection: "row", borderRadius: 8, overflow: "hidden", backgroundColor: C.surface04 }}
      >
        <View style={{ width: `${netPct}%`, backgroundColor: KPI.net }} />
        <View style={{ width: `${taxPct}%`, backgroundColor: KPI.tax }} />
        <View style={{ width: `${expPct}%`, backgroundColor: KPI.expenses }} />
      </View>

      {/* Legend */}
      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: KPI.net }} />
            <Text variant="labelM" className="text-content-secondary">True Net</Text>
          </View>
          <Text variant="labelM" tabular>{formatCurrency(takeHome)}</Text>
        </View>

        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: KPI.tax }} />
            <Text variant="labelM" className="text-content-secondary">Est. Taxes</Text>
          </View>
          <Text variant="labelM" tabular>{formatCurrency(taxWithholding)}</Text>
        </View>

        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: KPI.expenses }} />
            <Text variant="labelM" className="text-content-secondary">Expenses</Text>
          </View>
          <Text variant="labelM" tabular>{formatCurrency(expenseClaim)}</Text>
        </View>
      </View>
    </View>
  );
}
