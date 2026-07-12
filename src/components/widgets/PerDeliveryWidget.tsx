import React from "react";
import { View } from "react-native";
import { Truck } from "lucide-react-native";
import { Text } from "../ui/text";
import { KPI, withAlpha } from "@/src/theme/colors";

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
      <View style={{ backgroundColor: withAlpha(KPI.gross, 0.12), padding: 12, borderRadius: 16 }}>
        <Truck size={32} color={KPI.gross} strokeWidth={2.5} />
      </View>
      <View style={{ alignItems: "center" }}>
        <Text variant="headingXl" tabular numberOfLines={1} adjustsFontSizeToFit>{formatCurrency(perDelivery)}</Text>
        <Text variant="labelXs" className="text-content-secondary" tabular style={{ marginTop: 4 }}>
          {count > 0 ? `Across ${count} Deliveries` : "Avg Per Delivery"}
        </Text>
      </View>
    </View>
  );
}
