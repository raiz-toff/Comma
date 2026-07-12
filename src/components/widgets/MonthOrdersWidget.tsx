import React from "react";
import { View } from "react-native";
import { Package } from "lucide-react-native";
import { Text } from "../ui/text";
import { TIERS, withAlpha } from "@/src/theme/colors";

interface MonthOrdersWidgetProps {
  count: number;
}

function tierFor(n: number): { label: string; color: string } {
  if (n >= 250) return { label: "Elite", color: TIERS.elite };
  if (n >= 150) return { label: "Pro", color: TIERS.pro };
  if (n >= 50) return { label: "Active", color: TIERS.active };
  return { label: "This Month", color: TIERS.base };
}

export default function MonthOrdersWidget({ count }: MonthOrdersWidgetProps) {
  const tier = tierFor(count);
  const month = new Date().toLocaleString("default", { month: "short" });
  const daily = count > 0 ? (count / new Date().getDate()).toFixed(1) : null;

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ backgroundColor: withAlpha(tier.color, 0.12), padding: 8, borderRadius: 12 }}>
          <Package size={18} color={tier.color} strokeWidth={2.5} />
        </View>
        <View style={{ backgroundColor: withAlpha(tier.color, 0.12), paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
          <Text variant="labelXs" style={{ color: tier.color }}>{month} · {tier.label}</Text>
        </View>
      </View>
      <View>
        <Text variant="headingXl" tabular numberOfLines={1} adjustsFontSizeToFit>{count}</Text>
        <Text variant="labelXs" className="text-content-secondary" tabular style={{ marginTop: 4 }}>
          {daily ? `≈ ${daily} / day avg` : "This Month's Deliveries"}
        </Text>
      </View>
    </View>
  );
}
