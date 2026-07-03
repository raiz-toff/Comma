import React from "react";
import { View } from "react-native";
import { XCircle } from "lucide-react-native";
import { Text } from "../ui/text";

interface ZeroDaysWidgetProps {
  zeroDays: number;
  totalDays: number;
}

export default function ZeroDaysWidget({ zeroDays, totalDays }: ZeroDaysWidgetProps) {
  const badge = zeroDays === 0 ? { label: "Perfect", color: "#22c55e" } : zeroDays <= 3 ? { label: "Good", color: "#f59e0b" } : { label: "Review", color: "#FF5247" };

  return (
    <View style={{ gap: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ backgroundColor: badge.color + "20", padding: 8, borderRadius: 10 }}>
            <XCircle size={16} color={badge.color} strokeWidth={2.5} />
          </View>
          <Text style={{ fontSize: 13, fontWeight: "600", color: "#9B9BA4" }}>Zero-Earning Days</Text>
        </View>
        <View style={{ backgroundColor: badge.color + "20", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
          <Text style={{ fontSize: 10, fontWeight: "800", color: badge.color, textTransform: "uppercase", letterSpacing: 0.5 }}>{badge.label}</Text>
        </View>
      </View>

      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
        <Text style={{ fontSize: 32, fontWeight: "900", color: "#F6F6F7", letterSpacing: -1 }}>{zeroDays}</Text>
        <Text style={{ fontSize: 13, fontWeight: "600", color: "#9B9BA4" }}>of {totalDays} days</Text>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5 }}>
        {Array.from({ length: totalDays }, (_, i) => (
          <View
            key={i}
            style={{
              width: 10,
              height: 10,
              borderRadius: 3,
              backgroundColor: i < zeroDays ? "#FF5247" : "#22c55e40",
            }}
          />
        ))}
      </View>
    </View>
  );
}
