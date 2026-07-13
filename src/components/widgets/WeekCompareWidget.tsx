import React from "react";
import { View } from "react-native";
import { TrendingUp, TrendingDown, Minus } from "lucide-react-native";
import { Text } from "../ui/text";
import { withAlpha } from "@/src/theme/colors";
import { useColors } from "@/src/theme/useColors";

interface WeekCompareWidgetProps {
  thisWeek: number;
  lastWeek: number;
  country?: string;
}

export default function WeekCompareWidget({ thisWeek, lastWeek, country }: WeekCompareWidgetProps) {
  const C = useColors();
  const delta = thisWeek - lastWeek;
  const isUp = delta >= 0;
  const color = delta === 0 ? C.contentSecondary : isUp ? C.success : C.destructive;
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
      <View style={{ backgroundColor: withAlpha(color, 0.12), padding: 12, borderRadius: 16 }}>
        <Icon size={32} color={color} strokeWidth={2.5} />
      </View>

      <View style={{ alignItems: "center" }}>
        <Text variant="headingXl" tabular style={{ color, includeFontPadding: false }} numberOfLines={1} adjustsFontSizeToFit>
          {delta > 0 ? "+" : ""}{formatCurrency(delta)}
        </Text>
        <Text variant="labelXs" style={{ color: C.contentSecondary, marginTop: 4 }}>
          vs Last Week
        </Text>
      </View>

      <View style={{ flexDirection: "row", gap: 16, marginTop: 4 }}>
        <View style={{ alignItems: "center" }}>
          <Text variant="labelM" tabular style={{ color: C.contentPrimary }}>{formatCurrency(thisWeek)}</Text>
          <Text variant="labelXs" style={{ color: C.contentMuted }}>This Week</Text>
        </View>
        <View style={{ alignItems: "center" }}>
          <Text variant="labelM" tabular style={{ color: C.contentPrimary }}>{formatCurrency(lastWeek)}</Text>
          <Text variant="labelXs" style={{ color: C.contentMuted }}>Last Week</Text>
        </View>
      </View>
    </View>
  );
}
