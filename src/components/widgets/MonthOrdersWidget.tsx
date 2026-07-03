import React from "react";
import { View } from "react-native";
import { Package } from "lucide-react-native";
import { Text } from "../ui/text";

interface MonthOrdersWidgetProps {
  count: number;
}

function tierFor(n: number): { label: string; color: string } {
  if (n >= 250) return { label: "Elite", color: "#f43f5e" };
  if (n >= 150) return { label: "Pro", color: "#f59e0b" };
  if (n >= 50) return { label: "Active", color: "#22c55e" };
  return { label: "This Month", color: "#65656E" };
}

export default function MonthOrdersWidget({ count }: MonthOrdersWidgetProps) {
  const tier = tierFor(count);
  const month = new Date().toLocaleString("default", { month: "short" });
  const daily = count > 0 ? (count / new Date().getDate()).toFixed(1) : null;

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ backgroundColor: tier.color + "20", padding: 8, borderRadius: 10 }}>
          <Package size={18} color={tier.color} strokeWidth={2.5} />
        </View>
        <View style={{ backgroundColor: tier.color + "20", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
          <Text style={{ fontSize: 10, fontWeight: "800", color: tier.color, textTransform: "uppercase", letterSpacing: 0.5 }}>{month} · {tier.label}</Text>
        </View>
      </View>
      <View>
        <Text style={{ fontSize: 32, fontWeight: "900", color: "#F6F6F7", letterSpacing: -1 }} numberOfLines={1} adjustsFontSizeToFit>{count}</Text>
        <Text style={{ fontSize: 11, fontWeight: "700", color: "#9B9BA4", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 4 }}>
          {daily ? `≈ ${daily} / day avg` : "This Month's Deliveries"}
        </Text>
      </View>
    </View>
  );
}
