import React from "react";
import { View } from "react-native";
import { Sparkles } from "lucide-react-native";
import { Text } from "../ui/text";
import { withAlpha } from "@/src/theme/colors";
import { useColors } from "@/src/theme/useColors";

interface TipsTotalWidgetProps {
  tips: number;
  gross: number;
  country?: string;
}

export default function TipsTotalWidget({ tips, gross, country }: TipsTotalWidgetProps) {
  const C = useColors();
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
      <View style={{ backgroundColor: withAlpha(C.info, 0.12), padding: 12, borderRadius: 16 }}>
        <Sparkles size={32} color={C.info} strokeWidth={2.5} />
      </View>
      <View style={{ alignItems: "center" }}>
        <Text variant="headingXl" tabular style={{ color: C.contentPrimary }} numberOfLines={1} adjustsFontSizeToFit>{formatCurrency(tips)}</Text>
        {tipsPct > 0 ? (
          <Text variant="labelXs" tabular style={{ color: C.contentSecondary, marginTop: 4 }}>
            {`${tipsPct.toFixed(1)}% of total earnings`}
          </Text>
        ) : (
          <Text variant="paragraphS" style={{ marginTop: 4 }}>Awaiting tips</Text>
        )}
      </View>
    </View>
  );
}
