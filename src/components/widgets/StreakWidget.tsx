import React from "react";
import { View } from "react-native";
import { Flame } from "lucide-react-native";
import { Text } from "../ui/text";
import { IconBadge } from "../ui/IconBadge";
import { KPI } from "@/src/theme/colors";
import { useColors } from "@/src/theme/useColors";

interface StreakWidgetProps {
  streak: { current: number; best: number };
}

export default function StreakWidget({ streak }: StreakWidgetProps) {
  const C = useColors();
  return (
    <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 16, gap: 12 }}>
      <IconBadge icon={Flame} color={KPI.rate} tone="tinted" size="lg" strokeWidth={2.5} />

      <View style={{ alignItems: "center" }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4 }}>
          <Text variant="headingXl" tabular style={{ color: C.contentPrimary }}>{streak.current}</Text>
          <Text variant="headingS" style={{ color: C.contentSecondary }}>Days</Text>
        </View>
        <Text variant="labelXs" style={{ color: C.contentSecondary, marginTop: 2 }}>Active Streak</Text>
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, backgroundColor: C.surface04, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}>
        <Text variant="labelXs" style={{ color: C.contentSecondary }}>All-time Best:</Text>
        <Text variant="labelM" tabular style={{ color: KPI.rate }}>{streak.best} days</Text>
      </View>
    </View>
  );
}
