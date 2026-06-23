import React from "react";
import { View } from "react-native";
import { Text } from "../ui/text";

interface DailyData {
  date: string;
  total: number;
}

interface WeeklyProjectionWidgetProps {
  dailyData: DailyData[];
  country: string;
}

export default function WeeklyProjectionWidget({ dailyData, country }: WeeklyProjectionWidgetProps) {
  const dayAvg = dailyData.length > 0 ? dailyData.reduce((sum, d) => sum + d.total, 0) / dailyData.length : 0;
  const projection = dayAvg * 7;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: country === "CA" ? "CAD" : "USD",
      minimumFractionDigits: 2,
    }).format(val);
  };

  return (
    <View className="items-center py-2 gap-1">
      <Text className="text-xl font-black text-indigo-400">{formatCurrency(projection)}</Text>
      <Text className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Weekly Projection</Text>
    </View>
  );
}
