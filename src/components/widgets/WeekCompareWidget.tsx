import React from "react";
import { View } from "react-native";
import { TrendingUp, TrendingDown, Minus } from "lucide-react-native";
import { Text } from "../ui/text";

interface WeekCompareWidgetProps {
  thisWeek: number;
  lastWeek: number;
  country?: string;
}

export default function WeekCompareWidget({ thisWeek, lastWeek, country }: WeekCompareWidgetProps) {
  const delta = thisWeek - lastWeek;
  const isUp = delta >= 0;
  const color = delta === 0 ? "#9B9BA4" : isUp ? "#22c55e" : "#FF5247";
  const Icon = delta === 0 ? Minus : isUp ? TrendingUp : TrendingDown;

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
      <View style={{ backgroundColor: color + "20", padding: 12, borderRadius: 16 }}>
        <Icon size={32} color={color} strokeWidth={2.5} />
      </View>

      <View style={{ alignItems: "center" }}>
        <Text style={{ fontSize: 32, fontWeight: "900", color, letterSpacing: -1 }} numberOfLines={1} adjustsFontSizeToFit>
          {delta > 0 ? "+" : ""}{formatCurrency(delta)}
        </Text>
        <Text style={{ fontSize: 11, fontWeight: "700", color: "#9B9BA4", textTransform: "uppercase", letterSpacing: 1, marginTop: 4 }}>
          vs Last Week
        </Text>
      </View>

      <View style={{ flexDirection: "row", gap: 16, marginTop: 4 }}>
        <View style={{ alignItems: "center" }}>
          <Text style={{ fontSize: 13, fontWeight: "800", color: "#F6F6F7" }}>{formatCurrency(thisWeek)}</Text>
          <Text style={{ fontSize: 10, fontWeight: "600", color: "#65656E", textTransform: "uppercase" }}>This Week</Text>
        </View>
        <View style={{ alignItems: "center" }}>
          <Text style={{ fontSize: 13, fontWeight: "800", color: "#F6F6F7" }}>{formatCurrency(lastWeek)}</Text>
          <Text style={{ fontSize: 10, fontWeight: "600", color: "#65656E", textTransform: "uppercase" }}>Last Week</Text>
        </View>
      </View>
    </View>
  );
}
