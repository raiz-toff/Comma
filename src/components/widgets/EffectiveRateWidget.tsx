import React from "react";
import { View } from "react-native";
import { Zap } from "lucide-react-native";
import { Text } from "../ui/text";
import { COLORS, KPI, withAlpha } from "@/src/theme/colors";

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
  const color = delta !== null && delta < 0 ? COLORS.destructive : COLORS.success;

  return (
    <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 16, gap: 12 }}>
      <View style={{ backgroundColor: withAlpha(KPI.rate, 0.12), padding: 12, borderRadius: 16 }}>
        <Zap size={32} color={KPI.rate} strokeWidth={2.5} />
      </View>
      <View style={{ alignItems: "center" }}>
        <Text variant="headingXl" tabular numberOfLines={1} adjustsFontSizeToFit>{formatCurrency(effectiveRate)}<Text variant="paragraphL">/hr</Text></Text>
        <Text variant="labelXs" tabular style={{ color, marginTop: 4 }}>{subText}</Text>
      </View>
    </View>
  );
}
