import React from "react";
import { View } from "react-native";
import { Clock } from "lucide-react-native";
import { Text } from "../ui/text";

interface MonthHourlyWidgetProps {
  hourlyRate: number;
  country?: string;
}

function tierFor(val: number): { label: string; color: string } {
  if (val >= 35) return { label: "Elite", color: "#f43f5e" };
  if (val >= 25) return { label: "Pro", color: "#f59e0b" };
  if (val >= 18) return { label: "Active", color: "#22c55e" };
  return { label: "This Month", color: "#65656E" };
}

export default function MonthHourlyWidget({ hourlyRate, country }: MonthHourlyWidgetProps) {
  const tier = tierFor(hourlyRate);
  const month = new Date().toLocaleString("default", { month: "short" });

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: country === "CA" ? "CAD" : "USD",
      minimumFractionDigits: 2,
    }).format(val);
  };

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ backgroundColor: tier.color + "20", padding: 8, borderRadius: 10 }}>
          <Clock size={18} color={tier.color} strokeWidth={2.5} />
        </View>
        <View style={{ backgroundColor: tier.color + "20", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
          <Text style={{ fontSize: 10, fontWeight: "800", color: tier.color, textTransform: "uppercase", letterSpacing: 0.5 }}>{month} · {tier.label}</Text>
        </View>
      </View>
      <View>
        <Text style={{ fontSize: 32, fontWeight: "900", color: "#F6F6F7", letterSpacing: -1 }} numberOfLines={1} adjustsFontSizeToFit>{formatCurrency(hourlyRate)}<Text style={{ fontSize: 16, color: "#9B9BA4" }}>/hr</Text></Text>
        <Text style={{ fontSize: 11, fontWeight: "700", color: "#9B9BA4", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 4 }}>Hourly Rate Avg</Text>
      </View>
    </View>
  );
}
