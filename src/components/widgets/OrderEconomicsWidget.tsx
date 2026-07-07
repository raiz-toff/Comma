import React from "react";
import { View } from "react-native";
import { Text } from "../ui/text";

const TEXT_MUTED = "#9B9BA4";

interface OrderEconomicsWidgetProps {
  count: number;
  perDelivery: number;
  tips: number;
  country?: string;
}

function formatCurrency(val: number, country?: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: country === "CA" ? "CAD" : "USD",
    minimumFractionDigits: 2,
  }).format(val);
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center", gap: 4 }}>
      <Text style={{ fontSize: 9, fontWeight: "800", color: TEXT_MUTED, textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</Text>
      <Text style={{ fontSize: 16, fontWeight: "900", color: "#F6F6F7", letterSpacing: -0.3 }} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </View>
  );
}

/** Merges deliveries + perDelivery + tipsTotal — three numbers about the same delivery count. */
export default function OrderEconomicsWidget({ count, perDelivery, tips, country }: OrderEconomicsWidgetProps) {
  return (
    <View style={{ flexDirection: "row", paddingVertical: 4 }}>
      <Cell label="Deliveries" value={String(count)} />
      <Cell label="Per Delivery" value={formatCurrency(perDelivery, country)} />
      <Cell label="Tips" value={formatCurrency(tips, country)} />
    </View>
  );
}
