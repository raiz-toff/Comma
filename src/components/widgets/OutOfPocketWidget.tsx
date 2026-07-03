import React from "react";
import { View } from "react-native";
import { CreditCard } from "lucide-react-native";
import { Text } from "../ui/text";

interface OutOfPocketWidgetProps {
  outOfPocket: number;
  gross: number;
  country?: string;
}

function tierFor(pct: number | null): { label: string; color: string } {
  if (pct === null) return { label: "No Data", color: "#65656E" };
  if (pct <= 10) return { label: "Elite", color: "#22c55e" };
  if (pct <= 20) return { label: "Pro", color: "#3b82f6" };
  if (pct <= 30) return { label: "Active", color: "#f59e0b" };
  return { label: "High", color: "#FF5247" };
}

export default function OutOfPocketWidget({ outOfPocket, gross, country }: OutOfPocketWidgetProps) {
  const pct = gross > 0 ? (outOfPocket / gross) * 100 : null;
  const safePct = pct !== null ? Math.min(100, Math.max(0, pct)) : 0;
  const tier = tierFor(pct);

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
        <View style={{ backgroundColor: tier.color + "20", padding: 8, borderRadius: 10 }}>
          <CreditCard size={18} color={tier.color} strokeWidth={2.5} />
        </View>
        <View style={{ backgroundColor: tier.color + "20", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
          <Text style={{ fontSize: 10, fontWeight: "800", color: tier.color, textTransform: "uppercase", letterSpacing: 0.5 }}>
            {pct !== null ? `${pct.toFixed(1)}% of Gross` : tier.label}
          </Text>
        </View>
      </View>

      <View>
        <Text style={{ fontSize: 32, fontWeight: "900", color: "#F6F6F7", letterSpacing: -1 }} numberOfLines={1} adjustsFontSizeToFit>
          {outOfPocket > 0 ? "−" : ""}{formatCurrency(outOfPocket)}
        </Text>
        <Text style={{ fontSize: 11, fontWeight: "700", color: "#9B9BA4", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 4 }}>
          Real Out-of-Pocket Costs
        </Text>
      </View>

      <View style={{ height: 4, borderRadius: 2, backgroundColor: "#1C1C21", overflow: "hidden" }}>
        <View style={{ width: `${safePct}%`, height: "100%", backgroundColor: tier.color, borderRadius: 2 }} />
      </View>
    </View>
  );
}
