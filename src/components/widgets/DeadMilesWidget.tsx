import React from "react";
import { View } from "react-native";
import { Text } from "../ui/text";
import { useColors } from "@/src/theme/useColors";

interface DeadMilesWidgetProps {
  mileage: { active: number; dead: number; ratio: number } | undefined;
  distanceUnit?: string;
}

export default function DeadMilesWidget({ mileage, distanceUnit = "mi" }: DeadMilesWidgetProps) {
  const C = useColors();
  const activeVal = mileage?.active || 0;
  const deadVal = mileage?.dead || 0;
  const ratioVal = mileage?.ratio || 0;

  return (
    <View style={{ gap: 16, paddingTop: 4 }}>
      <View
        accessible={true}
        accessibilityLabel={`Active ${activeVal.toFixed(1)} ${distanceUnit}, dead ${deadVal.toFixed(1)} ${distanceUnit}, dead ratio ${ratioVal.toFixed(1)}%`}
        style={{ height: 12, flexDirection: "row", borderRadius: 8, overflow: "hidden", backgroundColor: C.surface04 }}
      >
        <View style={{ flex: Math.max(0.01, activeVal), backgroundColor: C.success }} />
        <View style={{ flex: Math.max(0.01, deadVal), backgroundColor: C.destructive }} />
      </View>

      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.success }} />
            <Text variant="labelM" className="text-content-secondary">Active {distanceUnit}</Text>
          </View>
          <Text variant="labelM" tabular>{activeVal.toFixed(1)} <Text variant="paragraphS" className="text-content-secondary">{distanceUnit}</Text></Text>
        </View>

        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.destructive }} />
            <Text variant="labelM" className="text-content-secondary">Dead {distanceUnit}</Text>
          </View>
          <Text variant="labelM" tabular>{deadVal.toFixed(1)} <Text variant="paragraphS" className="text-content-secondary">{distanceUnit}</Text></Text>
        </View>

        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.lineSubtle }}>
          <Text variant="labelXs" className="text-content-muted">Dead Ratio</Text>
          <Text variant="labelM" tabular style={{ color: ratioVal > 40 ? C.destructive : C.success }}>{ratioVal.toFixed(1)}%</Text>
        </View>
      </View>
    </View>
  );
}
