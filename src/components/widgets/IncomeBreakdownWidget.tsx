import React from "react";
import { View } from "react-native";
import { Text } from "../ui/text";

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
      {/* Stacked Bar */}
      <View style={{ height: 12, flexDirection: "row", borderRadius: 6, overflow: "hidden", backgroundColor: "#262522" }}>
        <View style={{ width: `${netPct}%`, backgroundColor: "#3b82f6" }} />
        <View style={{ width: `${taxPct}%`, backgroundColor: "#0ea5e9" }} />
        <View style={{ width: `${expPct}%`, backgroundColor: "#06b6d4" }} />
      </View>

      {/* Legend */}
      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#3b82f6" }} />
            <Text style={{ fontSize: 13, fontWeight: "600", color: "#a1a1aa" }}>True Net</Text>
          </View>
          <Text style={{ fontSize: 14, fontWeight: "800", color: "#ffffff" }}>{formatCurrency(takeHome)}</Text>
        </View>

        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#0ea5e9" }} />
            <Text style={{ fontSize: 13, fontWeight: "600", color: "#a1a1aa" }}>Est. Taxes</Text>
          </View>
          <Text style={{ fontSize: 14, fontWeight: "800", color: "#ffffff" }}>{formatCurrency(taxWithholding)}</Text>
        </View>

        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#06b6d4" }} />
            <Text style={{ fontSize: 13, fontWeight: "600", color: "#a1a1aa" }}>Expenses</Text>
          </View>
          <Text style={{ fontSize: 14, fontWeight: "800", color: "#ffffff" }}>{formatCurrency(expenseClaim)}</Text>
        </View>
      </View>
    </View>
  );
}
