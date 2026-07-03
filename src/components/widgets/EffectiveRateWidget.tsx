import React from "react";
import { View } from "react-native";
import { Zap } from "lucide-react-native";
import { Text } from "../ui/text";

interface EffectiveRateWidgetProps {
  effectiveRate: number;
  avgRate: number;
  country?: string;
}

export default function EffectiveRateWidget({ effectiveRate, avgRate, country }: EffectiveRateWidgetProps) {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: country === "CA" ? "CAD" : "USD",
      minimumFractionDigits: 2,
    }).format(val);
  };

  const delta = avgRate > 0 ? effectiveRate - avgRate : null;
  const subText = delta !== null
    ? `${delta >= 0 ? "+" : ""}${formatCurrency(delta)} vs gross rate`
    : "after expenses";
  const color = delta !== null && delta < 0 ? "#FF5247" : "#22c55e";

  return (
    <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 16, gap: 12 }}>
      <View style={{ backgroundColor: "#f59e0b20", padding: 12, borderRadius: 16 }}>
        <Zap size={32} color="#f59e0b" strokeWidth={2.5} />
      </View>
      <View style={{ alignItems: "center" }}>
        <Text style={{ fontSize: 32, fontWeight: "900", color: "#F6F6F7", letterSpacing: -1 }} numberOfLines={1} adjustsFontSizeToFit>{formatCurrency(effectiveRate)}<Text style={{ fontSize: 16, color: "#9B9BA4" }}>/hr</Text></Text>
        <Text style={{ fontSize: 11, fontWeight: "700", color, textTransform: "uppercase", letterSpacing: 1, marginTop: 4 }}>{subText}</Text>
      </View>
    </View>
  );
}
