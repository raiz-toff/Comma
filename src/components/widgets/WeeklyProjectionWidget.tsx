import React from "react";
import { View } from "react-native";
import { TrendingUp } from "lucide-react-native";
import { Text } from "../ui/text";
import { IconBadge } from "../ui/IconBadge";
import { KPI } from "@/src/theme/colors";
import { useColors } from "@/src/theme/useColors";

interface DailyData {
  date: string;
  total: number;
}

interface WeeklyProjectionWidgetProps {
  dailyData: DailyData[];
  country: string;
}

export default function WeeklyProjectionWidget({ dailyData, country }: WeeklyProjectionWidgetProps) {
  const C = useColors();
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
      <IconBadge icon={TrendingUp} color={KPI.net} tone="tinted" size="lg" strokeWidth={2.5} />

      <View style={{ alignItems: "center" }}>
        <Text variant="headingXl" tabular style={{ color: C.contentPrimary, includeFontPadding: false }} numberOfLines={1} adjustsFontSizeToFit>{formatCurrency(projection)}</Text>
        <Text variant="labelXs" style={{ color: C.contentSecondary, marginTop: 4 }}>Weekly Projection</Text>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", alignItems: "center", marginTop: 8 }}>
        <Text variant="paragraphM" style={{ color: C.contentSecondary }}>Based on your current daily average of </Text>
        <Text variant="labelM" tabular style={{ color: C.contentPrimary }}>{formatCurrency(dayAvg)}</Text>
      </View>
    </View>
  );
}
