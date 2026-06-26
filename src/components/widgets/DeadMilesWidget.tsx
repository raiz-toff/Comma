import React from "react";
import { View } from "react-native";
import { Text } from "../ui/text";

interface DeadMilesWidgetProps {
  mileage: { active: number; dead: number; ratio: number } | undefined;
}

export default function DeadMilesWidget({ mileage }: DeadMilesWidgetProps) {
  const activeVal = mileage?.active || 0;
  const deadVal = mileage?.dead || 0;
  const ratioVal = mileage?.ratio || 0;

  return (
    <View style={{ gap: 16, paddingTop: 4 }}>
      <View style={{ height: 12, flexDirection: "row", borderRadius: 6, overflow: "hidden", backgroundColor: "#262522" }}>
        <View style={{ flex: Math.max(0.01, activeVal), backgroundColor: "#22c55e" }} />
        <View style={{ flex: Math.max(0.01, deadVal), backgroundColor: "#f43f5e" }} />
      </View>

      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#22c55e" }} />
            <Text style={{ fontSize: 13, fontWeight: "600", color: "#a1a1aa" }}>Active Miles</Text>
          </View>
          <Text style={{ fontSize: 14, fontWeight: "800", color: "#ffffff" }}>{activeVal.toFixed(1)} <Text style={{ fontSize: 10, color: "#71717a" }}>mi</Text></Text>
        </View>

        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#f43f5e" }} />
            <Text style={{ fontSize: 13, fontWeight: "600", color: "#a1a1aa" }}>Dead Miles</Text>
          </View>
          <Text style={{ fontSize: 14, fontWeight: "800", color: "#ffffff" }}>{deadVal.toFixed(1)} <Text style={{ fontSize: 10, color: "#71717a" }}>mi</Text></Text>
        </View>

        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#262522" }}>
          <Text style={{ fontSize: 11, fontWeight: "700", color: "#52525b", textTransform: "uppercase", letterSpacing: 0.5 }}>Dead Ratio</Text>
          <Text style={{ fontSize: 14, fontWeight: "900", color: ratioVal > 40 ? "#f43f5e" : "#22c55e" }}>{ratioVal.toFixed(1)}%</Text>
        </View>
      </View>
    </View>
  );
}
