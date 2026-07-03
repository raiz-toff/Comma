import React from "react";
import { View } from "react-native";
import { Package } from "lucide-react-native";
import { Text } from "../ui/text";

interface DeliveriesWidgetProps {
  count: number;
}

export default function DeliveriesWidget({ count }: DeliveriesWidgetProps) {
  return (
    <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 16, gap: 12 }}>
      <View style={{ backgroundColor: "#3b82f620", padding: 12, borderRadius: 16 }}>
        <Package size={32} color="#3b82f6" strokeWidth={2.5} />
      </View>
      <View style={{ alignItems: "center" }}>
        <Text style={{ fontSize: 36, fontWeight: "900", color: "#F6F6F7", letterSpacing: -1 }} numberOfLines={1} adjustsFontSizeToFit>{count}</Text>
        <Text style={{ fontSize: 11, fontWeight: "700", color: "#9B9BA4", textTransform: "uppercase", letterSpacing: 1, marginTop: 4 }}>Completed Orders</Text>
      </View>
    </View>
  );
}
