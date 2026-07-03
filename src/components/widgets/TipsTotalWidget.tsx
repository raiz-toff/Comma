import React from "react";
import { View } from "react-native";
import { Sparkles } from "lucide-react-native";
import { Text } from "../ui/text";

interface TipsTotalWidgetProps {
  tips: number;
  gross: number;
  country?: string;
}

export default function TipsTotalWidget({ tips, gross, country }: TipsTotalWidgetProps) {
  const tipsPct = gross > 0 ? (tips / gross) * 100 : 0;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: country === "CA" ? "CAD" : "USD",
      minimumFractionDigits: 2,
    }).format(val);
  };

  return (
    <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 16, gap: 12 }}>
      <View style={{ backgroundColor: "#3b82f620", padding: 12, borderRadius: 16 }}>
        <Sparkles size={32} color="#3b82f6" strokeWidth={2.5} />
      </View>
      <View style={{ alignItems: "center" }}>
        <Text style={{ fontSize: 32, fontWeight: "900", color: "#F6F6F7", letterSpacing: -1 }} numberOfLines={1} adjustsFontSizeToFit>{formatCurrency(tips)}</Text>
        <Text style={{ fontSize: 11, fontWeight: "700", color: "#9B9BA4", textTransform: "uppercase", letterSpacing: 1, marginTop: 4 }}>
          {tipsPct > 0 ? `${tipsPct.toFixed(1)}% of total earnings` : "Awaiting tips"}
        </Text>
      </View>
    </View>
  );
}
