import React from "react";
import { View } from "react-native";
import { Text } from "../ui/text";
import { KPI, TIERS, withAlpha } from "@/src/theme/colors";
import { useColors } from "@/src/theme/useColors";

interface HoursCompareWidgetProps {
  activeHrs: number;
  onlineHrs: number;
}

function tierFor(ratio: number): { label: string; color: string } {
  if (ratio >= 85) return { label: "Ultra Efficient", color: TIERS.elite };
  if (ratio >= 70) return { label: "Highly Active", color: TIERS.pro };
  if (ratio >= 50) return { label: "Moderate Wait", color: TIERS.active };
  return { label: "High Wait Time", color: TIERS.base };
}

export default function HoursCompareWidget({ activeHrs, onlineHrs }: HoursCompareWidgetProps) {
  const C = useColors();
  const ratio = onlineHrs > 0 ? Math.min(100, (activeHrs / onlineHrs) * 100) : 0;
  const tier = tierFor(ratio);

  return (
    <View style={{ gap: 16, paddingTop: 4 }}>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <View style={{ flex: 1, backgroundColor: C.surface03, borderRadius: 12, padding: 12, borderLeftWidth: 4, borderLeftColor: KPI.hours }}>
          <Text variant="labelXs" className="text-content-secondary">Active Time</Text>
          <Text variant="headingL" tabular style={{ marginTop: 4 }}>{activeHrs.toFixed(1)} <Text variant="paragraphS" className="text-content-secondary">hrs</Text></Text>
        </View>
        <View style={{ flex: 1, backgroundColor: C.surface03, borderRadius: 12, padding: 12, borderLeftWidth: 4, borderLeftColor: withAlpha(KPI.hours, 0.6) }}>
          <Text variant="labelXs" className="text-content-secondary">Total Online</Text>
          <Text variant="headingL" tabular style={{ marginTop: 4 }}>{onlineHrs.toFixed(1)} <Text variant="paragraphS" className="text-content-secondary">hrs</Text></Text>
        </View>
      </View>

      <View
        accessible={true}
        accessibilityLabel={`Active time is ${ratio.toFixed(0)}% of online time, ${tier.label}`}
        style={{ height: 10, borderRadius: 8, backgroundColor: C.surface04, overflow: "hidden" }}
      >
        <View style={{ height: "100%", width: `${Math.max(2, ratio)}%`, backgroundColor: tier.color, borderRadius: 8 }} />
      </View>

      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text variant="labelXs" className="text-content-muted">Active / Online Ratio</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: withAlpha(tier.color, 0.12), paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
          <Text variant="labelM" tabular style={{ color: tier.color }}>{ratio.toFixed(0)}%</Text>
          <Text variant="labelXs" style={{ color: tier.color }}>{tier.label}</Text>
        </View>
      </View>
    </View>
  );
}
