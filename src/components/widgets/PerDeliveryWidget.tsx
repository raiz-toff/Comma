import React from "react";
import { View } from "react-native";
import { Truck } from "lucide-react-native";
import { Text } from "../ui/text";

interface PerDeliveryWidgetProps {
  perDelivery: number;
  count: number;
  country?: string;
}

export default function PerDeliveryWidget({ perDelivery, count, country }: PerDeliveryWidgetProps) {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: country === "CA" ? "CAD" : "USD",
      minimumFractionDigits: 2,
    }).format(val);
  };

  return (
    <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 16, gap: 12 }}>
      <View style={{ backgroundColor: "#0ea5e920", padding: 12, borderRadius: 16 }}>
        <Truck size={32} color="#0ea5e9" strokeWidth={2.5} />
      </View>
      <View style={{ alignItems: "center" }}>
        <Text style={{ fontSize: 32, fontWeight: "900", color: "#F6F6F7", letterSpacing: -1 }} numberOfLines={1} adjustsFontSizeToFit>{formatCurrency(perDelivery)}</Text>
        <Text style={{ fontSize: 11, fontWeight: "700", color: "#9B9BA4", textTransform: "uppercase", letterSpacing: 1, marginTop: 4 }}>
          {count > 0 ? `Across ${count} Deliveries` : "Avg Per Delivery"}
        </Text>
      </View>
    </View>
  );
}
