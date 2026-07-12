import React from "react";
import { View } from "react-native";
import { Clock } from "lucide-react-native";
import { Text } from "../ui/text";
import { TIERS, withAlpha } from "@/src/theme/colors";

interface MonthHourlyWidgetProps {
  hourlyRate: number;
  country?: string;
}

function tierFor(val: number): { label: string; color: string } {
  if (val >= 35) return { label: "Elite", color: TIERS.elite };
  if (val >= 25) return { label: "Pro", color: TIERS.pro };
  if (val >= 18) return { label: "Active", color: TIERS.active };
  return { label: "This Month", color: TIERS.base };
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
        <View style={{ backgroundColor: withAlpha(tier.color, 0.12), padding: 8, borderRadius: 12 }}>
          <Clock size={18} color={tier.color} strokeWidth={2.5} />
        </View>
        <View style={{ backgroundColor: withAlpha(tier.color, 0.12), paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
          <Text variant="labelXs" style={{ color: tier.color }}>{month} · {tier.label}</Text>
        </View>
      </View>
      <View>
        <Text variant="headingXl" tabular numberOfLines={1} adjustsFontSizeToFit>{formatCurrency(hourlyRate)}<Text variant="paragraphL">/hr</Text></Text>
        <Text variant="labelXs" className="text-content-secondary" style={{ marginTop: 4 }}>Hourly Rate Avg</Text>
      </View>
    </View>
  );
}
