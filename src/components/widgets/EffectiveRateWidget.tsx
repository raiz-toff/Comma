import React from "react";
import { View } from "react-native";
import { Zap } from "lucide-react-native";
import { Text } from "../ui/text";
import { IconBadge } from "../ui/IconBadge";
import { KPI } from "@/src/theme/colors";
import { useColors } from "@/src/theme/useColors";

interface EffectiveRateWidgetProps {
  effectiveRate: number;
  avgRate: number;
  country?: string;
}

export default function EffectiveRateWidget({ effectiveRate, avgRate, country }: EffectiveRateWidgetProps) {
  const C = useColors();
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
  const color = delta !== null && delta < 0 ? C.destructive : C.success;

  return (
    <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 16, gap: 12 }}>
      <IconBadge icon={Zap} color={KPI.rate} tone="tinted" size="lg" strokeWidth={2.5} />
      <View style={{ alignItems: "center" }}>
        <Text variant="headingXl" tabular numberOfLines={1} adjustsFontSizeToFit>{formatCurrency(effectiveRate)}<Text variant="paragraphL">/hr</Text></Text>
        <Text variant="labelXs" tabular style={{ color, marginTop: 4 }}>{subText}</Text>
      </View>
    </View>
  );
}
