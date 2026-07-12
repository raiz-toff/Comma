import React from "react";
import { View } from "react-native";
import { Flame } from "lucide-react-native";
import { Text } from "../ui/text";
import { COLORS, KPI, withAlpha } from "@/src/theme/colors";

interface StreakWidgetProps {
  streak: { current: number; best: number };
}

export default function StreakWidget({ streak }: StreakWidgetProps) {
  return (
    <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 16, gap: 12 }}>
      <View style={{ backgroundColor: withAlpha(KPI.rate, 0.12), padding: 12, borderRadius: 16 }}>
        <Flame size={32} color={KPI.rate} strokeWidth={2.5} />
      </View>

      <View style={{ alignItems: "center" }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4 }}>
          <Text variant="headingXl" tabular style={{ color: COLORS.contentPrimary }}>{streak.current}</Text>
          <Text variant="headingS" style={{ color: COLORS.contentSecondary }}>Days</Text>
        </View>
        <Text variant="labelXs" style={{ color: COLORS.contentSecondary, marginTop: 2 }}>Active Streak</Text>
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, backgroundColor: COLORS.surface04, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}>
        <Text variant="labelXs" style={{ color: COLORS.contentSecondary }}>All-time Best:</Text>
        <Text variant="labelM" tabular style={{ color: KPI.rate }}>{streak.best} days</Text>
      </View>
    </View>
  );
}
