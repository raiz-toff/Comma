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

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: country === "CA" ? "CAD" : "USD",
      minimumFractionDigits: 2,
    }).format(val);
  };

  return (
    <View className="gap-1.5">
      <View className="flex-row justify-between items-center">
        <Text className="text-[10px] text-slate-400">Net Take-Home</Text>
        <Text className="text-[10px] font-bold text-emerald-400">{formatCurrency(netIncome)}</Text>
      </View>
      <View className="flex-row justify-between items-center">
        <Text className="text-[10px] text-slate-400">Expenses Claims</Text>
        <Text className="text-[10px] font-bold text-rose-400">{formatCurrency(expenseClaim)}</Text>
      </View>
      <View className="flex-row justify-between items-center">
        <Text className="text-[10px] text-slate-400">Estimated Taxes</Text>
        <Text className="text-[10px] font-bold text-amber-500">{formatCurrency(taxWithholding)}</Text>
      </View>
    </View>
  );
}
