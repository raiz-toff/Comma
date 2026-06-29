import React from "react";
import { View } from "react-native";
import { Flame } from "lucide-react-native";
import { Text } from "../ui/text";

interface StreakWidgetProps {
  streak: { current: number; best: number };
}

export default function StreakWidget({ streak }: StreakWidgetProps) {
  return (
    <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 16, gap: 12 }}>
      <View style={{ backgroundColor: "#f59e0b20", padding: 12, borderRadius: 16 }}>
        <Flame size={32} color="#f59e0b" strokeWidth={2.5} />
      </View>

      <View style={{ alignItems: "center" }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4 }}>
          <Text style={{ fontSize: 36, fontWeight: "900", color: "#F6F6F7", letterSpacing: -1 }}>{streak.current}</Text>
          <Text style={{ fontSize: 16, fontWeight: "800", color: "#9B9BA4" }}>Days</Text>
        </View>
        <Text style={{ fontSize: 11, fontWeight: "700", color: "#9B9BA4", textTransform: "uppercase", letterSpacing: 1, marginTop: 2 }}>Active Streak</Text>
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, backgroundColor: "#1C1C21", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}>
        <Text style={{ fontSize: 11, fontWeight: "600", color: "#9B9BA4" }}>All-time Best:</Text>
        <Text style={{ fontSize: 12, fontWeight: "800", color: "#f59e0b" }}>{streak.best} days</Text>
      </View>
    </View>
  );
}
