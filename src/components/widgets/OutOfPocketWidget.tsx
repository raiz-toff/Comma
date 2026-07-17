import React from "react";
import { View } from "react-native";
import { CreditCard } from "lucide-react-native";
import { Text } from "../ui/text";
import { IconBadge } from "../ui/IconBadge";
import { RatioBar } from "../ui/RatioBar";
import { TIERS, withAlpha } from "@/src/theme/colors";
import { useColors, type Palette } from "@/src/theme/useColors";

interface OutOfPocketWidgetProps {
  outOfPocket: number;
  gross: number;
  country?: string;
}

function tierFor(pct: number | null, C: Palette): { label: string; color: string } {
  if (pct === null) return { label: "No Data", color: TIERS.base };
  if (pct <= 10) return { label: "Elite", color: TIERS.elite };
  if (pct <= 20) return { label: "Pro", color: TIERS.pro };
  if (pct <= 30) return { label: "Active", color: TIERS.active };
  return { label: "High", color: C.destructive };
}

export default function OutOfPocketWidget({ outOfPocket, gross, country }: OutOfPocketWidgetProps) {
  const C = useColors();
  const pct = gross > 0 ? (outOfPocket / gross) * 100 : null;
  const safePct = pct !== null ? Math.min(100, Math.max(0, pct)) : 0;
  const tier = tierFor(pct, C);

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
        <IconBadge icon={CreditCard} color={tier.color} tone="tinted" size="sm" iconSize={18} strokeWidth={2.5} />
        <View style={{ backgroundColor: withAlpha(tier.color, 0.12), paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
          <Text variant="labelXs" tabular style={{ color: tier.color }}>
            {pct !== null ? `${pct.toFixed(1)}% of Gross` : tier.label}
          </Text>
        </View>
      </View>

      <View>
        <Text variant="headingXl" tabular numberOfLines={1} adjustsFontSizeToFit>
          {outOfPocket > 0 ? "−" : ""}{formatCurrency(outOfPocket)}
        </Text>
        <Text variant="labelXs" className="text-content-secondary" style={{ marginTop: 4 }}>
          Real Out-of-Pocket Costs
        </Text>
      </View>

      <RatioBar
        mode="percent"
        height={4}
        accessibilityLabel={pct !== null ? `Out-of-pocket costs are ${pct.toFixed(1)}% of gross earnings` : "Out-of-pocket costs: no data"}
        segments={[{ value: safePct, color: tier.color }]}
      />
    </View>
  );
}
