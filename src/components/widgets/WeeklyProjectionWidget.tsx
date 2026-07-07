import React from "react";
import { View } from "react-native";
import { TrendingUp } from "lucide-react-native";
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
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 16, gap: 12 }}>
      <View style={{ backgroundColor: "#818cf820", padding: 12, borderRadius: 16 }}>
        <TrendingUp size={32} color="#818cf8" strokeWidth={2.5} />
      </View>
      
      <View style={{ alignItems: "center" }}>
        <Text style={{ fontSize: 32, fontWeight: "900", color: "#F6F6F7", letterSpacing: -1, lineHeight: 38, paddingVertical: 2, includeFontPadding: false }} numberOfLines={1} adjustsFontSizeToFit>{formatCurrency(projection)}</Text>
        <Text style={{ fontSize: 11, fontWeight: "700", color: "#9B9BA4", textTransform: "uppercase", letterSpacing: 1, marginTop: 4 }}>Weekly Projection</Text>
      </View>
      
      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", alignItems: "center", marginTop: 8 }}>
        <Text style={{ fontSize: 13, fontWeight: "500", color: "#9B9BA4" }}>Based on your current daily average of </Text>
        <Text style={{ fontSize: 13, color: "#F6F6F7", fontWeight: "700" }}>{formatCurrency(dayAvg)}</Text>
      </View>
    </View>
  );
}
