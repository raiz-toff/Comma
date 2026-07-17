import React from "react";
import { View } from "react-native";
import { Package } from "lucide-react-native";
import { Text } from "../ui/text";
import { IconBadge } from "../ui/IconBadge";
import { useColors } from "@/src/theme/useColors";

interface DeliveriesWidgetProps {
  count: number;
}

export default function DeliveriesWidget({ count }: DeliveriesWidgetProps) {
  const C = useColors();
  return (
    <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 16, gap: 12 }}>
      <IconBadge icon={Package} color={C.info} tone="tinted" size="lg" strokeWidth={2.5} />
      <View style={{ alignItems: "center" }}>
        <Text variant="headingXl" tabular numberOfLines={1} adjustsFontSizeToFit>{count}</Text>
        <Text variant="labelXs" className="text-content-secondary" style={{ marginTop: 4 }}>Completed Orders</Text>
      </View>
    </View>
  );
}
