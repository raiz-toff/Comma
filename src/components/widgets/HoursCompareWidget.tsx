import React from "react";
import { View } from "react-native";
import { Text } from "../ui/text";

interface HoursCompareWidgetProps {
  activeHrs: number;
  onlineHrs: number;
}

function tierFor(ratio: number): { label: string; color: string } {
  if (ratio >= 85) return { label: "Ultra Efficient", color: "#22c55e" };
  if (ratio >= 70) return { label: "Highly Active", color: "#3b82f6" };
  if (ratio >= 50) return { label: "Moderate Wait", color: "#f59e0b" };
  return { label: "High Wait Time", color: "#FF5247" };
}

export default function HoursCompareWidget({ activeHrs, onlineHrs }: HoursCompareWidgetProps) {
  const ratio = onlineHrs > 0 ? Math.min(100, (activeHrs / onlineHrs) * 100) : 0;
  const tier = tierFor(ratio);

  return (
    <View style={{ gap: 16, paddingTop: 4 }}>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <View style={{ flex: 1, backgroundColor: "#16161A", borderRadius: 12, padding: 12, borderLeftWidth: 3, borderLeftColor: "#3b82f6" }}>
          <Text style={{ fontSize: 10, fontWeight: "800", color: "#9B9BA4", textTransform: "uppercase", letterSpacing: 0.5 }}>Active Time</Text>
          <Text style={{ fontSize: 22, fontWeight: "900", color: "#F6F6F7", marginTop: 4 }}>{activeHrs.toFixed(1)} <Text style={{ fontSize: 12, color: "#9B9BA4" }}>hrs</Text></Text>
        </View>
        <View style={{ flex: 1, backgroundColor: "#16161A", borderRadius: 12, padding: 12, borderLeftWidth: 3, borderLeftColor: "#6366f1" }}>
          <Text style={{ fontSize: 10, fontWeight: "800", color: "#9B9BA4", textTransform: "uppercase", letterSpacing: 0.5 }}>Total Online</Text>
          <Text style={{ fontSize: 22, fontWeight: "900", color: "#F6F6F7", marginTop: 4 }}>{onlineHrs.toFixed(1)} <Text style={{ fontSize: 12, color: "#9B9BA4" }}>hrs</Text></Text>
        </View>
      </View>

      <View style={{ height: 10, borderRadius: 5, backgroundColor: "#1C1C21", overflow: "hidden" }}>
        <View style={{ height: "100%", width: `${Math.max(2, ratio)}%`, backgroundColor: tier.color, borderRadius: 5 }} />
      </View>

      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ fontSize: 11, fontWeight: "700", color: "#65656E", textTransform: "uppercase", letterSpacing: 0.5 }}>Active / Online Ratio</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: tier.color + "20", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
          <Text style={{ fontSize: 12, fontWeight: "900", color: tier.color }}>{ratio.toFixed(0)}%</Text>
          <Text style={{ fontSize: 9, fontWeight: "800", color: tier.color, textTransform: "uppercase", letterSpacing: 0.3 }}>{tier.label}</Text>
        </View>
      </View>
    </View>
  );
}
